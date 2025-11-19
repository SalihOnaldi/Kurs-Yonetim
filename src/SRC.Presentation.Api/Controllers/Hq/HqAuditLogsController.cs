using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Tenancy;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/audit")]
[Authorize(Roles = "PlatformOwner")]
public class HqAuditLogsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public HqAuditLogsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogDto>>> GetAsync(
        [FromQuery] string? tenantId,
        [FromQuery] string? action,
        [FromQuery] string? actor,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);

        var query = _context.AuditLogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            query = query.Where(log => log.TenantId == tenantId);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(log => log.Action == action);
        }

        if (!string.IsNullOrWhiteSpace(actor))
        {
            query = query.Where(log => log.ActorName.Contains(actor));
        }

        if (dateFrom.HasValue)
        {
            query = query.Where(log => log.CreatedAt >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(log => log.CreatedAt <= dateTo.Value);
        }

        var logs = await query
            .OrderByDescending(log => log.CreatedAt)
            .Take(take)
            .Select(log => new AuditLogDto
            {
                Id = log.Id,
                Action = log.Action,
                ActorName = log.ActorName,
                ActorRole = log.ActorRole,
                TenantId = log.TenantId,
                EntityType = log.EntityType,
                EntityId = log.EntityId,
                Metadata = log.Metadata,
                CreatedAt = log.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(logs);
    }

    [HttpGet("csv-logs")]
    public async Task<IActionResult> GetCsvLogsAsync(
        [FromQuery] string? type,
        [FromQuery] string format = "json",
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);
        var actions = new List<string> { "license_import", "license_export" };
        if (!string.IsNullOrWhiteSpace(type))
        {
            actions = actions
                .Where(a => a.Contains(type, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var logs = await _context.AuditLogs.AsNoTracking()
            .Where(log => actions.Contains(log.Action))
            .OrderByDescending(log => log.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);

        var dto = logs.Select(log =>
        {
            int? totalRows = null;
            int? imported = null;
            int? failed = null;
            int? count = null;
            if (!string.IsNullOrWhiteSpace(log.Metadata))
            {
                try
                {
                    using var doc = JsonDocument.Parse(log.Metadata);
                    if (doc.RootElement.TryGetProperty("totalRows", out var prop)) totalRows = prop.GetInt32();
                    if (doc.RootElement.TryGetProperty("imported", out prop)) imported = prop.GetInt32();
                    if (doc.RootElement.TryGetProperty("failed", out prop)) failed = prop.GetInt32();
                    if (doc.RootElement.TryGetProperty("count", out prop)) count = prop.GetInt32();
                }
                catch
                {
                    // ignore metadata parse errors
                }
            }

            return new LicenseCsvLogDto
            {
                Id = log.Id,
                Action = log.Action,
                ActorName = log.ActorName,
                CreatedAt = log.CreatedAt,
                TotalRows = totalRows,
                Imported = imported,
                Failed = failed,
                Count = count
            };
        }).ToList();

        if (string.Equals(format, "csv", StringComparison.OrdinalIgnoreCase))
        {
            var builder = new StringBuilder();
            builder.AppendLine("Id,Islem,Kullanici,Tarih,ToplamSatir,Basarili,Basarisiz,Sayi");
            foreach (var row in dto)
            {
                builder.AppendLine(string.Join(",",
                    row.Id,
                    Escape(row.Action),
                    Escape(row.ActorName),
                    row.CreatedAt.ToString("s"),
                    row.TotalRows?.ToString() ?? "",
                    row.Imported?.ToString() ?? "",
                    row.Failed?.ToString() ?? "",
                    row.Count?.ToString() ?? ""));
            }

            var bytes = Encoding.UTF8.GetBytes(builder.ToString());
            return File(bytes, "text/csv", $"csv-logs-{DateTime.UtcNow:yyyyMMddHHmm}.csv");
        }

        return Ok(dto);
    }

    [HttpGet("csv-summary")]
    public async Task<ActionResult<CsvSummaryDto>> GetCsvSummaryAsync(CancellationToken cancellationToken)
    {
        var to = DateTime.UtcNow.Date;
        var from = to.AddDays(-6);

        var logs = await _context.AuditLogs.AsNoTracking()
            .Where(log => (log.Action == "license_import" || log.Action == "license_export") && log.CreatedAt.Date >= from && log.CreatedAt.Date <= to)
            .ToListAsync(cancellationToken);

        var summary = new CsvSummaryDto();

        for (var day = 0; day < 7; day++)
        {
            var date = from.AddDays(day).ToString("yyyy-MM-dd");
            summary.Last7Days[date] = new CsvSummaryPoint();
        }

        foreach (var log in logs)
        {
            var dateKey = log.CreatedAt.Date.ToString("yyyy-MM-dd");
            if (!summary.Last7Days.TryGetValue(dateKey, out var point))
            {
                point = new CsvSummaryPoint();
                summary.Last7Days[dateKey] = point;
            }

            if (log.Action == "license_import")
            {
                point.Imports++;
                summary.TotalImports++;
            }
            else if (log.Action == "license_export")
            {
                point.Exports++;
                summary.TotalExports++;
            }
        }

        return Ok(summary);
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }

        return value.Contains(',') ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
    }
}



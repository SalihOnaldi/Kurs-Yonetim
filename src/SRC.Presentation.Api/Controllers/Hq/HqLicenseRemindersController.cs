using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Tenancy;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/license-reminders")]
[Authorize(Roles = "PlatformOwner")]
public class HqLicenseRemindersController : ControllerBase
{
    private readonly SrcDbContext _context;

    public HqLicenseRemindersController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LicenseReminderLogDto>>> GetLogs(
        [FromQuery] string? tenantId,
        [FromQuery] string? status,
        [FromQuery] string? channel,
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);

        var query = _context.LicenseReminderLogs
            .AsNoTracking()
            .Join(
                _context.Tenants.AsNoTracking().IgnoreQueryFilters(),
                log => log.TenantId,
                tenant => tenant.Id,
                (log, tenant) => new { log, tenant })
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            query = query.Where(x => x.log.TenantId == tenantId);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.log.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(channel))
        {
            query = query.Where(x => x.log.Channel == channel);
        }

        if (dateFrom.HasValue)
        {
            query = query.Where(x => x.log.CreatedAt >= dateFrom.Value);
        }

        if (dateTo.HasValue)
        {
            query = query.Where(x => x.log.CreatedAt <= dateTo.Value);
        }

        var logs = await query
            .OrderByDescending(x => x.log.CreatedAt)
            .Take(take)
            .Select(x => new LicenseReminderLogDto
            {
                Id = x.log.Id,
                TenantId = x.log.TenantId,
                TenantName = x.tenant.Name,
                Channel = x.log.Channel,
                Recipient = x.log.Recipient,
                ThresholdDays = x.log.ThresholdDays,
                CreatedAt = x.log.CreatedAt,
                SentAt = x.log.SentAt,
                Status = x.log.Status,
                Error = x.log.Error
            })
            .ToListAsync(cancellationToken);

        return Ok(logs);
    }
}



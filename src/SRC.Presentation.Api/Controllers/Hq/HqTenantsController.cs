using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SRC.Application.DTOs.Tenancy;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/tenants")]
[Authorize(Roles = "PlatformOwner")]
public class HqTenantsController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IAuditLogger _auditLogger;
    private readonly IConfiguration _configuration;
    private readonly ILicenseEventPublisher _eventPublisher;
    private readonly ILicensePermissionService _permissionService;

    public HqTenantsController(
        SrcDbContext context,
        IAuditLogger auditLogger,
        IConfiguration configuration,
        ILicenseEventPublisher eventPublisher,
        ILicensePermissionService permissionService)
    {
        _context = context;
        _auditLogger = auditLogger;
        _configuration = configuration;
        _eventPublisher = eventPublisher;
        _permissionService = permissionService;
    }

    [HttpGet("usage")]
    public async Task<ActionResult<IEnumerable<HqTenantUsageDto>>> GetUsageAsync()
    {
        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .ToDictionaryAsync(t => t.Id, t => new { t.Name, t.ExpireDate, t.Username, t.City });

        // Önce veriyi memory'e çek (Include ile navigation property'leri de yükle)
        var students = await _context.Students
            .IgnoreQueryFilters()
            .Include(s => s.Enrollments)
            .Select(s => new
            {
                s.TenantId,
                s.CreatedAt,
                HasActiveEnrollment = s.Enrollments.Any(e => e.Status == "active")
            })
            .ToListAsync();

        // Memory'de grupla ve hesapla
        var usage = students
            .GroupBy(s => s.TenantId)
            .Select(group => new
            {
                TenantId = group.Key,
                TotalStudents = group.Count(),
                ActiveStudents = group.Count(s => s.HasActiveEnrollment),
                LastStudentCreatedAt = group.Max(s => s.CreatedAt)
            })
            .OrderByDescending(item => item.TotalStudents)
            .ToList();

        var response = usage.Select(item =>
        {
            var tenant = tenants.TryGetValue(item.TenantId, out var t) ? t : null;
            return new HqTenantUsageDto
            {
                TenantId = item.TenantId,
                TenantName = tenant?.Name ?? item.TenantId,
                TotalStudents = item.TotalStudents,
                ActiveStudents = item.ActiveStudents,
                LastStudentCreatedAt = item.LastStudentCreatedAt,
                ExpireDate = tenant?.ExpireDate,
                Username = tenant?.Username,
                City = tenant?.City
            };
        }).ToList();

        // Hiç öğrencisi olmayan (henüz kullanılmamış) tenantları da listeye ekle
        var tenantsWithoutUsage = tenants.Keys
            .Where(tenantId => response.All(r => r.TenantId != tenantId))
            .Select(tenantId => new HqTenantUsageDto
            {
                TenantId = tenantId,
                TenantName = tenants[tenantId].Name,
                TotalStudents = 0,
                ActiveStudents = 0,
                LastStudentCreatedAt = null,
                ExpireDate = tenants[tenantId].ExpireDate,
                Username = tenants[tenantId].Username,
                City = tenants[tenantId].City
            });

        response.AddRange(tenantsWithoutUsage);

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult> CreateLicense([FromBody] CreateLicenseRequest request, CancellationToken cancellationToken)
    {
        if (!_permissionService.CanCreate(User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty))
        {
            return Forbid("Bu işlem için yetkiniz bulunmuyor.");
        }

        try
        {
            var tenant = await CreateTenantAsync(request, cancellationToken);

            var metadata = new
            {
                tenant.Id,
                tenant.Name,
                tenant.Username,
                tenant.City,
                tenant.ExpireDate
            };

            await _auditLogger.LogAsync(
                action: "license_create",
                entityType: "tenant",
                entityId: tenant.Id,
                tenantId: tenant.Id,
                metadata: metadata,
                cancellationToken: cancellationToken);

            await _eventPublisher.PublishAsync("license_created", metadata, cancellationToken);

            return Ok(new
            {
                tenant.Id,
                tenant.Name,
                tenant.Username,
                tenant.ExpireDate,
                tenant.ContactEmail,
                tenant.ContactPhone,
                tenant.CreatedAt,
                tenant.City
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("summary")]
    public async Task<ActionResult<HqLicenseSummaryDto>> GetSummaryAsync()
    {
        var now = DateTime.UtcNow;
        var thirtyDaysLater = now.AddDays(30);
        var monthStart = new DateTime(now.Year, now.Month, 1);

        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .Select(t => new { t.Id, t.ExpireDate, t.CreatedAt })
            .ToListAsync();

        var summary = new HqLicenseSummaryDto
        {
            TotalLicenses = tenants.Count,
            ExpiringSoon = tenants.Count(t => t.ExpireDate.HasValue && t.ExpireDate.Value >= now && t.ExpireDate.Value <= thirtyDaysLater),
            Expired = tenants.Count(t => t.ExpireDate.HasValue && t.ExpireDate.Value < now),
            CreatedThisMonth = tenants.Count(t => t.CreatedAt >= monthStart)
        };

        return Ok(summary);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAsync(CancellationToken cancellationToken)
    {
        if (!_permissionService.CanExport(User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty))
        {
            return Forbid("Bu işlem için yetkiniz bulunmuyor.");
        }

        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .OrderBy(t => t.Name)
            .Select(t => new
            {
                t.Name,
                t.City,
                t.Username,
                t.ContactEmail,
                t.ContactPhone,
                t.ExpireDate,
                t.IsActive
            })
            .ToListAsync(cancellationToken);

        var builder = new StringBuilder();
        builder.AppendLine("KursAdi,Sehir,KullaniciAdi,IletisimEposta,IletisimTelefon,LisansBitisTarihi,Durum");

        foreach (var tenant in tenants)
        {
            var status = tenant.ExpireDate.HasValue && tenant.ExpireDate.Value < DateTime.UtcNow
                ? "Suresi Dolmus"
                : tenant.IsActive ? "Aktif" : "Pasif";

            builder.AppendLine(string.Join(",",
                Escape(tenant.Name),
                Escape(tenant.City),
                Escape(tenant.Username),
                Escape(tenant.ContactEmail),
                Escape(tenant.ContactPhone),
                tenant.ExpireDate?.ToString("yyyy-MM-dd") ?? "",
                status));
        }

        var exportMetadata = new { count = tenants.Count, generatedAt = DateTime.UtcNow };
        await _auditLogger.LogAsync("license_export", "tenant", metadata: exportMetadata, cancellationToken: cancellationToken);
        await _eventPublisher.PublishAsync("license_export", exportMetadata, cancellationToken);
        var bytes = Encoding.UTF8.GetBytes(builder.ToString());
        return File(bytes, "text/csv", $"lisanslar-{DateTime.UtcNow:yyyyMMddHHmm}.csv");
    }

    [HttpPost("import")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<ActionResult<LicenseImportResult>> ImportAsync([FromForm] LicenseImportRequest request, CancellationToken cancellationToken)
    {
        if (!_permissionService.CanImport(User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty))
        {
            return Forbid("Bu işlem için yetkiniz bulunmuyor.");
        }

        if (request.File == null || request.File.Length == 0)
        {
            return BadRequest(new { message = "Lütfen geçerli bir CSV dosyası yükleyin." });
        }

        using var stream = request.File.OpenReadStream();
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        var headerLine = await reader.ReadLineAsync();
        if (string.IsNullOrWhiteSpace(headerLine))
        {
            return BadRequest(new { message = "CSV başlığı okunamadı." });
        }

        var headers = headerLine.Split(',', StringSplitOptions.TrimEntries);
        var map = headers
            .Select((name, index) => new { name = name.ToLowerInvariant(), index })
            .ToDictionary(x => x.name, x => x.index);

        var result = new LicenseImportResult();
        var rowNumber = 1;
        string? line;

        while ((line = await reader.ReadLineAsync()) != null)
        {
            rowNumber++;
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            result.TotalRows++;
            var parts = ParseCsvLine(line, headers.Length);
            try
            {
                var importRequest = new CreateLicenseRequest
                {
                    Name = GetValue(parts, map, "kursadi") ?? throw new InvalidOperationException("Kurs adı boş olamaz."),
                    City = GetValue(parts, map, "sehir"),
                    Username = GetValue(parts, map, "kullaniciadi") ?? throw new InvalidOperationException("Kullanıcı adı boş olamaz."),
                    Password = GetValue(parts, map, "sifre") ?? throw new InvalidOperationException("Şifre boş olamaz."),
                    ContactEmail = GetValue(parts, map, "iletisimeposta") ?? GetValue(parts, map, "email") ?? throw new InvalidOperationException("İletişim e-postası boş olamaz."),
                    ContactPhone = GetValue(parts, map, "iletisimtelefon") ?? GetValue(parts, map, "telefon"),
                    ExpireDate = ParseDate(GetValue(parts, map, "lisansbitistarihi"))
                };

                await CreateTenantAsync(importRequest, cancellationToken);
                result.Imported++;
            }
            catch (Exception ex)
            {
                result.Errors.Add(new LicenseImportError
                {
                    RowNumber = rowNumber,
                    Message = ex.Message
                });
            }
        }

        result.Failed = result.Errors.Count;

        var importMetadata = new { result.TotalRows, result.Imported, result.Failed };
        await _auditLogger.LogAsync("license_import", "tenant", metadata: importMetadata, cancellationToken: cancellationToken);
        await _eventPublisher.PublishAsync("license_import", importMetadata, cancellationToken);
        return Ok(result);
    }

    [HttpPost("bulk-status")]
    public async Task<ActionResult<BulkLicenseActionResult>> BulkUpdateStatus([FromBody] BulkLicenseActionRequest request, CancellationToken cancellationToken)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;
        if (!_permissionService.CanManage(role))
        {
            return Forbid("Bu işlem için yetkiniz bulunmuyor.");
        }

        if (request == null || request.TenantIds == null || request.TenantIds.Count == 0)
        {
            return BadRequest(new { message = "En az bir lisans seçilmelidir." });
        }

        var action = request.Action?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(action) || !(action is "disable" or "enable" or "delete"))
        {
            return BadRequest(new { message = "Geçersiz işlem türü." });
        }

        var tenants = await _context.Tenants
            .IgnoreQueryFilters()
            .Where(t => request.TenantIds.Contains(t.Id))
            .ToListAsync(cancellationToken);

        var result = new BulkLicenseActionResult();

        foreach (var tenant in tenants)
        {
            switch (action)
            {
                case "disable":
                    if (!tenant.IsActive)
                    {
                        result.Skipped++;
                        result.Errors.Add($"{tenant.Name} zaten pasif.");
                        continue;
                    }
                    tenant.IsActive = false;
                    result.Processed++;
                    break;

                case "enable":
                    if (tenant.IsActive)
                    {
                        result.Skipped++;
                        result.Errors.Add($"{tenant.Name} zaten aktif.");
                        continue;
                    }
                    tenant.IsActive = true;
                    result.Processed++;
                    break;

                case "delete":
                    if (await HasDependenciesAsync(tenant.Id, cancellationToken))
                    {
                        result.Skipped++;
                        result.Errors.Add($"{tenant.Name} kayıtları olduğu için silinemedi.");
                        continue;
                    }
                    _context.Tenants.Remove(tenant);
                    result.Processed++;
                    break;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);

        var metadata = new
        {
            action,
            requestCount = request.TenantIds.Count,
            result.Processed,
            result.Skipped
        };

        await _auditLogger.LogAsync("license_bulk_action", "tenant", metadata: metadata, cancellationToken: cancellationToken);
        await _eventPublisher.PublishAsync("license_bulk_action", metadata, cancellationToken);

        return Ok(result);
    }

    [HttpPost("{tenantId}/impersonate")]
    public async Task<ActionResult<ImpersonateTenantResponse>> ImpersonateAsync(string tenantId, CancellationToken cancellationToken)
    {
        if (!_permissionService.CanImpersonate(User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty))
        {
            return Forbid("Bu işlem için yetkiniz bulunmuyor.");
        }

        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tenantId && t.IsActive, cancellationToken);

        if (tenant == null)
        {
            return NotFound(new { message = "Tenant bulunamadı." });
        }

        var secret = _configuration["JWT_SECRET"] ?? "replace-with-32char-secret-key-min";
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(secret);

        var actorId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0";
        var actorName = User.Identity?.Name ?? "hq-user";
        var actorRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "PlatformOwner";

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, actorId),
            new Claim(ClaimTypes.Name, actorName),
            new Claim(ClaimTypes.Role, "BranchAdmin"),
            new Claim("tenantId", tenantId),
            new Claim("tenants", tenantId),
            new Claim("impersonated", "true"),
            new Claim("impersonatorRole", actorRole)
        };

        var expires = DateTime.UtcNow.AddMinutes(15);
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expires,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var serializedToken = tokenHandler.WriteToken(token);

        var impersonationMetadata = new { tenant.Id, tenant.Name, actor = actorName };
        await _auditLogger.LogAsync("tenant_impersonate", "tenant", tenantId, tenantId, impersonationMetadata, cancellationToken);
        await _eventPublisher.PublishAsync("tenant_impersonate", impersonationMetadata, cancellationToken);

        return Ok(new ImpersonateTenantResponse
        {
            Token = serializedToken,
            TenantId = tenantId,
            ExpiresAt = expires
        });
    }

    private async Task<SRC.Domain.Entities.Tenant> CreateTenantAsync(CreateLicenseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new InvalidOperationException("Kurs adı gereklidir.");
        }

        if (string.IsNullOrWhiteSpace(request.Username))
        {
            throw new InvalidOperationException("Kullanıcı adı gereklidir.");
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            throw new InvalidOperationException("Şifre gereklidir.");
        }

        if (string.IsNullOrWhiteSpace(request.ContactEmail))
        {
            throw new InvalidOperationException("İletişim e-postası gereklidir.");
        }

        var existingTenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Username == request.Username, cancellationToken);

        if (existingTenant != null)
        {
            throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılıyor.");
        }

        var tenantId = NormalizeTenantId(request.Name);
        var counter = 1;
        var originalTenantId = tenantId;
        while (await _context.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Id == tenantId, cancellationToken))
        {
            tenantId = $"{originalTenantId}-{counter}";
            counter++;
        }

        var tenant = new SRC.Domain.Entities.Tenant
        {
            Id = tenantId,
            Name = request.Name,
            City = request.City,
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            ExpireDate = request.ExpireDate,
            ContactEmail = request.ContactEmail,
            ContactPhone = request.ContactPhone,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Tenants.Add(tenant);
        await _context.SaveChangesAsync(cancellationToken);

        return tenant;
    }

    private static string NormalizeTenantId(string name)
    {
        return name
            .ToUpperInvariant()
            .Replace(" ", "-")
            .Replace("Ğ", "G")
            .Replace("Ü", "U")
            .Replace("Ş", "S")
            .Replace("İ", "I")
            .Replace("Ö", "O")
            .Replace("Ç", "C")
            .Replace("ğ", "G")
            .Replace("ü", "U")
            .Replace("ş", "S")
            .Replace("ı", "I")
            .Replace("ö", "O")
            .Replace("ç", "C");
    }

    private static string? GetValue(string[] values, Dictionary<string, int> map, string key)
    {
        return map.TryGetValue(key, out var index) && index >= 0 && index < values.Length
            ? values[index].Trim()
            : null;
    }

    private static DateTime? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTime.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed;
        }

        if (DateTime.TryParseExact(value, new[] { "dd.MM.yyyy", "yyyy-MM-dd" }, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out parsed))
        {
            return parsed;
        }

        throw new InvalidOperationException($"Geçersiz tarih formatı: {value}");
    }

    private static string[] ParseCsvLine(string line, int expectedColumns)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }

            if (ch == ',' && !inQuotes)
            {
                result.Add(current.ToString());
                current.Clear();
                continue;
            }

            current.Append(ch);
        }

        result.Add(current.ToString());

        while (result.Count < expectedColumns)
        {
            result.Add(string.Empty);
        }

        return result.ToArray();
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }

        if (value.Contains(',') || value.Contains('"'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private async Task<bool> HasDependenciesAsync(string tenantId, CancellationToken cancellationToken)
    {
        var studentExists = await _context.Students.IgnoreQueryFilters()
            .AnyAsync(s => s.TenantId == tenantId, cancellationToken);
        if (studentExists)
        {
            return true;
        }

        var courseExists = await _context.Courses.IgnoreQueryFilters()
            .AnyAsync(c => c.TenantId == tenantId, cancellationToken);
        if (courseExists)
        {
            return true;
        }

        return false;
    }
}

public class CreateLicenseRequest
{
    public string Name { get; set; } = default!;
    public string? City { get; set; }
    public string Username { get; set; } = default!;
    public string Password { get; set; } = default!;
    public DateTime? ExpireDate { get; set; }
    public string ContactEmail { get; set; } = string.Empty;
    public string? ContactPhone { get; set; }
}

public class LicenseImportRequest
{
    public IFormFile? File { get; set; }
}

public class LicenseImportResult
{
    public int TotalRows { get; set; }
    public int Imported { get; set; }
    public int Failed { get; set; }
    public List<LicenseImportError> Errors { get; set; } = new();
}

public class LicenseImportError
{
    public int RowNumber { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ImpersonateTenantResponse
{
    public string Token { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class BulkLicenseActionRequest
{
    public string Action { get; set; } = string.Empty;
    public List<string> TenantIds { get; set; } = new();
}

public class BulkLicenseActionResult
{
    public int Processed { get; set; }
    public int Skipped { get; set; }
    public List<string> Errors { get; set; } = new();
}



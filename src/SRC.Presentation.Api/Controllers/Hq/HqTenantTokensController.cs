using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Tenancy;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/tenants/{tenantId}/tokens")]
[Authorize(Policy = "LicenseCanManage")]
public class HqTenantTokensController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IAuditLogger _auditLogger;

    public HqTenantTokensController(SrcDbContext context, IAuditLogger auditLogger)
    {
        _context = context;
        _auditLogger = auditLogger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TenantApiTokenDto>>> GetTokensAsync(string tenantId, CancellationToken cancellationToken)
    {
        var exists = await _context.Tenants.IgnoreQueryFilters().AnyAsync(t => t.Id == tenantId, cancellationToken);
        if (!exists)
        {
            return NotFound(new { message = "Tenant bulunamadı." });
        }

        var tokens = await _context.TenantApiTokens
            .IgnoreQueryFilters()
            .Where(token => token.TenantId == tenantId)
            .OrderByDescending(token => token.CreatedAt)
            .Select(token => new TenantApiTokenDto
            {
                Id = token.Id,
                Name = token.Name,
                TokenPrefix = token.TokenPrefix,
                Description = token.Description,
                Permissions = token.Permissions,
                CreatedAt = token.CreatedAt,
                ExpiresAt = token.ExpiresAt,
                LastUsedAt = token.LastUsedAt,
                IsRevoked = token.IsRevoked,
                RevokedAt = token.RevokedAt,
                CreatedByName = token.CreatedByName,
                RevokedByName = token.RevokedByName
            })
            .ToListAsync(cancellationToken);

        return Ok(tokens);
    }

    [HttpPost]
    public async Task<ActionResult<CreateTenantApiTokenResponse>> CreateTokenAsync(
        string tenantId,
        [FromBody] CreateTenantApiTokenRequest request,
        CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Geçersiz istek." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Token adı zorunludur." });
        }

        var tenant = await _context.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == tenantId, cancellationToken);
        if (tenant == null)
        {
            return NotFound(new { message = "Tenant bulunamadı." });
        }

        DateTime? expiresAt = null;
        if (request.ExpiresAt.HasValue)
        {
            expiresAt = request.ExpiresAt.Value.ToUniversalTime();
        }
        else if (request.ExpiresInDays.HasValue && request.ExpiresInDays.Value > 0)
        {
            expiresAt = DateTime.UtcNow.AddDays(request.ExpiresInDays.Value);
        }

        if (expiresAt.HasValue && expiresAt.Value <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Bitiş tarihi gelecekte olmalıdır." });
        }

        var plainToken = GenerateTokenValue();
        var tokenHash = HashToken(plainToken);
        var prefix = plainToken.Length >= 12 ? plainToken[..12] : plainToken;

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = User.Identity?.Name ?? "hq-user";

        var token = new Domain.Entities.TenantApiToken
        {
            TenantId = tenantId,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            Permissions = request.Permissions != null && request.Permissions.Length > 0 ? string.Join(",", request.Permissions) : null,
            TokenHash = tokenHash,
            TokenPrefix = prefix,
            ExpiresAt = expiresAt,
            CreatedByUserId = int.TryParse(userId, out var parsedUserId) ? parsedUserId : null,
            CreatedByName = userName
        };

        _context.TenantApiTokens.Add(token);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = new TenantApiTokenDto
        {
            Id = token.Id,
            Name = token.Name,
            TokenPrefix = token.TokenPrefix,
            Description = token.Description,
            Permissions = token.Permissions,
            CreatedAt = token.CreatedAt,
            ExpiresAt = token.ExpiresAt,
            LastUsedAt = token.LastUsedAt,
            IsRevoked = token.IsRevoked,
            RevokedAt = token.RevokedAt,
            CreatedByName = token.CreatedByName
        };

        await _auditLogger.LogAsync(
            "tenant_api_token_create",
            "tenant_token",
            entityId: token.Id.ToString(),
            tenantId: tenantId,
            metadata: new
            {
                token.Id,
                token.Name,
                token.TokenPrefix,
                token.ExpiresAt
            },
            cancellationToken: cancellationToken);

        return Ok(new CreateTenantApiTokenResponse
        {
            Token = dto,
            PlainToken = plainToken
        });
    }

    [HttpPost("{tokenId}/revoke")]
    public async Task<ActionResult> RevokeTokenAsync(
        string tenantId,
        int tokenId,
        [FromBody] RevokeTenantApiTokenRequest request,
        CancellationToken cancellationToken)
    {
        var token = await _context.TenantApiTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.TenantId == tenantId, cancellationToken);

        if (token == null)
        {
            return NotFound(new { message = "Token bulunamadı." });
        }

        if (token.IsRevoked)
        {
            return BadRequest(new { message = "Token zaten iptal edilmiş." });
        }

        token.IsRevoked = true;
        token.RevokedAt = DateTime.UtcNow;
        token.RevokedByName = User.Identity?.Name ?? "hq-user";
        token.RevokedByUserId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var parsedUserId)
            ? parsedUserId
            : null;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditLogger.LogAsync(
            "tenant_api_token_revoke",
            "tenant_token",
            entityId: token.Id.ToString(),
            tenantId: tenantId,
            metadata: new
            {
                token.Id,
                token.Name,
                Reason = request?.Reason
            },
            cancellationToken: cancellationToken);

        return Ok(new { message = "Token iptal edildi." });
    }

    private static string GenerateTokenValue()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}



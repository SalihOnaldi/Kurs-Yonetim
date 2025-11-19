using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Infrastructure.Services;

public class AuditLogger : IAuditLogger
{
    private readonly SrcDbContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(SrcDbContext context, IHttpContextAccessor httpContextAccessor, ILogger<AuditLogger> logger)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    public async Task LogAsync(
        string action,
        string entityType,
        string? entityId = null,
        string? tenantId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var httpContext = _httpContextAccessor.HttpContext;
            var user = httpContext?.User;
            int? actorUserId = null;
            string actorName = "system";
            string actorRole = "system";

            if (user?.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedId))
                {
                    actorUserId = parsedId;
                }

                actorName = user.Identity?.Name ?? actorName;
                actorRole = user.FindFirst(ClaimTypes.Role)?.Value ?? actorRole;
            }

            var log = new SRC.Domain.Entities.AuditLog
            {
                ActorUserId = actorUserId,
                ActorName = actorName,
                ActorRole = actorRole,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                TenantId = tenantId,
                Metadata = metadata != null ? JsonSerializer.Serialize(metadata) : null,
                CreatedAt = DateTime.UtcNow
            };

            await _context.AuditLogs.AddAsync(log, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Audit log yazılırken hata oluştu. Action: {Action}", action);
        }
    }
}



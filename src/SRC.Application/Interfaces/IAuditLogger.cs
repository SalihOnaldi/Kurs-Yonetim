namespace SRC.Application.Interfaces;

public interface IAuditLogger
{
    Task LogAsync(
        string action,
        string entityType,
        string? entityId = null,
        string? tenantId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default);
}



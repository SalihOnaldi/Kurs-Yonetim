namespace SRC.Domain.Entities;

/// <summary>
/// Base type for entities that belong to a specific tenant (branch).
/// </summary>
public abstract class TenantEntity
{
    /// <summary>
    /// Identifier of the tenant that owns the record.
    /// </summary>
    public string TenantId { get; set; } = default!;

    /// <summary>
    /// Record creation timestamp (UTC).
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Record last update timestamp (UTC).
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}



using System.ComponentModel.DataAnnotations;

namespace SRC.Domain.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public int? ActorUserId { get; set; }

    [MaxLength(200)]
    public string ActorName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ActorRole { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    [MaxLength(100)]
    public string EntityType { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? EntityId { get; set; }

    public string? TenantId { get; set; }

    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}



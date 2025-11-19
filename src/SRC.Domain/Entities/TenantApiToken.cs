namespace SRC.Domain.Entities;

public class TenantApiToken : TenantEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public string TokenPrefix { get; set; } = default!;
    public string? Description { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByName { get; set; }
    public int? RevokedByUserId { get; set; }
    public string? RevokedByName { get; set; }
    public string? Permissions { get; set; }
}



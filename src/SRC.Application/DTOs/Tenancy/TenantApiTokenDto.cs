namespace SRC.Application.DTOs.Tenancy;

public class TenantApiTokenDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TokenPrefix { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Permissions { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? CreatedByName { get; set; }
    public string? RevokedByName { get; set; }
}

public class CreateTenantApiTokenRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ExpiresInDays { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public string[] Permissions { get; set; } = Array.Empty<string>();
}

public class CreateTenantApiTokenResponse
{
    public TenantApiTokenDto Token { get; set; } = default!;
    public string PlainToken { get; set; } = string.Empty;
}

public class RevokeTenantApiTokenRequest
{
    public string? Reason { get; set; }
}



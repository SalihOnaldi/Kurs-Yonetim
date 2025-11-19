namespace SRC.Domain.Entities;

/// <summary>
/// Lisans/Kurs bilgileri. Her tenant bir lisansı temsil eder.
/// </summary>
public class Tenant
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!; // Kurs adı
    public string? City { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Lisans bilgileri
    public string? Username { get; set; } // Kurs için özel kullanıcı adı
    public string? PasswordHash { get; set; } // Kurs için özel şifre (BCrypt)
    public DateTime? ExpireDate { get; set; } // Lisans son kullanma tarihi

    public ICollection<UserTenant> UserTenants { get; set; } = new List<UserTenant>();
}



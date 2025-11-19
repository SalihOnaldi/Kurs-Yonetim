namespace SRC.Domain.Entities;

public class UserTenant
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int UserId { get; set; }
    public string TenantId { get; set; } = default!;

    public User? User { get; set; }
    public Tenant? Tenant { get; set; }
}



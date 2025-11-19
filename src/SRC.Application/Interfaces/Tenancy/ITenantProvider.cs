namespace SRC.Application.Interfaces.Tenancy;

public interface ITenantProvider
{
    string TenantId { get; }
    void SetTenant(string tenantId);
}



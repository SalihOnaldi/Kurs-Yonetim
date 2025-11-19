using System.Threading;
using SRC.Application.Interfaces.Tenancy;

namespace SRC.Infrastructure.Services.Tenancy;

public class TenantProvider : ITenantProvider
{
    private static readonly AsyncLocal<string?> CurrentTenant = new();
    private const string DefaultTenant = "default";

    public string TenantId => CurrentTenant.Value ?? DefaultTenant;

    public void SetTenant(string tenantId)
    {
        if (string.IsNullOrWhiteSpace(tenantId))
        {
            CurrentTenant.Value = DefaultTenant;
            return;
        }

        CurrentTenant.Value = tenantId.Trim();
    }
}



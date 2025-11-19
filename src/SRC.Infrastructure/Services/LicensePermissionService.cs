using Microsoft.Extensions.Options;
using SRC.Application.Interfaces;
using SRC.Application.Options;

namespace SRC.Infrastructure.Services;

public class LicensePermissionService : ILicensePermissionService
{
    private readonly LicensePermissionOptions _options;

    public LicensePermissionService(IOptions<LicensePermissionOptions> options)
    {
        _options = options.Value;
    }

    private LicenseRolePermission GetPermissions(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return new LicenseRolePermission();
        }

        return _options.Roles.TryGetValue(role, out var perm) ? perm : new LicenseRolePermission();
    }

    public bool CanCreate(string role) => GetPermissions(role).CanCreate;
    public bool CanExport(string role) => GetPermissions(role).CanExportCsv;
    public bool CanImport(string role) => GetPermissions(role).CanImportCsv;
    public bool CanImpersonate(string role) => GetPermissions(role).CanImpersonate;
    public bool CanManage(string role) => GetPermissions(role).CanManage;
}



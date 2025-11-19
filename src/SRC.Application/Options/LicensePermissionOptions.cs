namespace SRC.Application.Options;

public class LicensePermissionOptions
{
    public Dictionary<string, LicenseRolePermission> Roles { get; set; } = new();
}

public class LicenseRolePermission
{
    public bool CanCreate { get; set; } = true;
    public bool CanExportCsv { get; set; } = true;
    public bool CanImportCsv { get; set; } = true;
    public bool CanImpersonate { get; set; } = true;
    public bool CanManage { get; set; } = true;
}



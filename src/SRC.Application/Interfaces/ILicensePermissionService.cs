namespace SRC.Application.Interfaces;

public interface ILicensePermissionService
{
    bool CanCreate(string role);
    bool CanExport(string role);
    bool CanImport(string role);
    bool CanImpersonate(string role);
    bool CanManage(string role);
}



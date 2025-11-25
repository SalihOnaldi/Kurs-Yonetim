using SRC.Application.DTOs.Certificate;

namespace SRC.Application.Interfaces;

public interface ICertificateService
{
    Task<CertificateDto> GenerateCertificateAsync(int studentId, int mebGroupId, int writtenExamId, int practicalExamId);
    Task<string> GenerateUniqueCertificateNumberAsync(string tenantId);
    Task<CertificateDto?> GetCertificateAsync(int certificateId);
    Task<List<CertificateDto>> GetCertificatesByStudentAsync(int studentId);
    Task<List<CertificateDto>> GetCertificatesByMebGroupAsync(int mebGroupId);
    Task<CertificateReportDto> GenerateCertificateReportAsync(int certificateId);
}


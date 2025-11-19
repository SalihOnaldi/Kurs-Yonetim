using System.IO;
using SRC.Application.DTOs.Student;

namespace SRC.Application.Interfaces;

public interface IStudentService
{
    Task<List<StudentDto>> GetAllAsync();
    Task<List<StudentListItemDto>> SearchAsync(StudentListFilter filter);
    Task<StudentDetailDto?> GetDetailAsync(int id);
    Task<StudentDto?> GetByIdAsync(int id);
    Task<StudentDto> CreateAsync(CreateStudentRequest request);
    Task<StudentDto?> UpdateAsync(int id, UpdateStudentRequest request);
    Task<bool> DeleteAsync(int id);
    Task<List<StudentDocumentDto>> GetDocumentsAsync(int studentId);
    Task<StudentDocumentDto> UploadDocumentAsync(int studentId, Stream fileStream, string fileName, string contentType, string documentType);
    Task<(Stream Stream, string FileName, string ContentType)?> DownloadDocumentAsync(int studentId, int documentId);
    Task<bool> DeleteDocumentAsync(int studentId, int documentId);
}

public class CreateStudentRequest
{
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? EducationLevel { get; set; }
    public string? LicenseType { get; set; }
    public DateTime? LicenseIssueDate { get; set; }
}

public class UpdateStudentRequest
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? EducationLevel { get; set; }
    public string? LicenseType { get; set; }
    public DateTime? LicenseIssueDate { get; set; }
}


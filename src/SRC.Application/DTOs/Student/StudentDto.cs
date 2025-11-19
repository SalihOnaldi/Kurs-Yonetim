namespace SRC.Application.DTOs.Student;

public class StudentDto
{
    public int Id { get; set; }
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
    public DateTime CreatedAt { get; set; }
}


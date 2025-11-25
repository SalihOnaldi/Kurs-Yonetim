namespace SRC.Domain.Entities;

public class Student : TenantEntity
{
    public int Id { get; set; }
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? EducationLevel { get; set; } // İlkokul, Ortaokul, Lise, Üniversite
    public string? LicenseType { get; set; } // B, C, D, E, vb.
    public DateTime? LicenseIssueDate { get; set; }
    public string? FaceProfileId { get; set; }
    public string? SelectedSrcCourses { get; set; } // Seçilen SRC kursları (örn: "1,2,3")

    // Navigation properties
    public ICollection<StudentDocument> Documents { get; set; } = new List<StudentDocument>();
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
    public ICollection<ExamResult> ExamResults { get; set; } = new List<ExamResult>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
    public ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
}


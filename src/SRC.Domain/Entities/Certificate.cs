namespace SRC.Domain.Entities;

public class Certificate : TenantEntity
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int MebGroupId { get; set; } // CourseId yerine
    public int WrittenExamId { get; set; }
    public int PracticalExamId { get; set; }
    public string CertificateNumber { get; set; } = string.Empty; // Unique sertifika numarası
    public DateTime IssueDate { get; set; }
    public string Status { get; set; } = "active"; // active, revoked, cancelled
    public string? RevokeReason { get; set; }
    public DateTime? RevokedAt { get; set; }

    // Navigation properties
    public Student Student { get; set; } = null!;
    public MebGroup MebGroup { get; set; } = null!; // Course yerine
    public Exam WrittenExam { get; set; } = null!;
    public Exam PracticalExam { get; set; } = null!;
}


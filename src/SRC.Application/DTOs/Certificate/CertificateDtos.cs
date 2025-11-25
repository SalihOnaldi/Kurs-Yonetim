namespace SRC.Application.DTOs.Certificate;

public class CertificateDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string StudentLastName { get; set; } = string.Empty;
    public string StudentTcKimlikNo { get; set; } = string.Empty;
    public int MebGroupId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public int SrcType { get; set; }
    public int WrittenExamId { get; set; }
    public int PracticalExamId { get; set; }
    public string CertificateNumber { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RevokeReason { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class CertificateReportDto
{
    public string CertificateNumber { get; set; } = string.Empty;
    public string StudentFullName { get; set; } = string.Empty;
    public string StudentTcKimlikNo { get; set; } = string.Empty;
    public string CourseName { get; set; } = string.Empty;
    public int SrcType { get; set; }
    public DateTime IssueDate { get; set; }
    public string MebHeaderText { get; set; } = string.Empty; // MEB üst yazı formatı
}


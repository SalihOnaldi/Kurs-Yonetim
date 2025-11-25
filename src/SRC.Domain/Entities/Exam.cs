namespace SRC.Domain.Entities;

public class Exam : TenantEntity
{
    public int Id { get; set; }
    public int MebGroupId { get; set; } // CourseId yerine
    public string ExamType { get; set; } = string.Empty; // yazili, uygulama
    public DateTime ExamDate { get; set; }
    public string? MebSessionCode { get; set; }
    public string Status { get; set; } = "scheduled"; // scheduled, completed, cancelled
    public string? Notes { get; set; }

    // Navigation properties
    public MebGroup MebGroup { get; set; } = null!; // Course yerine
    public ICollection<ExamResult> ExamResults { get; set; } = new List<ExamResult>();
}



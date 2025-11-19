namespace SRC.Domain.Entities;

public class ExamResult : TenantEntity
{
    public int Id { get; set; }
    public int ExamId { get; set; }
    public int StudentId { get; set; }
    public decimal Score { get; set; } // 0.00-100.00
    public bool Pass { get; set; }
    public int AttemptNo { get; set; } // 1-4
    public string? Notes { get; set; }

    // Navigation properties
    public Exam Exam { get; set; } = null!;
    public Student Student { get; set; } = null!;
}



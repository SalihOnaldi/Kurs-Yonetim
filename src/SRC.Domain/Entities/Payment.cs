namespace SRC.Domain.Entities;

public class Payment : TenantEntity
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int? EnrollmentId { get; set; }
    public decimal Amount { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    public string PaymentType { get; set; } = string.Empty; // course_fee, exam_fee, other
    public decimal? PenaltyAmount { get; set; }
    public string? Description { get; set; }
    public string? ReceiptNo { get; set; } // Dekont no
    public string Status { get; set; } = "pending"; // pending, paid, cancelled

    // Navigation properties
    public Student Student { get; set; } = null!;
    public Enrollment? Enrollment { get; set; }
}



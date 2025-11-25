namespace SRC.Domain.Entities;

public class Enrollment : TenantEntity
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int MebGroupId { get; set; } // CourseId yerine
    public DateTime EnrollmentDate { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "active"; // active, completed, cancelled, transferred
    public decimal Fee { get; set; }
    public decimal? PaidAmount { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Notes { get; set; }

    // Navigation properties
    public Student Student { get; set; } = null!;
    public MebGroup MebGroup { get; set; } = null!; // Course yerine
    public ICollection<MebbisTransferItem> MebbisTransferItems { get; set; } = new List<MebbisTransferItem>();
}


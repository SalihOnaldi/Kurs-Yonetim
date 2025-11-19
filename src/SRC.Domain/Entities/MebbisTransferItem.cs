namespace SRC.Domain.Entities;

public class MebbisTransferItem : TenantEntity
{
    public int Id { get; set; }
    public int MebbisTransferJobId { get; set; }
    public int EnrollmentId { get; set; }
    public string Status { get; set; } = "pending"; // pending, transferred, failed
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime? TransferredAt { get; set; }

    // Navigation properties
    public MebbisTransferJob MebbisTransferJob { get; set; } = null!;
    public Enrollment Enrollment { get; set; } = null!;
}



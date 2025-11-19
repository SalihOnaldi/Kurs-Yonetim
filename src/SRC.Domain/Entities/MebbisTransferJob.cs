namespace SRC.Domain.Entities;

public class MebbisTransferJob : TenantEntity
{
    public int Id { get; set; }
    public int CourseId { get; set; }
    public string Mode { get; set; } = "dry_run"; // dry_run, live
    public string Status { get; set; } = "pending"; // pending, running, completed, failed
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public bool? CaptchaSolved { get; set; }
    public string? EvidenceUrl { get; set; } // Screenshot link
    public string? ErrorMessage { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation properties
    public Course Course { get; set; } = null!;
    public ICollection<MebbisTransferItem> TransferItems { get; set; } = new List<MebbisTransferItem>();
}



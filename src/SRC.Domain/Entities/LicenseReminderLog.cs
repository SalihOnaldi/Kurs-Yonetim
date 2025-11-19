namespace SRC.Domain.Entities;

public class LicenseReminderLog
{
    public int Id { get; set; }
    public string TenantId { get; set; } = default!;
    public string Channel { get; set; } = "email";
    public string? Recipient { get; set; }
    public int ThresholdDays { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public string Status { get; set; } = "queued"; // queued, sent, failed, skipped
    public string? Error { get; set; }
}



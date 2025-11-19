namespace SRC.Domain.Entities;

public class Reminder : TenantEntity
{
    public int Id { get; set; }
    public int? StudentId { get; set; }
    public int? StudentDocumentId { get; set; }
    public string Type { get; set; } = "document_expiry";
    public string Channel { get; set; } = "email"; // email, sms, both
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = "pending"; // pending, queued, sent, failed, cancelled
    public DateTime ScheduledAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string? Error { get; set; }

    public Student? Student { get; set; }
    public StudentDocument? StudentDocument { get; set; }
}



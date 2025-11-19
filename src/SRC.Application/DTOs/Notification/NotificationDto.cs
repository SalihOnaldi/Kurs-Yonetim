namespace SRC.Application.DTOs.Notification;

public class NotificationDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Severity { get; set; } = "info";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? RelatedEntityType { get; set; }
    public int? RelatedEntityId { get; set; }
    public Dictionary<string, string>? Metadata { get; set; }
}

public class NotificationSummaryDto
{
    public int TotalCount { get; set; }
    public int OverduePayments { get; set; }
    public int FailedTransfers { get; set; }
    public int UpcomingExams { get; set; }
}


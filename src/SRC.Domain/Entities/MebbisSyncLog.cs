namespace SRC.Domain.Entities;

public class MebbisSyncLog : TenantEntity
{
    public int Id { get; set; }
    public string EntityType { get; set; } = string.Empty; // course, student, document
    public int EntityId { get; set; }
    public string Action { get; set; } = string.Empty; // send, approve, cancel
    public string Status { get; set; } = "success"; // success, failed
    public string? Payload { get; set; }
    public string? Response { get; set; }
    public string? Error { get; set; }
}



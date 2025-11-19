namespace SRC.Application.DTOs.Tenancy;

public class HqLicenseSummaryDto
{
    public int TotalLicenses { get; set; }
    public int ExpiringSoon { get; set; }
    public int Expired { get; set; }
    public int CreatedThisMonth { get; set; }
}

public class LicenseReminderLogDto
{
    public int Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string? Recipient { get; set; }
    public int ThresholdDays { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Error { get; set; }
}

public class AuditLogDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string? TenantId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Metadata { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class LicenseCsvLogDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string ActorName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int? TotalRows { get; set; }
    public int? Imported { get; set; }
    public int? Failed { get; set; }
    public int? Count { get; set; }
}

public class CsvSummaryDto
{
    public Dictionary<string, CsvSummaryPoint> Last7Days { get; set; } = new();
    public int TotalImports { get; set; }
    public int TotalExports { get; set; }
}

public class CsvSummaryPoint
{
    public int Imports { get; set; }
    public int Exports { get; set; }
}


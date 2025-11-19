namespace SRC.Application.DTOs.Tenancy;

public class HqTenantUsageDto
{
    public string TenantId { get; set; } = default!;
    public string TenantName { get; set; } = default!;
    public int TotalStudents { get; set; }
    public int ActiveStudents { get; set; }
    public DateTime? LastStudentCreatedAt { get; set; }
    public DateTime? ExpireDate { get; set; }
    public string? Username { get; set; }
    public string? City { get; set; }
}



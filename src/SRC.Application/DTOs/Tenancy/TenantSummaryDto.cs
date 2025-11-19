namespace SRC.Application.DTOs.Tenancy;

public class TenantSummaryDto
{
    public string Id { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? City { get; set; }
    public bool IsActive { get; set; }
}



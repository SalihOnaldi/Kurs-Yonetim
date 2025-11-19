namespace SRC.Domain.Entities;

public class AiQuery : TenantEntity
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Provider { get; set; } = "mock";
    public string? Metadata { get; set; }
}



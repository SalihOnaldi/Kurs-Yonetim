namespace SRC.Domain.Entities;

public class MebGroup : TenantEntity
{
    public int Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int GroupNo { get; set; }
    public string? Branch { get; set; } // Şube
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int Capacity { get; set; }
    public string Status { get; set; } = "draft"; // draft, active, completed

    // Navigation properties
    public ICollection<Course> Courses { get; set; } = new List<Course>();
}



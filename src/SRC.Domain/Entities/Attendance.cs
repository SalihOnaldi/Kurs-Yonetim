namespace SRC.Domain.Entities;

public class Attendance : TenantEntity
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public int ScheduleSlotId { get; set; }
    public bool IsPresent { get; set; }
    public string? Excuse { get; set; } // Mazeret açıklaması
    public decimal? GpsLat { get; set; }
    public decimal? GpsLng { get; set; }
    public decimal? GpsAccuracy { get; set; }
    public string? EvidenceUrl { get; set; }
    public bool FaceVerified { get; set; }
    public DateTime? MarkedAt { get; set; }

    // Navigation properties
    public Student Student { get; set; } = null!;
    public ScheduleSlot ScheduleSlot { get; set; } = null!;
}


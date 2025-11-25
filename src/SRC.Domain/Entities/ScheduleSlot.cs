namespace SRC.Domain.Entities;

public class ScheduleSlot : TenantEntity
{
    public int Id { get; set; }
    public int MebGroupId { get; set; } // CourseId yerine
    public int? InstructorId { get; set; } // User Id (Eğitmen)
    public int? ClassroomId { get; set; }
    public string? ClassroomName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Subject { get; set; } // Ders konusu
    public string? Notes { get; set; }

    // Navigation properties
    public MebGroup MebGroup { get; set; } = null!; // Course yerine
    public User? Instructor { get; set; }
    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
}



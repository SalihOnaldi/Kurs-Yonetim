namespace SRC.Domain.Entities;

public class Course : TenantEntity
{
    public int Id { get; set; }
    public int MebGroupId { get; set; }
    public int SrcType { get; set; } // 1-5 (SRC1-SRC5)
    public bool IsMixed { get; set; } // Karma sınıf (SRC1+SRC3 vb.)
    public string? MixedTypes { get; set; } // "SRC1,SRC3" gibi
    public int PlannedHours { get; set; }
    public string MebApprovalStatus { get; set; } = "draft"; // draft, pending, approved, rejected
    public DateTime? ApprovalAt { get; set; }
    public string? ApprovalNotes { get; set; }

    // Navigation properties
    public MebGroup MebGroup { get; set; } = null!;
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<ScheduleSlot> ScheduleSlots { get; set; } = new List<ScheduleSlot>();
    public ICollection<Exam> Exams { get; set; } = new List<Exam>();
    public ICollection<MebbisTransferJob> MebbisTransferJobs { get; set; } = new List<MebbisTransferJob>();
}


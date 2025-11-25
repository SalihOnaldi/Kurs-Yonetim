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

    // Kurs bilgileri (Course'dan taşınan)
    public int SrcType { get; set; } // 1-5 (SRC1-SRC5)
    public bool IsMixed { get; set; } // Karma sınıf (SRC1+SRC3 vb.)
    public string? MixedTypes { get; set; } // "SRC1,SRC3" gibi
    public int PlannedHours { get; set; } = 40;
    public string MebApprovalStatus { get; set; } = "draft"; // draft, pending, approved, rejected
    public DateTime? ApprovalAt { get; set; }
    public string? ApprovalNotes { get; set; }

    // Navigation properties (Course kaldırıldığı için)
    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<ScheduleSlot> ScheduleSlots { get; set; } = new List<ScheduleSlot>();
    public ICollection<Exam> Exams { get; set; } = new List<Exam>();
    public ICollection<MebbisTransferJob> MebbisTransferJobs { get; set; } = new List<MebbisTransferJob>();
    public ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
}



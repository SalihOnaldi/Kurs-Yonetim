namespace SRC.Domain.Entities;

public class StudentDocument : TenantEntity
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string DocumentType { get; set; } = string.Empty; // kimlik, foto, diploma, adli_sicil, surucu_belgesi, vb.
    public string FileUrl { get; set; } = string.Empty; // MinIO path
    public string? DocNo { get; set; } // OCR çıktısı
    public DateTime? DocDate { get; set; } // OCR çıktısı
    public decimal? OcrConfidence { get; set; } // 0.00-1.00
    public bool IsRequired { get; set; } = true;
    public string ValidationStatus { get; set; } = "pending"; // pending, approved, rejected
    public string? ValidationNotes { get; set; }

    // Navigation property
    public Student Student { get; set; } = null!;
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
}


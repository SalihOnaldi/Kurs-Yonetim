namespace SRC.Application.DTOs.Student;

public class StudentDocumentDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileUrl { get; set; } = string.Empty;
    public string? DocNo { get; set; }
    public DateTime? DocDate { get; set; }
    public decimal? OcrConfidence { get; set; }
    public bool IsRequired { get; set; }
    public string ValidationStatus { get; set; } = string.Empty;
    public string? ValidationNotes { get; set; }
    public DateTime CreatedAt { get; set; }
}


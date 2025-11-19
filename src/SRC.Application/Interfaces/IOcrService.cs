namespace SRC.Application.Interfaces;

public class OcrResult
{
    public string? DocNo { get; set; }
    public DateTime? DocDate { get; set; }
    public decimal Confidence { get; set; }
}

public interface IOcrService
{
    Task<OcrResult> ProcessDocumentAsync(Stream fileStream, string documentType);
}


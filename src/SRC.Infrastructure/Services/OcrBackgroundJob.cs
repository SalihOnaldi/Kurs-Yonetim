using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Tenancy;
using SRC.Infrastructure.Data;

namespace SRC.Infrastructure.Services;

public class OcrBackgroundJob
{
    private readonly SrcDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IFileStorageService _fileStorageService;
    private readonly IOcrService _ocrService;

    public OcrBackgroundJob(
        SrcDbContext context,
        ITenantProvider tenantProvider,
        IFileStorageService fileStorageService,
        IOcrService ocrService)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _fileStorageService = fileStorageService;
        _ocrService = ocrService;
    }

    public async Task ProcessDocumentAsync(string tenantId, int documentId)
    {
        _tenantProvider.SetTenant(tenantId);

        var document = await _context.StudentDocuments.FindAsync(documentId);
        if (document == null) return;

        try
        {
            var fileStream = await _fileStorageService.DownloadFileAsync(document.FileUrl);
            var ocrResult = await _ocrService.ProcessDocumentAsync(fileStream, document.DocumentType);

            document.DocNo = ocrResult.DocNo;
            document.DocDate = ocrResult.DocDate;
            document.OcrConfidence = ocrResult.Confidence;
            document.UpdatedAt = DateTime.UtcNow;

            // Auto-approve if confidence >= 0.85
            if (ocrResult.Confidence >= 0.85m)
            {
                document.ValidationStatus = "approved";
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Log error
            document.ValidationStatus = "rejected";
            document.ValidationNotes = $"OCR Error: {ex.Message}";
            document.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}


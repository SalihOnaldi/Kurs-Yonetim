using SRC.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Linq;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace SRC.Infrastructure.Services;

public class OcrService : IOcrService
{
    private readonly IConfiguration _configuration;
    private static readonly Encoding[] PreferredEncodings = new[]
    {
        Encoding.UTF8,
        Encoding.GetEncoding("ISO-8859-9"),
        Encoding.GetEncoding(1254),
        Encoding.ASCII
    };

    public OcrService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<OcrResult> ProcessDocumentAsync(Stream fileStream, string documentType)
    {
        var isOcrEnabled = _configuration["OCR_ENABLED"] == "true";
        if (!isOcrEnabled)
        {
            return new OcrResult { Confidence = 0 };
        }

        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
        }

        if (!string.Equals(documentType, "adli_sicil", StringComparison.OrdinalIgnoreCase))
        {
            return new OcrResult { Confidence = 0 };
        }

        using var ms = new MemoryStream();
        await fileStream.CopyToAsync(ms);
        var buffer = ms.ToArray();

        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
        }

        var text = ExtractPdfText(buffer) ?? ExtractTextWithEncodings(buffer);
        if (!string.IsNullOrWhiteSpace(text))
        {
            var sayiValue = ExtractSayiValue(text);
            if (!string.IsNullOrEmpty(sayiValue))
            {
                return new OcrResult
                {
                    DocNo = sayiValue,
                    Confidence = 0.95m
                };
            }
        }

        return new OcrResult
        {
            Confidence = 0.5m,
            DocNo = null
        };
    }

    private string? ExtractPdfText(byte[] buffer)
    {
        try
        {
            using var memoryStream = new MemoryStream(buffer);
            using var document = PdfDocument.Open(memoryStream);
            var sb = new StringBuilder();
            foreach (Page page in document.GetPages())
            {
                sb.AppendLine(page.Text);
            }
            return sb.ToString();
        }
        catch
        {
            return null;
        }
    }

    private string? ExtractTextWithEncodings(byte[] buffer)
    {
        foreach (var encoding in PreferredEncodings)
        {
            try
            {
                var text = encoding.GetString(buffer);
                if (!string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }
            catch
            {
                // ignore encoding errors
            }
        }

        return null;
    }

    private string? ExtractSayiValue(string text)
    {
        var match = Regex.Match(text, @"SAYI\s*[:\-]?\s*([A-Za-z0-9\/\.\-\s]+)", RegexOptions.IgnoreCase);
        if (!match.Success)
        {
            return null;
        }

        var value = match.Groups[1].Value.Trim();
        value = value.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                     .FirstOrDefault()?.Trim() ?? value;
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }
}




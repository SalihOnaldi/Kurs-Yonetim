using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Certificate;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Tenancy;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using SRC.Infrastructure.Utilities;

namespace SRC.Infrastructure.Services;

public class CertificateService : ICertificateService
{
    private readonly SrcDbContext _context;
    private readonly ITenantProvider _tenantProvider;

    public CertificateService(SrcDbContext context, ITenantProvider tenantProvider)
    {
        _context = context;
        _tenantProvider = tenantProvider;
    }

    public async Task<CertificateDto> GenerateCertificateAsync(int studentId, int mebGroupId, int writtenExamId, int practicalExamId)
    {
        // Öğrenci ve sınıf bilgilerini kontrol et
        var student = await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null)
        {
            throw new ArgumentException("Öğrenci bulunamadı.", nameof(studentId));
        }

        var group = await _context.MebGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == mebGroupId);

        if (group == null)
        {
            throw new ArgumentException("Sınıf bulunamadı.", nameof(mebGroupId));
        }

        // Yazılı ve pratik sınav sonuçlarını kontrol et
        var writtenResult = await _context.ExamResults
            .AsNoTracking()
            .FirstOrDefaultAsync(er => er.ExamId == writtenExamId && er.StudentId == studentId && er.Pass);

        var practicalResult = await _context.ExamResults
            .AsNoTracking()
            .FirstOrDefaultAsync(er => er.ExamId == practicalExamId && er.StudentId == studentId && er.Pass);

        if (writtenResult == null || practicalResult == null)
        {
            throw new InvalidOperationException("Öğrenci her iki sınavı da geçmiş olmalıdır.");
        }

        // Zaten sertifika var mı kontrol et
        var existingCertificate = await _context.Certificates
            .AsNoTracking()
            .FirstOrDefaultAsync(c =>
                c.StudentId == studentId &&
                c.MebGroupId == mebGroupId &&
                c.WrittenExamId == writtenExamId &&
                c.PracticalExamId == practicalExamId &&
                c.Status == "active");

        if (existingCertificate != null)
        {
            return await GetCertificateAsync(existingCertificate.Id) ?? throw new InvalidOperationException("Sertifika bulunamadı.");
        }

        // Unique sertifika numarası üret (transaction içinde)
        string certificateNumber;
        Certificate certificate;
        
        // Transaction kullanarak race condition'ı önle
        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            certificateNumber = await GenerateUniqueCertificateNumberAsync(_tenantProvider.TenantId);

            certificate = new Certificate
            {
                StudentId = studentId,
                MebGroupId = mebGroupId,
                WrittenExamId = writtenExamId,
                PracticalExamId = practicalExamId,
                CertificateNumber = certificateNumber,
                IssueDate = DateTime.UtcNow,
                Status = "active"
            };

            _context.Certificates.Add(certificate);
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        // Transaction commit sonrası sertifikayı tekrar yükle (tracking için)
        var savedCertificate = await _context.Certificates
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.MebGroup)
            .FirstOrDefaultAsync(c => c.Id == certificate.Id);

        if (savedCertificate == null || savedCertificate.Student == null || savedCertificate.MebGroup == null)
        {
            throw new InvalidOperationException("Sertifika oluşturuldu ancak yüklenemedi.");
        }

        // Sertifika oluşturulduğunda bir sonraki kurs için hatırlatma oluştur
        await CreateNextCourseReminderAsync(savedCertificate.StudentId, savedCertificate.MebGroup.SrcType);

        return new CertificateDto
        {
            Id = savedCertificate.Id,
            StudentId = savedCertificate.StudentId,
            StudentName = savedCertificate.Student.FirstName,
            StudentLastName = savedCertificate.Student.LastName,
            StudentTcKimlikNo = savedCertificate.Student.TcKimlikNo,
            MebGroupId = savedCertificate.MebGroupId,
            CourseName = MebNamingHelper.BuildGroupName(savedCertificate.MebGroup),
            SrcType = savedCertificate.MebGroup.SrcType,
            WrittenExamId = savedCertificate.WrittenExamId,
            PracticalExamId = savedCertificate.PracticalExamId,
            CertificateNumber = savedCertificate.CertificateNumber,
            IssueDate = savedCertificate.IssueDate,
            Status = savedCertificate.Status,
            RevokeReason = savedCertificate.RevokeReason,
            RevokedAt = savedCertificate.RevokedAt
        };
    }

    private async Task CreateNextCourseReminderAsync(int studentId, int completedSrcType)
    {
        // Öğrencinin "next_course_preparation" tipindeki bekleyen hatırlatmalarını bul
        var pendingReminders = await _context.Reminders
            .Where(r => r.StudentId == studentId && 
                       r.Type == "next_course_preparation" && 
                       r.Status == "pending")
            .ToListAsync();

        if (pendingReminders.Count == 0)
        {
            return; // Bir sonraki kurs için hatırlatma yoksa çık
        }

        // Tamamlanan kurstan sonraki kurs için hatırlatmayı aktif et
        var nextSrcType = completedSrcType + 1;
        var nextReminder = pendingReminders
            .FirstOrDefault(r => r.Message.Contains($"SRC{nextSrcType}"));

        if (nextReminder != null)
        {
            // Hatırlatmayı hemen aktif et (1 gün sonra gönder)
            nextReminder.ScheduledAt = DateTime.UtcNow.AddDays(1);
            nextReminder.Status = "pending";
            nextReminder.Title = $"SRC{nextSrcType} kursu için belge hazırlığı";
            nextReminder.Message = $"SRC{completedSrcType} kursunu başarıyla tamamladınız. SRC{nextSrcType} kursu için belgelerinizi hazırlamanız gerekmektedir.";
            await _context.SaveChangesAsync();
        }
    }

    public async Task<string> GenerateUniqueCertificateNumberAsync(string tenantId)
    {
        // Format: TENANT-YIL-AY-SIRA (örn: TENANT-2025-11-0001)
        var now = DateTime.UtcNow;
        var year = now.Year;
        var month = now.Month.ToString("D2");

        // Bu ay için son sertifika numarasını bul
        var lastCertificate = await _context.Certificates
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId &&
                       c.CertificateNumber.StartsWith($"{tenantId}-{year}-{month}-"))
            .OrderByDescending(c => c.CertificateNumber)
            .FirstOrDefaultAsync();

        int sequence = 1;
        if (lastCertificate != null)
        {
            var parts = lastCertificate.CertificateNumber.Split('-');
            if (parts.Length >= 4 && int.TryParse(parts[3], out var lastSeq))
            {
                sequence = lastSeq + 1;
            }
        }

        return $"{tenantId}-{year}-{month}-{sequence:D4}";
    }

    public async Task<CertificateDto?> GetCertificateAsync(int certificateId)
    {
        var certificate = await _context.Certificates
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.MebGroup)
            .FirstOrDefaultAsync(c => c.Id == certificateId);

        if (certificate == null || certificate.Student == null || certificate.MebGroup == null)
        {
            return null;
        }

        return new CertificateDto
        {
            Id = certificate.Id,
            StudentId = certificate.StudentId,
            StudentName = certificate.Student.FirstName,
            StudentLastName = certificate.Student.LastName,
            StudentTcKimlikNo = certificate.Student.TcKimlikNo,
            MebGroupId = certificate.MebGroupId,
            CourseName = MebNamingHelper.BuildGroupName(certificate.MebGroup),
            SrcType = certificate.MebGroup.SrcType,
            WrittenExamId = certificate.WrittenExamId,
            PracticalExamId = certificate.PracticalExamId,
            CertificateNumber = certificate.CertificateNumber,
            IssueDate = certificate.IssueDate,
            Status = certificate.Status,
            RevokeReason = certificate.RevokeReason,
            RevokedAt = certificate.RevokedAt
        };
    }

    public async Task<List<CertificateDto>> GetCertificatesByStudentAsync(int studentId)
    {
        return await _context.Certificates
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.MebGroup)
            .Where(c => c.StudentId == studentId)
            .OrderByDescending(c => c.IssueDate)
            .Select(c => new CertificateDto
            {
                Id = c.Id,
                StudentId = c.StudentId,
                StudentName = c.Student.FirstName,
                StudentLastName = c.Student.LastName,
                StudentTcKimlikNo = c.Student.TcKimlikNo,
                MebGroupId = c.MebGroupId,
                CourseName = MebNamingHelper.BuildGroupName(c.MebGroup),
                SrcType = c.MebGroup.SrcType,
                WrittenExamId = c.WrittenExamId,
                PracticalExamId = c.PracticalExamId,
                CertificateNumber = c.CertificateNumber,
                IssueDate = c.IssueDate,
                Status = c.Status,
                RevokeReason = c.RevokeReason,
                RevokedAt = c.RevokedAt
            })
            .ToListAsync();
    }

    public async Task<List<CertificateDto>> GetCertificatesByMebGroupAsync(int mebGroupId)
    {
        return await _context.Certificates
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.MebGroup)
            .Where(c => c.MebGroupId == mebGroupId)
            .OrderBy(c => c.Student.LastName)
            .ThenBy(c => c.Student.FirstName)
            .Select(c => new CertificateDto
            {
                Id = c.Id,
                StudentId = c.StudentId,
                StudentName = c.Student.FirstName,
                StudentLastName = c.Student.LastName,
                StudentTcKimlikNo = c.Student.TcKimlikNo,
                MebGroupId = c.MebGroupId,
                CourseName = MebNamingHelper.BuildGroupName(c.MebGroup),
                SrcType = c.MebGroup.SrcType,
                WrittenExamId = c.WrittenExamId,
                PracticalExamId = c.PracticalExamId,
                CertificateNumber = c.CertificateNumber,
                IssueDate = c.IssueDate,
                Status = c.Status,
                RevokeReason = c.RevokeReason,
                RevokedAt = c.RevokedAt
            })
            .ToListAsync();
    }

    public async Task<CertificateReportDto> GenerateCertificateReportAsync(int certificateId)
    {
        var certificate = await _context.Certificates
            .AsNoTracking()
            .Include(c => c.Student)
            .Include(c => c.MebGroup)
            .FirstOrDefaultAsync(c => c.Id == certificateId);

        if (certificate == null)
        {
            throw new ArgumentException("Sertifika bulunamadı.", nameof(certificateId));
        }

        var mebHeaderText = $"T.C. MİLLÎ EĞİTİM BAKANLIĞI\n{certificate.MebGroup.Branch ?? "GENEL MÜDÜRLÜK"}\nSRC KURSU SERTİFİKASI";

        return new CertificateReportDto
        {
            CertificateNumber = certificate.CertificateNumber,
            StudentFullName = $"{certificate.Student.FirstName} {certificate.Student.LastName}",
            StudentTcKimlikNo = certificate.Student.TcKimlikNo,
            CourseName = MebNamingHelper.BuildGroupName(certificate.MebGroup),
            SrcType = certificate.MebGroup.SrcType,
            IssueDate = certificate.IssueDate,
            MebHeaderText = mebHeaderText
        };
    }
}


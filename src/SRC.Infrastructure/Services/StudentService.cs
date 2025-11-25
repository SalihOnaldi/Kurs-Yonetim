using System;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SRC.Application.DTOs.Student;
using SRC.Application.Interfaces;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using Serilog;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Primitives;
using SRC.Application.Options;
using SRC.Application.Interfaces.Tenancy;

namespace SRC.Infrastructure.Services;

public class StudentService : IStudentService
{
    private readonly SrcDbContext _context;
    private readonly IFileStorageService _fileStorageService;
    private readonly IOcrService _ocrService;
    private readonly ITenantProvider _tenantProvider;
    private readonly ICommunicationService _communicationService;
    private readonly IMemoryCache _cache;
    private readonly PaymentDefaultsOptions _paymentDefaults;
    private static readonly MemoryCacheEntryOptions DetailCacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2)
    };
    private static readonly TimeSpan SearchCacheDuration = TimeSpan.FromSeconds(30);
    private static CancellationTokenSource _searchCacheTokenSource = new();

    public StudentService(
        SrcDbContext context,
        IFileStorageService fileStorageService,
        IOcrService ocrService,
        ITenantProvider tenantProvider,
        IMemoryCache cache,
        ICommunicationService communicationService,
        IOptions<PaymentDefaultsOptions> paymentDefaults)
    {
        _context = context;
        _fileStorageService = fileStorageService;
        _ocrService = ocrService;
        _tenantProvider = tenantProvider;
        _cache = cache;
        _communicationService = communicationService;
        _paymentDefaults = paymentDefaults.Value;
    }

    public async Task<List<StudentDto>> GetAllAsync()
    {
        return await _context.Students
            .AsNoTracking()
            .OrderBy(s => s.LastName)
            .ThenBy(s => s.FirstName)
            .Select(s => new StudentDto
            {
                Id = s.Id,
                TcKimlikNo = s.TcKimlikNo,
                FirstName = s.FirstName,
                LastName = s.LastName,
                BirthDate = s.BirthDate,
                Phone = s.Phone,
                Email = s.Email,
                Address = s.Address,
                EducationLevel = s.EducationLevel,
                LicenseType = s.LicenseType,
                LicenseIssueDate = s.LicenseIssueDate,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<List<StudentListItemDto>> SearchAsync(StudentListFilter filter)
    {
        filter ??= new StudentListFilter();
        var cacheKey = BuildSearchCacheKey(filter);
        if (_cache.TryGetValue(cacheKey, out List<StudentListItemDto>? cachedResult) && cachedResult != null)
        {
            return cachedResult;
        }

        var now = DateTime.UtcNow;
        var query = _context.Students
            .AsNoTracking()
            .Include(s => s.Enrollments)
                .ThenInclude(e => e.MebGroup)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLower();
            query = query.Where(s =>
                s.TcKimlikNo.ToLower().Contains(search) ||
                s.FirstName.ToLower().Contains(search) ||
                s.LastName.ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(filter.Branch))
        {
            var branch = filter.Branch.Trim().ToLower();
            query = query.Where(s =>
                s.Enrollments.Any(e =>
                    e.MebGroup.Branch != null &&
                    e.MebGroup.Branch.ToLower() == branch));
        }

        if (filter.HasActiveCourse.HasValue)
        {
            if (filter.HasActiveCourse.Value)
            {
                query = query.Where(s =>
                    s.Enrollments.Any(e =>
                        e.Status == "active" &&
                        e.MebGroup.StartDate <= now &&
                        e.MebGroup.EndDate >= now));
            }
            else
            {
                query = query.Where(s =>
                    !s.Enrollments.Any(e =>
                        e.Status == "active" &&
                        e.MebGroup.StartDate <= now &&
                        e.MebGroup.EndDate >= now));
            }
        }

        var data = await query
            .OrderBy(s => s.LastName)
            .ThenBy(s => s.FirstName)
            .Select(s => new
            {
                s.Id,
                s.TcKimlikNo,
                s.FirstName,
                s.LastName,
                s.Phone,
                s.Email,
                Enrollments = s.Enrollments
                    .OrderByDescending(e => e.EnrollmentDate)
                    .Select(e => new
                    {
                        e.EnrollmentDate,
                        e.Status,
                        e.MebGroup.SrcType,
                        Group = new
                        {
                            e.MebGroup.Year,
                            e.MebGroup.Month,
                            e.MebGroup.GroupNo,
                            e.MebGroup.Branch,
                            e.MebGroup.StartDate,
                            e.MebGroup.EndDate
                        }
                    })
            })
            .ToListAsync();

        var result = new List<StudentListItemDto>(data.Count);

        foreach (var item in data)
        {
            var enrollments = item.Enrollments.ToList();
            var latest = enrollments.FirstOrDefault();
            var hasActiveCourse = enrollments.Any(e =>
                e.Status == "active" &&
                e.Group.StartDate <= now &&
                e.Group.EndDate >= now);

            result.Add(new StudentListItemDto
            {
                Id = item.Id,
                TcKimlikNo = item.TcKimlikNo,
                FirstName = item.FirstName,
                LastName = item.LastName,
                Phone = item.Phone,
                Email = item.Email,
                BranchName = latest?.Group.Branch,
                LastCourseName = latest != null
                    ? BuildCourseName(latest.SrcType, latest.Group.Month, latest.Group.Year, latest.Group.GroupNo, latest.Group.Branch)
                    : null,
                HasActiveCourse = hasActiveCourse,
                LastEnrollmentDate = latest?.EnrollmentDate
            });
        }

        _cache.Set(cacheKey, result, CreateSearchCacheEntryOptions());

        return result;
    }

    public async Task<StudentDetailDto?> GetDetailAsync(int id)
    {
        var cacheKey = $"student:detail:{id}";
        if (_cache.TryGetValue(cacheKey, out StudentDetailDto? cachedDetail))
        {
            return cachedDetail;
        }

        var student = await _context.Students
            .AsNoTracking()
            .Include(s => s.Documents)
            .Include(s => s.Enrollments)
                .ThenInclude(e => e.MebGroup)
            .Include(s => s.Payments)
                .ThenInclude(p => p.Enrollment!)
                    .ThenInclude(e => e.MebGroup)
            .Include(s => s.ExamResults)
                .ThenInclude(er => er.Exam)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var examAttemptsByGroup = student.ExamResults
            .GroupBy(er => er.Exam.MebGroupId)
            .ToDictionary(g => g.Key, g => g.Count());

        var profile = new StudentDto
        {
            Id = student.Id,
            TcKimlikNo = student.TcKimlikNo,
            FirstName = student.FirstName,
            LastName = student.LastName,
            BirthDate = student.BirthDate,
            Phone = student.Phone,
            Email = student.Email,
            Address = student.Address,
            EducationLevel = student.EducationLevel,
            LicenseType = student.LicenseType,
            LicenseIssueDate = student.LicenseIssueDate,
            CreatedAt = student.CreatedAt
        };

        var documents = student.Documents
            .OrderBy(d => d.DocumentType)
            .Select(d => new StudentDocumentDto
            {
                Id = d.Id,
                StudentId = d.StudentId,
                DocumentType = d.DocumentType,
                FileUrl = d.FileUrl,
                DocNo = d.DocNo,
                DocDate = d.DocDate,
                OcrConfidence = d.OcrConfidence,
                IsRequired = d.IsRequired,
                ValidationStatus = d.ValidationStatus,
                ValidationNotes = d.ValidationNotes,
                CreatedAt = d.CreatedAt
            })
            .ToList();

        var enrollments = student.Enrollments
            .OrderByDescending(e => e.EnrollmentDate)
            .Select(e =>
            {
                var group = e.MebGroup;
                var summary = new MebGroupSummaryDto
                {
                    Year = group.Year,
                    Month = group.Month,
                    GroupNo = group.GroupNo,
                    Branch = group.Branch,
                    StartDate = group.StartDate,
                    EndDate = group.EndDate
                };

                var courseName = BuildCourseName(group.SrcType, group.Month, group.Year, group.GroupNo, group.Branch);
                examAttemptsByGroup.TryGetValue(e.MebGroupId, out var attemptCount);

                return new StudentEnrollmentSummaryDto
                {
                    EnrollmentId = e.Id,
                    MebGroupId = e.MebGroupId,
                    CourseName = courseName,
                    Status = e.Status,
                    EnrollmentDate = e.EnrollmentDate,
                    SrcType = group.SrcType,
                    Group = summary,
                    IsActive = e.Status == "active" && group.StartDate <= now && group.EndDate >= now,
                    ExamAttemptCount = attemptCount
                };
            })
            .ToList();

        var payments = student.Payments
            .OrderByDescending(p => p.DueDate)
            .Select(p =>
            {
                EnrollmentCourseSummaryDto? enrollmentSummary = null;
                if (p.Enrollment != null)
                {
                    var group = p.Enrollment.MebGroup;
                    enrollmentSummary = new EnrollmentCourseSummaryDto
                    {
                        MebGroupId = p.Enrollment.MebGroupId,
                        CourseName = BuildCourseName(group.SrcType, group.Month, group.Year, group.GroupNo, group.Branch),
                        Group = new MebGroupSummaryDto
                        {
                            Year = group.Year,
                            Month = group.Month,
                            GroupNo = group.GroupNo,
                            Branch = group.Branch,
                            StartDate = group.StartDate,
                            EndDate = group.EndDate
                        },
                        SrcType = group.SrcType
                    };
                }

                return new StudentPaymentSummaryDto
                {
                    PaymentId = p.Id,
                    Amount = p.Amount,
                    PenaltyAmount = p.PenaltyAmount,
                    PaymentType = p.PaymentType,
                    Status = p.Status,
                    DueDate = p.DueDate,
                    PaidDate = p.PaidDate,
                    ReceiptNo = p.ReceiptNo,
                    Description = p.Description,
                    EnrollmentId = p.EnrollmentId,
                    Enrollment = enrollmentSummary
                };
            })
            .ToList();

        var outstandingBalance = payments
            .Where(p => p.Status == "pending")
            .Sum(p => p.Amount + (p.PenaltyAmount ?? 0m));

        var detail = new StudentDetailDto
        {
            Profile = profile,
            Documents = documents,
            Enrollments = enrollments,
            Payments = payments,
            OutstandingBalance = outstandingBalance
        };

        _cache.Set(cacheKey, detail, DetailCacheOptions);

        return detail;
    }

    public async Task<StudentDto?> GetByIdAsync(int id)
    {
        var student = await _context.Students.FindAsync(id);
        if (student == null) return null;

        return new StudentDto
        {
            Id = student.Id,
            TcKimlikNo = student.TcKimlikNo,
            FirstName = student.FirstName,
            LastName = student.LastName,
            BirthDate = student.BirthDate,
            Phone = student.Phone,
            Email = student.Email,
            Address = student.Address,
            EducationLevel = student.EducationLevel,
            LicenseType = student.LicenseType,
            LicenseIssueDate = student.LicenseIssueDate,
            CreatedAt = student.CreatedAt
        };
    }

    public async Task<StudentDto> CreateAsync(CreateStudentRequest request)
    {
        Log.Information("Creating student with TC: {TcKimlikNo}", request.TcKimlikNo);
        
        Student? student = null;
        
        try
        {
            // Validasyon
            if (string.IsNullOrWhiteSpace(request.TcKimlikNo))
            {
                Log.Warning("TC Kimlik No is empty");
                throw new ArgumentException("TC Kimlik No gereklidir.");
            }

            if (string.IsNullOrWhiteSpace(request.FirstName))
            {
                Log.Warning("First name is empty");
                throw new ArgumentException("Ad gereklidir.");
            }

            if (string.IsNullOrWhiteSpace(request.LastName))
            {
                Log.Warning("Last name is empty");
                throw new ArgumentException("Soyad gereklidir.");
            }

            // String length validasyonu - DoS koruması
            const int maxNameLength = 200; // Makul bir maksimum uzunluk
            if (request.FirstName != null && request.FirstName.Length > maxNameLength)
            {
                Log.Warning("First name too long: {Length}", request.FirstName.Length);
                throw new ArgumentException($"Ad en fazla {maxNameLength} karakter olabilir.");
            }

            if (request.LastName.Length > maxNameLength)
            {
                Log.Warning("Last name too long: {Length}", request.LastName.Length);
                throw new ArgumentException($"Soyad en fazla {maxNameLength} karakter olabilir.");
            }

            if (!string.IsNullOrWhiteSpace(request.Phone) && request.Phone.Length > 50)
            {
                Log.Warning("Phone too long: {Length}", request.Phone.Length);
                throw new ArgumentException("Telefon numarası en fazla 50 karakter olabilir.");
            }

            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                if (request.Email.Length > 255)
                {
                    Log.Warning("Email too long: {Length}", request.Email.Length);
                    throw new ArgumentException("E-posta adresi en fazla 255 karakter olabilir.");
                }
                
                // Email format validasyonu
                try
                {
                    var emailRegex = new System.Text.RegularExpressions.Regex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (!emailRegex.IsMatch(request.Email))
                    {
                        Log.Warning("Invalid email format: {Email}", request.Email);
                        throw new ArgumentException("Geçersiz e-posta adresi formatı.");
                    }
                }
                catch (ArgumentException)
                {
                    throw; // Re-throw validation errors
                }
            }

            if (!string.IsNullOrWhiteSpace(request.Address) && request.Address.Length > 500)
            {
                Log.Warning("Address too long: {Length}", request.Address.Length);
                throw new ArgumentException("Adres en fazla 500 karakter olabilir.");
            }

            var tcKimlikNo = request.TcKimlikNo!.Trim();

            // TC Kimlik No format validasyonu (11 haneli olmalı, sadece rakam)
            if (tcKimlikNo.Length != 11 || !tcKimlikNo.All(char.IsDigit))
            {
                Log.Warning("Invalid TC Kimlik No format: {TcKimlikNo}", tcKimlikNo);
                throw new ArgumentException("TC Kimlik No 11 haneli olmalı ve sadece rakam içermelidir.");
            }

            // BirthDate validasyonu - gelecek tarih olamaz
            if (request.BirthDate.HasValue)
            {
                var birthDate = request.BirthDate.Value;
                var today = DateTime.UtcNow.Date;
                
                // Gelecek tarih kontrolü
                if (birthDate.Date > today)
                {
                    Log.Warning("Future birth date provided: {BirthDate}", birthDate);
                    throw new ArgumentException("Doğum tarihi gelecek bir tarih olamaz.");
                }
                
                // Çok eski tarih kontrolü (örneğin 150 yıldan eski)
                var minDate = today.AddYears(-150);
                if (birthDate.Date < minDate)
                {
                    Log.Warning("Birth date too old: {BirthDate}", birthDate);
                    throw new ArgumentException("Doğum tarihi çok eski bir tarih olamaz.");
                }
            }

            // TC Kimlik No unique kontrolü
            Log.Debug("Checking for existing student with TC: {TcKimlikNo}", request.TcKimlikNo);
            var existingStudent = await _context.Students
                .FirstOrDefaultAsync(s => s.TcKimlikNo == tcKimlikNo);
            
            if (existingStudent != null)
            {
                Log.Warning("Student with TC {TcKimlikNo} already exists", request.TcKimlikNo);
                throw new InvalidOperationException($"Bu TC Kimlik No ({tcKimlikNo}) ile kayıtlı kursiyer zaten mevcut.");
            }

            student = new Student
            {
                TcKimlikNo = tcKimlikNo,
                FirstName = request.FirstName?.Trim() ?? "",
                LastName = request.LastName?.Trim() ?? "",
                BirthDate = request.BirthDate,
                Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone?.Trim(),
                Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email?.Trim(),
                Address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address?.Trim(),
                EducationLevel = string.IsNullOrWhiteSpace(request.EducationLevel) ? null : request.EducationLevel?.Trim(),
                LicenseType = string.IsNullOrWhiteSpace(request.LicenseType) ? null : request.LicenseType?.Trim(),
                LicenseIssueDate = request.LicenseIssueDate,
                SelectedSrcCourses = request.SelectedSrcCourses != null && request.SelectedSrcCourses.Count > 0
                    ? string.Join(",", request.SelectedSrcCourses.OrderBy(x => x))
                    : null,
                CreatedAt = DateTime.UtcNow
            };

            Log.Debug("Adding student to context");
            _context.Students.Add(student);
            
            try
            {
                Log.Debug("Saving changes to database");
                await _context.SaveChangesAsync();
                await CreateDefaultPaymentIfNeededAsync(student);
                
                // SRC kursları için hatırlatmalar oluştur
                if (request.SelectedSrcCourses != null && request.SelectedSrcCourses.Count > 0)
                {
                    await CreateCourseRemindersAsync(student, request.SelectedSrcCourses);
                }
                
                Log.Information("Student created successfully with ID: {StudentId}", student.Id);
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            {
                Log.Error(ex, "Database update exception while creating student");
                var innerMessage = ex.InnerException?.Message ?? string.Empty;
                Log.Error("Inner exception: {InnerMessage}", innerMessage);
                
                if (!string.IsNullOrEmpty(innerMessage) &&
                    (innerMessage.Contains("UNIQUE") || innerMessage.Contains("TcKimlikNo") || innerMessage.Contains("duplicate")))
                {
                    throw new InvalidOperationException($"Bu TC Kimlik No ({tcKimlikNo}) ile kayıtlı kursiyer zaten mevcut.");
                }
                if (!string.IsNullOrEmpty(innerMessage))
                {
                    throw new InvalidOperationException($"Veritabanı hatası: {innerMessage}");
                }
                throw new InvalidOperationException("Veritabanı hatası meydana geldi.");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Unexpected error while saving student");
                throw new InvalidOperationException($"Kursiyer eklenirken hata oluştu: {ex.Message}");
            }
        }
        catch (ArgumentException)
        {
            throw; // Re-throw validation errors
        }
        catch (InvalidOperationException)
        {
            throw; // Re-throw business logic errors
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error in CreateAsync");
            throw new InvalidOperationException($"Kursiyer eklenirken beklenmeyen hata oluştu: {ex.Message}");
        }

        if (student == null)
        {
            throw new InvalidOperationException("Kursiyer oluşturulamadı.");
        }

        _cache.Remove($"student:detail:{student.Id}");
        InvalidateSearchCache();

        await SendWelcomeNotificationsAsync(student);

        return new StudentDto
        {
            Id = student.Id,
            TcKimlikNo = student.TcKimlikNo,
            FirstName = student.FirstName,
            LastName = student.LastName,
            BirthDate = student.BirthDate,
            Phone = student.Phone,
            Email = student.Email,
            Address = student.Address,
            EducationLevel = student.EducationLevel,
            LicenseType = student.LicenseType,
            LicenseIssueDate = student.LicenseIssueDate,
            CreatedAt = student.CreatedAt
        };
    }

    public async Task<StudentDto?> UpdateAsync(int id, UpdateStudentRequest request)
    {
        var student = await _context.Students.FindAsync(id);
        if (student == null) return null;

        if (!string.IsNullOrEmpty(request.FirstName)) student.FirstName = request.FirstName;
        if (!string.IsNullOrEmpty(request.LastName)) student.LastName = request.LastName;
        
        // BirthDate validasyonu - gelecek tarih olamaz
        if (request.BirthDate.HasValue)
        {
            var birthDate = request.BirthDate.Value;
            var today = DateTime.UtcNow.Date;
            
            // Gelecek tarih kontrolü
            if (birthDate.Date > today)
            {
                Log.Warning("Future birth date provided in update: {BirthDate}", birthDate);
                throw new ArgumentException("Doğum tarihi gelecek bir tarih olamaz.");
            }
            
            // Çok eski tarih kontrolü (örneğin 150 yıldan eski)
            var minDate = today.AddYears(-150);
            if (birthDate.Date < minDate)
            {
                Log.Warning("Birth date too old in update: {BirthDate}", birthDate);
                throw new ArgumentException("Doğum tarihi çok eski bir tarih olamaz.");
            }
            
            student.BirthDate = request.BirthDate;
        }
        if (request.Phone != null) student.Phone = request.Phone;
        if (request.Email != null) student.Email = request.Email;
        if (request.Address != null) student.Address = request.Address;
        if (request.EducationLevel != null) student.EducationLevel = request.EducationLevel;
        if (request.LicenseType != null) student.LicenseType = request.LicenseType;
        if (request.LicenseIssueDate.HasValue) student.LicenseIssueDate = request.LicenseIssueDate;
        student.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _cache.Remove($"student:detail:{id}");
        InvalidateSearchCache();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var student = await _context.Students
            .FirstOrDefaultAsync(s => s.Id == id);
            
        if (student == null) return false;

        // İlişkili kayıtları kontrol et ve sil
        // Önce tüm ilişkili kayıtları yükle
        var enrollments = await _context.Enrollments
            .Where(e => e.StudentId == id)
            .ToListAsync();
            
        var enrollmentIds = enrollments.Select(e => e.Id).ToList();
        
        var transferItems = await _context.MebbisTransferItems
            .Where(mti => enrollmentIds.Contains(mti.EnrollmentId))
            .ToListAsync();
            
        var enrollmentPayments = await _context.Payments
            .Where(p => p.EnrollmentId.HasValue && enrollmentIds.Contains(p.EnrollmentId.Value))
            .ToListAsync();
            
        var attendances = await _context.Attendances
            .Where(a => a.StudentId == id)
            .ToListAsync();
            
        var examResults = await _context.ExamResults
            .Where(er => er.StudentId == id)
            .ToListAsync();
            
        // Payments - StudentId'ye bağlı olanları al
        var allPayments = await _context.Payments
            .Where(p => p.StudentId == id)
            .ToListAsync();
        
        // Enrollment payment'larını student payment'lardan ayır
        var enrollmentPaymentIds = enrollmentPayments.Select(ep => ep.Id).ToList();
        var studentOnlyPayments = allPayments
            .Where(p => !enrollmentPaymentIds.Contains(p.Id))
            .ToList();
            
        var certificates = await _context.Certificates
            .Where(c => c.StudentId == id)
            .ToListAsync();
            
        var documents = await _context.StudentDocuments
            .Where(d => d.StudentId == id)
            .ToListAsync();
            
        var reminders = await _context.Reminders
            .Where(r => r.StudentId == id)
            .ToListAsync();

        // İlişkili kayıtları sil (sıralama önemli - foreign key constraint'lere göre)
        if (transferItems.Any())
        {
            _context.MebbisTransferItems.RemoveRange(transferItems);
        }
        
        // Enrollment payment'larını enrollment'dan ayır (null yap)
        foreach (var payment in enrollmentPayments)
        {
            payment.EnrollmentId = null;
        }
        
        if (enrollments.Any())
        {
            _context.Enrollments.RemoveRange(enrollments);
        }

        if (attendances.Any())
        {
            _context.Attendances.RemoveRange(attendances);
        }

        if (examResults.Any())
        {
            _context.ExamResults.RemoveRange(examResults);
        }

        // Student payment'ları sil (enrollment payment'ları hariç)
        if (studentOnlyPayments.Any())
        {
            _context.Payments.RemoveRange(studentOnlyPayments);
        }
        
        // Enrollment payment'ları enrollment silindikten sonra sil
        // Önce enrollment'ları sil, sonra payment'ları
        if (enrollmentPayments.Any())
        {
            // Enrollment'lar silindikten sonra payment'ları da sil
            _context.Payments.RemoveRange(enrollmentPayments);
        }

        if (certificates.Any())
        {
            _context.Certificates.RemoveRange(certificates);
        }

        if (documents.Any())
        {
            _context.StudentDocuments.RemoveRange(documents);
        }

        if (reminders.Any())
        {
            _context.Reminders.RemoveRange(reminders);
        }

        _context.Students.Remove(student);
        await _context.SaveChangesAsync();
        _cache.Remove($"student:detail:{id}");
        InvalidateSearchCache();
        return true;
    }

    public async Task<List<StudentDocumentDto>> GetDocumentsAsync(int studentId)
    {
        return await _context.StudentDocuments
            .Where(d => d.StudentId == studentId)
            .AsNoTracking()
            .OrderBy(d => d.DocumentType)
            .Select(d => new StudentDocumentDto
            {
                Id = d.Id,
                StudentId = d.StudentId,
                DocumentType = d.DocumentType,
                FileUrl = d.FileUrl,
                DocNo = d.DocNo,
                DocDate = d.DocDate,
                OcrConfidence = d.OcrConfidence,
                IsRequired = d.IsRequired,
                ValidationStatus = d.ValidationStatus,
                ValidationNotes = d.ValidationNotes,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<StudentDocumentDto> UploadDocumentAsync(int studentId, Stream fileStream, string fileName, string contentType, string documentType)
    {
        var student = await _context.Students.FindAsync(studentId);
        if (student == null)
            throw new ArgumentException("Student not found", nameof(studentId));

        var fileUrl = await _fileStorageService.UploadFileAsync(fileStream, fileName, contentType);

        var document = new StudentDocument
        {
            StudentId = studentId,
            DocumentType = documentType,
            FileUrl = fileUrl,
            IsRequired = true,
            ValidationStatus = "pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.StudentDocuments.Add(document);
        await _context.SaveChangesAsync();
        _cache.Remove($"student:detail:{studentId}");

        // Queue OCR job
        var tenantId = _tenantProvider.TenantId;
        BackgroundJob.Enqueue<OcrBackgroundJob>(job => job.ProcessDocumentAsync(tenantId, document.Id));

        return new StudentDocumentDto
        {
            Id = document.Id,
            StudentId = document.StudentId,
            DocumentType = document.DocumentType,
            FileUrl = document.FileUrl,
            DocNo = document.DocNo,
            DocDate = document.DocDate,
            OcrConfidence = document.OcrConfidence,
            IsRequired = document.IsRequired,
            ValidationStatus = document.ValidationStatus,
            ValidationNotes = document.ValidationNotes,
            CreatedAt = document.CreatedAt
        };
    }

    public async Task<(Stream Stream, string FileName, string ContentType)?> DownloadDocumentAsync(int studentId, int documentId)
    {
        var document = await _context.StudentDocuments
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == documentId && d.StudentId == studentId);

        if (document == null)
        {
            return null;
        }

        var stream = await _fileStorageService.DownloadFileAsync(document.FileUrl);
        var fileName = ExtractFileName(document);
        var contentType = GuessContentType(fileName);

        return (stream, fileName, contentType);
    }

    public async Task<bool> DeleteDocumentAsync(int studentId, int documentId)
    {
        var document = await _context.StudentDocuments
            .FirstOrDefaultAsync(d => d.Id == documentId && d.StudentId == studentId);

        if (document == null)
        {
            return false;
        }

        try
        {
            var removed = await _fileStorageService.DeleteFileAsync(document.FileUrl);
            if (!removed)
            {
                Log.Warning("File not removed from storage for DocumentId {DocumentId}", document.Id);
                return false;
            }
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to delete file from storage: {FileUrl}", document.FileUrl);
            return false;
        }

        _context.StudentDocuments.Remove(document);
        await _context.SaveChangesAsync();
        _cache.Remove($"student:detail:{studentId}");
        return true;
    }

    private string ExtractFileName(StudentDocument document)
    {
        try
        {
            var fileName = Path.GetFileName(document.FileUrl);
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                return fileName;
            }
        }
        catch
        {
            // ignore
        }

        var extension = document.DocumentType switch
        {
            "kimlik" => ".pdf",
            "ehliyet" => ".pdf",
            "saglik" => ".pdf",
            "foto" => ".jpg",
            _ => ".dat"
        };

        return $"{document.DocumentType}{extension}";
    }

    private static string BuildCourseName(int srcType, int month, int year, int groupNo, string? branch)
    {
        var monthName = GetMonthName(month);
        var baseName = $"SRC{srcType} {monthName} {year}";
        var groupLabel = $"Grup {groupNo}";
        if (!string.IsNullOrWhiteSpace(branch))
        {
            return $"{baseName} - {groupLabel} ({branch})";
        }

        return $"{baseName} - {groupLabel}";
    }

    private static string GetMonthName(int month)
    {
        return month switch
        {
            1 => "Ocak",
            2 => "Şubat",
            3 => "Mart",
            4 => "Nisan",
            5 => "Mayıs",
            6 => "Haziran",
            7 => "Temmuz",
            8 => "Ağustos",
            9 => "Eylül",
            10 => "Ekim",
            11 => "Kasım",
            12 => "Aralık",
            _ => month.ToString()
        };
    }

    private string GuessContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
        return extension switch
        {
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".pdf" => "application/pdf",
            ".doc" => "application/msword",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls" => "application/vnd.ms-excel",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt" => "text/plain",
            _ => "application/octet-stream"
        };
    }

    private async Task CreateDefaultPaymentIfNeededAsync(Student student)
    {
        if (!_paymentDefaults.AutoCreateOnStudentCreate || _paymentDefaults.Amount <= 0)
        {
            return;
        }

        var hasExistingPayment = await _context.Payments
            .AsNoTracking()
            .AnyAsync(p => p.StudentId == student.Id);

        if (hasExistingPayment)
        {
            return;
        }

        var dueDate = DateTime.UtcNow.Date.AddDays(Math.Max(0, _paymentDefaults.DueDays));

        var payment = new Payment
        {
            StudentId = student.Id,
            Amount = _paymentDefaults.Amount,
            PaymentType = string.IsNullOrWhiteSpace(_paymentDefaults.PaymentType) ? "course_fee" : _paymentDefaults.PaymentType,
            DueDate = dueDate,
            PenaltyAmount = _paymentDefaults.PenaltyAmount,
            Description = string.IsNullOrWhiteSpace(_paymentDefaults.Description)
                ? "Varsayılan ödeme"
                : _paymentDefaults.Description,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        await _context.Payments.AddAsync(payment);
        await _context.SaveChangesAsync();

        _cache.Remove($"student:detail:{student.Id}");
        InvalidateSearchCache();
    }

    private static string BuildSearchCacheKey(StudentListFilter filter)
    {
        var search = filter.Search?.Trim().ToLowerInvariant() ?? "_";
        var branch = filter.Branch?.Trim().ToLowerInvariant() ?? "_";
        var status = filter.HasActiveCourse.HasValue
            ? (filter.HasActiveCourse.Value ? "active" : "inactive")
            : "_";
        return $"student:search:{search}:{branch}:{status}";
    }

    private static MemoryCacheEntryOptions CreateSearchCacheEntryOptions()
    {
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = SearchCacheDuration
        };

        options.AddExpirationToken(new CancellationChangeToken(_searchCacheTokenSource.Token));
        return options;
    }

    private static void InvalidateSearchCache()
    {
        var previousSource = Interlocked.Exchange(ref _searchCacheTokenSource, new CancellationTokenSource());
        if (previousSource != null)
        {
            try
            {
                previousSource.Cancel();
            }
            catch
            {
                // ignore
            }
            finally
            {
                previousSource.Dispose();
            }
        }
    }

    private async Task CreateCourseRemindersAsync(
        Student student,
        List<int> selectedSrcCourses)
    {
        if (selectedSrcCourses.Count == 0)
        {
            return;
        }

        var sortedCourses = selectedSrcCourses.OrderBy(c => c).ToList();
        var reminders = new List<Reminder>();

        // İlk kurs dışındaki kurslar için "önceki kurs tamamlandığında" hatırlatması oluştur
        for (int i = 1; i < sortedCourses.Count; i++)
        {
            var currentSrcType = sortedCourses[i];
            var previousSrcType = sortedCourses[i - 1];
            
            var reminder = new Reminder
            {
                StudentId = student.Id,
                Type = "next_course_preparation",
                Channel = "both",
                Title = $"SRC{currentSrcType} kursu için hazırlık",
                Message = $"{student.FirstName} {student.LastName}, SRC{previousSrcType} kursunu tamamladıktan sonra SRC{currentSrcType} kursu için hazırlık yapmanız gerekmektedir.",
                Status = "pending",
                ScheduledAt = DateTime.UtcNow.AddMonths(3), // Varsayılan olarak 3 ay sonra (sertifika alındığında güncellenecek)
                CreatedAt = DateTime.UtcNow
            };
            reminders.Add(reminder);
        }

        if (reminders.Count > 0)
        {
            await _context.Reminders.AddRangeAsync(reminders);
            await _context.SaveChangesAsync();
            Log.Information("Created {Count} course reminders for student {StudentId}", reminders.Count, student.Id);
        }
    }

    private async Task SendWelcomeNotificationsAsync(Student student)
    {
        var tasks = new List<Task>();

        if (!string.IsNullOrWhiteSpace(student.Phone))
        {
            var smsMessage =
                $"Merhaba {student.FirstName} {student.LastName}, SRC kurs kaydınız tamamlandı. Detaylar için kurumumuzla iletişime geçebilirsiniz.";
            tasks.Add(_communicationService.SendSmsAsync(student.Phone, smsMessage));
        }

        if (!string.IsNullOrWhiteSpace(student.Email))
        {
            var subject = "SRC Kurs Kaydınız";
            var body =
$@"Merhaba {student.FirstName} {student.LastName},

SRC kurs kaydınız başarıyla tamamlanmıştır.

Kurs detayları ve ders programı hakkında bilgi almak için lütfen kurumumuzla iletişime geçiniz.

İyi çalışmalar dileriz.";
            tasks.Add(_communicationService.SendEmailAsync(student.Email, subject, body));
        }

        if (tasks.Count == 0)
        {
            return;
        }

        try
        {
            await Task.WhenAll(tasks);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Welcome notifications could not be delivered for student {StudentId}", student.Id);
        }
    }
}


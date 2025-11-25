using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/data")]
[Authorize(Roles = "PlatformOwner")]
public class HqDataController : ControllerBase
{
    private readonly SrcDbContext _context;

    public HqDataController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpPost("clear-all")]
    public async Task<IActionResult> ClearAllDataAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Foreign key constraint'leri nedeniyle doğru sırayla silme işlemi yapılmalı
            // En alt seviyedeki tablolardan başlayarak üst seviyelere doğru ilerliyoruz

            // 1. Transfer Items (En alt seviye)
            var transferItems = await _context.MebbisTransferItems
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (transferItems.Any())
            {
                _context.MebbisTransferItems.RemoveRange(transferItems);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 2. Transfer Jobs
            var transferJobs = await _context.MebbisTransferJobs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (transferJobs.Any())
            {
                _context.MebbisTransferJobs.RemoveRange(transferJobs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 3. Exam Results
            var examResults = await _context.ExamResults
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (examResults.Any())
            {
                _context.ExamResults.RemoveRange(examResults);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 4. Exams
            var exams = await _context.Exams
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (exams.Any())
            {
                _context.Exams.RemoveRange(exams);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 5. Attendances
            var attendances = await _context.Attendances
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (attendances.Any())
            {
                _context.Attendances.RemoveRange(attendances);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 6. Schedule Slots
            var scheduleSlots = await _context.ScheduleSlots
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (scheduleSlots.Any())
            {
                _context.ScheduleSlots.RemoveRange(scheduleSlots);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 7. Payments
            var payments = await _context.Payments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (payments.Any())
            {
                _context.Payments.RemoveRange(payments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 8. Enrollments
            var enrollments = await _context.Enrollments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (enrollments.Any())
            {
                _context.Enrollments.RemoveRange(enrollments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Courses artık MebGroup içinde, bu adım atlandı

            // 10. MebGroups
            var mebGroups = await _context.MebGroups
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (mebGroups.Any())
            {
                _context.MebGroups.RemoveRange(mebGroups);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 11. Reminders
            var reminders = await _context.Reminders
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (reminders.Any())
            {
                _context.Reminders.RemoveRange(reminders);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 12. Student Documents
            var studentDocuments = await _context.StudentDocuments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (studentDocuments.Any())
            {
                _context.StudentDocuments.RemoveRange(studentDocuments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 13. Students
            var students = await _context.Students
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (students.Any())
            {
                _context.Students.RemoveRange(students);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 14. Account Transactions
            var accountTransactions = await _context.AccountTransactions
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (accountTransactions.Any())
            {
                _context.AccountTransactions.RemoveRange(accountTransactions);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 15. AI Queries
            var aiQueries = await _context.AiQueries
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (aiQueries.Any())
            {
                _context.AiQueries.RemoveRange(aiQueries);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 16. Mebbis Sync Logs
            var mebbisSyncLogs = await _context.MebbisSyncLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (mebbisSyncLogs.Any())
            {
                _context.MebbisSyncLogs.RemoveRange(mebbisSyncLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 17. License Reminder Logs
            var licenseReminderLogs = await _context.LicenseReminderLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (licenseReminderLogs.Any())
            {
                _context.LicenseReminderLogs.RemoveRange(licenseReminderLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 18. Tenant API Tokens
            var tenantApiTokens = await _context.TenantApiTokens
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (tenantApiTokens.Any())
            {
                _context.TenantApiTokens.RemoveRange(tenantApiTokens);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 19. Audit Logs
            var auditLogs = await _context.AuditLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (auditLogs.Any())
            {
                _context.AuditLogs.RemoveRange(auditLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 20. User Tenants (Junction table)
            var userTenants = await _context.UserTenants
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (userTenants.Any())
            {
                _context.UserTenants.RemoveRange(userTenants);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 21. Tenants (Tenant verilerini silme - opsiyonel, admin kullanıcıları korumak için)
            // Not: Tenants'ı silmek istemiyorsanız bu kısmı yorum satırı yapın
            // var tenants = await _context.Tenants
            //     .IgnoreQueryFilters()
            //     .ToListAsync(cancellationToken);
            // if (tenants.Any())
            // {
            //     _context.Tenants.RemoveRange(tenants);
            //     await _context.SaveChangesAsync(cancellationToken);
            // }

            // 22. Users (Admin kullanıcıları korumak için sadece tenant kullanıcılarını sil)
            // Not: PlatformOwner rolündeki kullanıcıları korumak için bu kısmı yorum satırı yapın
            // var users = await _context.Users
            //     .Where(u => u.Role != "PlatformOwner")
            //     .ToListAsync(cancellationToken);
            // if (users.Any())
            // {
            //     _context.Users.RemoveRange(users);
            //     await _context.SaveChangesAsync(cancellationToken);
            // }

            return Ok(new
            {
                message = "Tüm sistem verileri başarıyla silindi.",
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Veriler silinirken bir hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost("clear-tenant-data")]
    public async Task<IActionResult> ClearTenantDataAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Kurslar, öğrenciler ve tüm lisansları sil
            // Foreign key constraint'leri nedeniyle doğru sırayla silme işlemi yapılmalı

            // 1. Transfer Items
            var transferItems = await _context.MebbisTransferItems
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (transferItems.Any())
            {
                _context.MebbisTransferItems.RemoveRange(transferItems);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 2. Transfer Jobs
            var transferJobs = await _context.MebbisTransferJobs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (transferJobs.Any())
            {
                _context.MebbisTransferJobs.RemoveRange(transferJobs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 3. Exam Results
            var examResults = await _context.ExamResults
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (examResults.Any())
            {
                _context.ExamResults.RemoveRange(examResults);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 4. Exams
            var exams = await _context.Exams
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (exams.Any())
            {
                _context.Exams.RemoveRange(exams);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 5. Attendances
            var attendances = await _context.Attendances
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (attendances.Any())
            {
                _context.Attendances.RemoveRange(attendances);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 6. Schedule Slots
            var scheduleSlots = await _context.ScheduleSlots
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (scheduleSlots.Any())
            {
                _context.ScheduleSlots.RemoveRange(scheduleSlots);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 7. Payments
            var payments = await _context.Payments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (payments.Any())
            {
                _context.Payments.RemoveRange(payments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 8. Enrollments
            var enrollments = await _context.Enrollments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (enrollments.Any())
            {
                _context.Enrollments.RemoveRange(enrollments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Courses artık MebGroup içinde, bu adım atlandı

            // 10. MebGroups
            var mebGroups = await _context.MebGroups
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (mebGroups.Any())
            {
                _context.MebGroups.RemoveRange(mebGroups);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 11. Reminders
            var reminders = await _context.Reminders
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (reminders.Any())
            {
                _context.Reminders.RemoveRange(reminders);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 12. Student Documents
            var studentDocuments = await _context.StudentDocuments
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (studentDocuments.Any())
            {
                _context.StudentDocuments.RemoveRange(studentDocuments);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 13. Students
            var students = await _context.Students
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (students.Any())
            {
                _context.Students.RemoveRange(students);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 14. Account Transactions
            var accountTransactions = await _context.AccountTransactions
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (accountTransactions.Any())
            {
                _context.AccountTransactions.RemoveRange(accountTransactions);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 15. AI Queries
            var aiQueries = await _context.AiQueries
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (aiQueries.Any())
            {
                _context.AiQueries.RemoveRange(aiQueries);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 16. Mebbis Sync Logs
            var mebbisSyncLogs = await _context.MebbisSyncLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (mebbisSyncLogs.Any())
            {
                _context.MebbisSyncLogs.RemoveRange(mebbisSyncLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 17. License Reminder Logs
            var licenseReminderLogs = await _context.LicenseReminderLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (licenseReminderLogs.Any())
            {
                _context.LicenseReminderLogs.RemoveRange(licenseReminderLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 18. Tenant API Tokens
            var tenantApiTokens = await _context.TenantApiTokens
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (tenantApiTokens.Any())
            {
                _context.TenantApiTokens.RemoveRange(tenantApiTokens);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 19. Audit Logs
            var auditLogs = await _context.AuditLogs
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (auditLogs.Any())
            {
                _context.AuditLogs.RemoveRange(auditLogs);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 20. User Tenants (Junction table)
            var userTenants = await _context.UserTenants
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (userTenants.Any())
            {
                _context.UserTenants.RemoveRange(userTenants);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // 21. Tenants (Tüm lisansları sil)
            var tenants = await _context.Tenants
                .IgnoreQueryFilters()
                .ToListAsync(cancellationToken);
            if (tenants.Any())
            {
                _context.Tenants.RemoveRange(tenants);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Not: Users tablosunu koruyoruz (admin kullanıcıları korunur)

            return Ok(new
            {
                message = "Kurslar, öğrenciler ve tüm lisanslar başarıyla silindi.",
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Veriler silinirken bir hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost("seed")]
    public async Task<IActionResult> SeedDataAsync(CancellationToken cancellationToken)
    {
        try
        {
            SeedData.Initialize(_context);
            
            return Ok(new
            {
                message = "Seed data başarıyla eklendi.",
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Seed data eklenirken bir hata oluştu.",
                error = ex.Message
            });
        }
    }

    [HttpPost("bulk-students/{tenantId}")]
    public async Task<IActionResult> CreateBulkStudents(string tenantId, [FromBody] BulkStudentRequest? request, CancellationToken cancellationToken)
    {
        try
        {
            // Tenant kontrolü
            var tenant = await _context.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Id == tenantId || t.Username == tenantId, cancellationToken);

            if (tenant == null)
            {
                return NotFound(new { message = $"Tenant bulunamadı: {tenantId}" });
            }

            var count = request?.Count ?? 4500;
            if (count <= 0 || count > 10000)
            {
                return BadRequest(new { message = "Öğrenci sayısı 1-10000 arasında olmalıdır." });
            }

            // SRC kombinasyonları (SRC1-SRC5)
            var srcCombinations = new List<List<int>>
            {
                new List<int> { 1 },      // SRC1
                new List<int> { 2 },      // SRC2
                new List<int> { 3 },      // SRC3
                new List<int> { 4 },      // SRC4
                new List<int> { 5 },      // SRC5
                new List<int> { 1, 2 },   // SRC1+SRC2
                new List<int> { 1, 3 },   // SRC1+SRC3
                new List<int> { 1, 4 },   // SRC1+SRC4
                new List<int> { 1, 5 },   // SRC1+SRC5
                new List<int> { 2, 3 },   // SRC2+SRC3
                new List<int> { 2, 4 },   // SRC2+SRC4
                new List<int> { 2, 5 },   // SRC2+SRC5
                new List<int> { 3, 4 },   // SRC3+SRC4
                new List<int> { 3, 5 },   // SRC3+SRC5
                new List<int> { 4, 5 },   // SRC4+SRC5
                new List<int> { 1, 2, 3 }, // SRC1+SRC2+SRC3
                new List<int> { 1, 2, 4 }, // SRC1+SRC2+SRC4
                new List<int> { 1, 2, 5 }, // SRC1+SRC2+SRC5
                new List<int> { 1, 3, 4 }, // SRC1+SRC3+SRC4
                new List<int> { 1, 3, 5 }, // SRC1+SRC3+SRC5
                new List<int> { 1, 4, 5 }, // SRC1+SRC4+SRC5
                new List<int> { 2, 3, 4 }, // SRC2+SRC3+SRC4
                new List<int> { 2, 3, 5 }, // SRC2+SRC3+SRC5
                new List<int> { 2, 4, 5 }, // SRC2+SRC4+SRC5
                new List<int> { 3, 4, 5 }, // SRC3+SRC4+SRC5
                new List<int> { 1, 2, 3, 4 }, // SRC1+SRC2+SRC3+SRC4
                new List<int> { 1, 2, 3, 5 }, // SRC1+SRC2+SRC3+SRC5
                new List<int> { 1, 2, 4, 5 }, // SRC1+SRC2+SRC4+SRC5
                new List<int> { 1, 3, 4, 5 }, // SRC1+SRC3+SRC4+SRC5
                new List<int> { 2, 3, 4, 5 }, // SRC2+SRC3+SRC4+SRC5
                new List<int> { 1, 2, 3, 4, 5 } // Tümü
            };

            var turkishFirstNames = new[] { "Ahmet", "Mehmet", "Ali", "Mustafa", "Hasan", "Hüseyin", "İbrahim", "İsmail", "Osman", "Yusuf", 
                "Ayşe", "Fatma", "Zeynep", "Emine", "Hatice", "Elif", "Merve", "Selin", "Derya", "Gülay", 
                "Can", "Burak", "Emre", "Kerem", "Onur", "Serkan", "Tolga", "Uğur", "Volkan", "Yasin",
                "Seda", "Burcu", "Ceren", "Deniz", "Ebru", "Gizem", "Hande", "İpek", "Jale", "Kader" };

            var turkishLastNames = new[] { "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir",
                "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Polat", "Kurt", "Özkan",
                "Şimşek", "Aksoy", "Çakır", "Erdoğan", "Akar", "Bulut", "Güneş", "Türk", "Yücel", "Avcı" };

            var educationLevels = new[] { "İlkokul", "Ortaokul", "Lise", "Üniversite", "Yüksek Lisans" };
            var licenseTypes = new[] { "B", "C", "D", "E", "F", "G" };

            var random = new Random();
            var students = new List<SRC.Domain.Entities.Student>();
            var baseTc = 10000000000L; // 11 haneli TC başlangıç
            var studentIndex = 0;
            var studentsPerCombination = count / srcCombinations.Count;
            var remaining = count % srcCombinations.Count;

            foreach (var srcCombo in srcCombinations)
            {
                var comboCount = studentsPerCombination + (remaining > 0 ? 1 : 0);
                remaining--;

                for (int i = 0; i < comboCount && studentIndex < count; i++)
                {
                    var firstName = turkishFirstNames[random.Next(turkishFirstNames.Length)];
                    var lastName = turkishLastNames[random.Next(turkishLastNames.Length)];
                    var tcKimlikNo = (baseTc + studentIndex).ToString();
                    
                    // Mevcut TC kontrolü
                    var existingTc = await _context.Students
                        .IgnoreQueryFilters()
                        .AnyAsync(s => s.TcKimlikNo == tcKimlikNo, cancellationToken);
                    
                    if (existingTc)
                    {
                        // Eğer TC mevcutsa, benzersiz bir TC oluştur
                        tcKimlikNo = (baseTc + studentIndex + 9999999999L).ToString();
                    }

                    var birthYear = random.Next(1970, 2005);
                    var birthMonth = random.Next(1, 13);
                    var birthDay = random.Next(1, 29);
                    var birthDate = new DateTime(birthYear, birthMonth, birthDay, 0, 0, 0, DateTimeKind.Utc);

                    var licenseIssueYear = random.Next(birthYear + 18, 2024);
                    var licenseIssueMonth = random.Next(1, 13);
                    var licenseIssueDay = random.Next(1, 29);
                    var licenseIssueDate = new DateTime(licenseIssueYear, licenseIssueMonth, licenseIssueDay, 0, 0, 0, DateTimeKind.Utc);

                    var student = new SRC.Domain.Entities.Student
                    {
                        TenantId = tenant.Id,
                        TcKimlikNo = tcKimlikNo,
                        FirstName = firstName,
                        LastName = lastName,
                        BirthDate = birthDate,
                        Phone = $"05{random.Next(10, 100)} {random.Next(100, 1000)} {random.Next(10, 100)} {random.Next(10, 100)}",
                        Email = $"{firstName.ToLower()}.{lastName.ToLower()}{studentIndex}@example.com",
                        Address = $"{random.Next(1, 200)}. Sokak, {random.Next(1, 100)}. Cadde, {random.Next(1, 50)}. Mahalle",
                        EducationLevel = educationLevels[random.Next(educationLevels.Length)],
                        LicenseType = licenseTypes[random.Next(licenseTypes.Length)],
                        LicenseIssueDate = licenseIssueDate,
                        SelectedSrcCourses = string.Join(",", srcCombo.OrderBy(x => x)),
                        CreatedAt = DateTime.UtcNow
                    };

                    students.Add(student);
                    studentIndex++;

                    // Her 100 öğrencide bir batch olarak kaydet
                    if (students.Count >= 100)
                    {
                        _context.Students.AddRange(students);
                        await _context.SaveChangesAsync(cancellationToken);
                        students.Clear();
                    }
                }
            }

            // Kalan öğrencileri kaydet
            if (students.Any())
            {
                _context.Students.AddRange(students);
                await _context.SaveChangesAsync(cancellationToken);
            }

            return Ok(new
            {
                message = $"{studentIndex} öğrenci başarıyla eklendi.",
                tenantId = tenant.Id,
                tenantName = tenant.Name,
                count = studentIndex
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Öğrenci eklenirken bir hata oluştu.",
                error = ex.Message,
                stackTrace = ex.StackTrace
            });
        }
    }
}

public class BulkStudentRequest
{
    public int Count { get; set; } = 4500;
}


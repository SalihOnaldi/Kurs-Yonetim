using System.Linq;
using Microsoft.EntityFrameworkCore;
using SRC.Domain.Entities;

namespace SRC.Infrastructure.Data;

public static class SeedData
{
    private const string TenantMavi = "MAVI-BEYAZ-AKADEMI";
    private const string TenantDuru = "DURU-AKADEMI";

    public static void Initialize(SrcDbContext context)
    {
        var now = DateTime.UtcNow;

        // Tenant'ları sadece yoksa oluştur (silinmiş tenant'ları tekrar oluşturma)
        var tenants = SeedTenants(context, now);
        var users = SeedUsers(context, now, tenants);

        // Öğrenci verilerini sadece hiç öğrenci yoksa ekle
        if (!context.Students.IgnoreQueryFilters().Any())
        {
            SeedTenantData(context, users, now);
        }
    }

    private static (Tenant Mavi, Tenant Duru) SeedTenants(SrcDbContext context, DateTime now)
    {
        var mavi = EnsureTenant(context, TenantMavi, "Mavi-Beyaz Akademi", "Ankara", now);
        var duru = EnsureTenant(context, TenantDuru, "Duru SRC", "İstanbul", now);
        context.SaveChanges();
        return (mavi, duru);
    }

    private static (User PlatformOwner, User MaviAdmin, User DuruAdmin, User MaviInstructor, User DuruInstructor) SeedUsers(
        SrcDbContext context,
        DateTime now,
        (Tenant Mavi, Tenant Duru) tenants)
    {
        var platformOwner = EnsureUser(context,
            username: "admin",
            password: "Admin123!",
            role: "PlatformOwner",
            fullName: "Platform Yöneticisi",
            email: "admin@src.local",
            now);

        var maviAdmin = EnsureUser(context,
            username: "admin.kurs",
            password: "Kurs123!",
            role: "BranchAdmin",
            fullName: "Selin Karaca",
            email: "admin.kurs@src.local",
            now);

        var duruAdmin = EnsureUser(context,
            username: "duru.admin",
            password: "DuruAdmin123!",
            role: "BranchAdmin",
            fullName: "Ahmet Duru",
            email: "duru.admin@src.local",
            now);

        var maviInstructor = EnsureUser(context,
            username: "mavi.egitmen",
            password: "MaviEgitmen123!",
            role: "Teacher",
            fullName: "Hakan Erol",
            email: "egitmen.mavi@src.local",
            now);

        var duruInstructor = EnsureUser(context,
            username: "duru.egitmen",
            password: "DuruEgitmen123!",
            role: "Teacher",
            fullName: "Seda Aydın",
            email: "egitmen.duru@src.local",
            now);

        // Kullanıcıların Id'lerini almak için SaveChanges çağır
        context.SaveChanges();

        // Şimdi UserTenant ilişkilerini ekle
        EnsureUserTenant(context, platformOwner, tenants.Mavi.Id);
        EnsureUserTenant(context, platformOwner, tenants.Duru.Id);
        EnsureUserTenant(context, maviAdmin, tenants.Mavi.Id);
        EnsureUserTenant(context, maviInstructor, tenants.Mavi.Id);
        EnsureUserTenant(context, duruAdmin, tenants.Duru.Id);
        EnsureUserTenant(context, duruInstructor, tenants.Duru.Id);

        context.SaveChanges();

        return (platformOwner, maviAdmin, duruAdmin, maviInstructor, duruInstructor);
    }

    private static void SeedTenantData(
        SrcDbContext context,
        (User PlatformOwner, User MaviAdmin, User DuruAdmin, User MaviInstructor, User DuruInstructor) users,
        DateTime now)
    {
        var maviStudents = new[]
        {
            new Student
            {
                TenantId = TenantMavi,
                TcKimlikNo = "60000000001",
                FirstName = "Ayşe",
                LastName = "Demir",
                BirthDate = new DateTime(1995, 5, 12, 0, 0, 0, DateTimeKind.Utc),
                Phone = "0555 111 22 33",
                Email = "ayse.demir@mavibeyaz.com",
                Address = "Çankaya, Ankara",
                EducationLevel = "Üniversite",
                LicenseType = "B",
                LicenseIssueDate = new DateTime(2015, 3, 8, 0, 0, 0, DateTimeKind.Utc)
            },
            new Student
            {
                TenantId = TenantMavi,
                TcKimlikNo = "60000000002",
                FirstName = "Mehmet",
                LastName = "Kara",
                BirthDate = new DateTime(1992, 2, 2, 0, 0, 0, DateTimeKind.Utc),
                Phone = "0555 444 55 66",
                Email = "mehmet.kara@mavibeyaz.com",
                Address = "Keçiören, Ankara",
                EducationLevel = "Lise",
                LicenseType = "C",
                LicenseIssueDate = new DateTime(2013, 7, 20, 0, 0, 0, DateTimeKind.Utc)
            }
        };

        var duruStudents = new[]
        {
            new Student
            {
                TenantId = TenantDuru,
                TcKimlikNo = "70000000001",
                FirstName = "Elif",
                LastName = "Özkan",
                BirthDate = new DateTime(1998, 10, 21, 0, 0, 0, DateTimeKind.Utc),
                Phone = "0555 777 88 99",
                Email = "elif.ozkan@durusrc.com",
                Address = "Kadıköy, İstanbul",
                EducationLevel = "Üniversite",
                LicenseType = "B",
                LicenseIssueDate = new DateTime(2017, 11, 3, 0, 0, 0, DateTimeKind.Utc)
            },
            new Student
            {
                TenantId = TenantDuru,
                TcKimlikNo = "70000000002",
                FirstName = "Murat",
                LastName = "Yıldırım",
                BirthDate = new DateTime(1990, 8, 18, 0, 0, 0, DateTimeKind.Utc),
                Phone = "0555 999 11 22",
                Email = "murat.yildirim@durusrc.com",
                Address = "Ümraniye, İstanbul",
                EducationLevel = "Lise",
                LicenseType = "CE",
                LicenseIssueDate = new DateTime(2012, 4, 12, 0, 0, 0, DateTimeKind.Utc)
            }
        };

        var maviGroup = new MebGroup
        {
            TenantId = TenantMavi,
            Year = now.Year,
            Month = now.Month,
            GroupNo = 1,
            Branch = "Ankara Çankaya",
            StartDate = now.AddDays(-10),
            EndDate = now.AddDays(25),
            Capacity = 24,
            Status = "active",
            SrcType = 1,
            IsMixed = false,
            PlannedHours = 36,
            MebApprovalStatus = "approved",
            ApprovalAt = now.AddDays(-7),
            ApprovalNotes = "Onaylandı"
        };

        var duruGroup = new MebGroup
        {
            TenantId = TenantDuru,
            Year = now.Year,
            Month = now.Month + 1,
            GroupNo = 3,
            Branch = "İstanbul Kadıköy",
            StartDate = now.AddDays(5),
            EndDate = now.AddDays(40),
            Capacity = 20,
            Status = "draft",
            SrcType = 3,
            IsMixed = true,
            MixedTypes = "SRC3,SRC4",
            PlannedHours = 42,
            MebApprovalStatus = "pending",
            ApprovalNotes = "Eksik evrak bekleniyor"
        };

        var maviSchedule = new[]
        {
            new ScheduleSlot
            {
                TenantId = TenantMavi,
                MebGroup = maviGroup,
                InstructorId = users.MaviInstructor.Id,
                ClassroomName = "Ankara A Sınıfı",
                StartTime = now.AddDays(-3).Date.AddHours(9),
                EndTime = now.AddDays(-3).Date.AddHours(12),
                Subject = "Trafik Kuralları",
                Notes = "Giriş dersi"
            },
            new ScheduleSlot
            {
                TenantId = TenantMavi,
                MebGroup = maviGroup,
                InstructorId = users.MaviInstructor.Id,
                ClassroomName = "Ankara A Sınıfı",
                StartTime = now.AddDays(-1).Date.AddHours(9),
                EndTime = now.AddDays(-1).Date.AddHours(12),
                Subject = "İleri Sürüş Teknikleri",
                Notes = "Simülasyon uygulaması"
            }
        };

        var duruSchedule = new[]
        {
            new ScheduleSlot
            {
                TenantId = TenantDuru,
                MebGroup = duruGroup,
                InstructorId = users.DuruInstructor.Id,
                ClassroomName = "İstanbul 1 Nolu Sınıf",
                StartTime = now.AddDays(7).Date.AddHours(10),
                EndTime = now.AddDays(7).Date.AddHours(13),
                Subject = "Güvenli Sürüş",
                Notes = "Teorik ders"
            }
        };

        var maviEnrollments = new[]
        {
            new Enrollment
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                MebGroup = maviGroup,
                EnrollmentDate = now.AddDays(-12),
                Status = "active",
                Fee = 3500m,
                PaidAmount = 1750m,
                Notes = "Peşinat ödendi"
            },
            new Enrollment
            {
                TenantId = TenantMavi,
                Student = maviStudents[1],
                MebGroup = maviGroup,
                EnrollmentDate = now.AddDays(-11),
                Status = "active",
                Fee = 3600m,
                PaidAmount = 3600m,
                Notes = "Tamamı ödendi"
            }
        };

        var duruEnrollment = new Enrollment
        {
            TenantId = TenantDuru,
            Student = duruStudents[0],
            MebGroup = duruGroup,
            EnrollmentDate = now.AddDays(-5),
            Status = "active",
            Fee = 4200m,
            PaidAmount = 2000m,
            Notes = "Erken kayıt indirimi uygulandı"
        };

        var maviAttendances = new[]
        {
            new Attendance
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                ScheduleSlot = maviSchedule[0],
                IsPresent = true,
                FaceVerified = true,
                MarkedAt = maviSchedule[0].StartTime.AddMinutes(5)
            },
            new Attendance
            {
                TenantId = TenantMavi,
                Student = maviStudents[1],
                ScheduleSlot = maviSchedule[0],
                IsPresent = true,
                FaceVerified = true,
                MarkedAt = maviSchedule[0].StartTime.AddMinutes(7)
            },
            new Attendance
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                ScheduleSlot = maviSchedule[1],
                IsPresent = false,
                Excuse = "Sağlık raporu",
                FaceVerified = false,
                MarkedAt = maviSchedule[1].StartTime
            }
        };

        var maviExams = new[]
        {
            new Exam
            {
                TenantId = TenantMavi,
                MebGroup = maviGroup,
                ExamType = "yazili",
                ExamDate = now.AddDays(14).Date.AddHours(10),
                MebSessionCode = "SRC1-2026-03-YZL",
                Status = "scheduled",
                Notes = "Örnek yazılı sınav"
            },
            new Exam
            {
                TenantId = TenantMavi,
                MebGroup = maviGroup,
                ExamType = "uygulama",
                ExamDate = now.AddDays(20).Date.AddHours(9),
                MebSessionCode = "SRC1-2026-03-UYG",
                Status = "scheduled",
                Notes = "Saha uygulaması"
            }
        };

        var duruExam = new Exam
        {
            TenantId = TenantDuru,
            MebGroup = duruGroup,
            ExamType = "yazili",
            ExamDate = now.AddDays(30).Date.AddHours(11),
            MebSessionCode = "SRC3-2026-04-YZL",
            Status = "draft",
            Notes = "Ön başvuru alındı"
        };

        var maviExamResults = new[]
        {
            new ExamResult
            {
                TenantId = TenantMavi,
                Exam = maviExams[0],
                Student = maviStudents[0],
                Score = 84.5m,
                Pass = true,
                AttemptNo = 1
            },
            new ExamResult
            {
                TenantId = TenantMavi,
                Exam = maviExams[0],
                Student = maviStudents[1],
                Score = 78.0m,
                Pass = true,
                AttemptNo = 1
            }
        };

        var payments = new[]
        {
            new Payment
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                Enrollment = maviEnrollments[0],
                Amount = 1750m,
                DueDate = now.AddDays(-8),
                PaidDate = now.AddDays(-8),
                PaymentType = "course_fee",
                Status = "paid",
                Description = "Peşinat ödemesi",
                ReceiptNo = "MB-001"
            },
            new Payment
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                Enrollment = maviEnrollments[0],
                Amount = 1750m,
                DueDate = now.AddDays(5),
                PaymentType = "course_fee",
                Status = "pending",
                Description = "Kalan bakiye"
            },
            new Payment
            {
                TenantId = TenantDuru,
                Student = duruStudents[0],
                Enrollment = duruEnrollment,
                Amount = 2000m,
                DueDate = now.AddDays(-3),
                PaidDate = now.AddDays(-3),
                PaymentType = "course_fee",
                Status = "paid",
                Description = "Erken kayıt indirimi sonrası peşinat",
                ReceiptNo = "DR-010"
            }
        };

        var studentDocuments = new[]
        {
            new StudentDocument
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                DocumentType = "kimlik",
                FileUrl = "tenants/mavi/students/ayse/kimlik.pdf",
                ValidationStatus = "approved",
                ValidationNotes = "Belgeler eksiksiz"
            },
            new StudentDocument
            {
                TenantId = TenantDuru,
                Student = duruStudents[0],
                DocumentType = "saglik_raporu",
                FileUrl = "tenants/duru/students/elif/saglik.pdf",
                ValidationStatus = "pending",
                ValidationNotes = "Doktor kaşesi okunaklı değil"
            }
        };

        var reminders = new[]
        {
            new Reminder
            {
                TenantId = TenantMavi,
                Student = maviStudents[0],
                StudentDocument = studentDocuments[0],
                Type = "document_expiry",
                Channel = "email",
                Title = "Kimlik Belgesi Yenileme",
                Message = "Kimlik belgesinin süresi doluyor, lütfen güncelleyin.",
                Status = "pending",
                ScheduledAt = now.AddDays(3)
            },
            new Reminder
            {
                TenantId = TenantDuru,
                Student = duruStudents[0],
                Type = "payment_due",
                Channel = "sms",
                Title = "Ödeme Hatırlatma",
                Message = "Kalan bakiye için ödeme son tarihi yaklaşmaktadır.",
                Status = "queued",
                ScheduledAt = now.AddDays(2)
            }
        };

        var transferJob = new MebbisTransferJob
        {
            TenantId = TenantMavi,
            MebGroup = maviGroup,
            Mode = "dry_run",
            Status = "completed",
            SuccessCount = 1,
            FailureCount = 0,
            StartedAt = now.AddDays(-2),
            CompletedAt = now.AddDays(-2).AddMinutes(12)
        };

        var transferItem = new MebbisTransferItem
        {
            TenantId = TenantMavi,
            MebbisTransferJob = transferJob,
            Enrollment = maviEnrollments[0],
            Status = "transferred",
            TransferredAt = now.AddDays(-2).AddMinutes(11)
        };

        var syncLogs = new[]
        {
            new MebbisSyncLog
            {
                TenantId = TenantMavi,
                EntityType = "course",
                EntityId = 0,
                Action = "send",
                Status = "success",
                Payload = "MEB gönderimi tamamlandı"
            },
            new MebbisSyncLog
            {
                TenantId = TenantDuru,
                EntityType = "student",
                EntityId = 0,
                Action = "send",
                Status = "failed",
                Error = "Sistem bakımda"
            }
        };

        var aiQueries = new[]
        {
            new AiQuery
            {
                TenantId = TenantMavi,
                Question = "Bu hafta kaç ders planlandı?",
                Answer = "Toplam 8 ders planlandı, 6 tanesi tamamlandı.",
                Provider = "mock"
            },
            new AiQuery
            {
                TenantId = TenantDuru,
                Question = "Ödeme bekleyen öğrenciler kimler?",
                Answer = "Elif Özkan için 2200₺ bakiye bekleniyor.",
                Provider = "mock"
            }
        };

        context.Students.AddRange(maviStudents);
        context.Students.AddRange(duruStudents);
        context.MebGroups.AddRange(maviGroup, duruGroup);
        context.ScheduleSlots.AddRange(maviSchedule);
        context.ScheduleSlots.AddRange(duruSchedule);
        context.Enrollments.AddRange(maviEnrollments);
        context.Enrollments.Add(duruEnrollment);
        context.Attendances.AddRange(maviAttendances);
        context.Exams.AddRange(maviExams);
        context.Exams.Add(duruExam);
        context.ExamResults.AddRange(maviExamResults);
        context.Payments.AddRange(payments);
        context.StudentDocuments.AddRange(studentDocuments);
        context.Reminders.AddRange(reminders);
        context.MebbisTransferJobs.Add(transferJob);
        context.MebbisTransferItems.Add(transferItem);
        context.MebbisSyncLogs.AddRange(syncLogs);
        context.AiQueries.AddRange(aiQueries);

        context.SaveChanges();
    }

    private static Tenant EnsureTenant(SrcDbContext context, string tenantId, string name, string? city, DateTime now)
    {
        var tenant = context.Tenants.IgnoreQueryFilters().SingleOrDefault(t => t.Id == tenantId);
        if (tenant == null)
        {
            tenant = new Tenant
            {
                Id = tenantId,
                Name = name,
                City = city,
                CreatedAt = now,
                IsActive = true
            };
            context.Tenants.Add(tenant);
        }
        else
        {
            // Mevcut tenant varsa sadece güncelle, silinmiş tenant'ları tekrar oluşturma
            tenant.Name = name;
            tenant.City = city;
            tenant.IsActive = true;
            if (tenant.CreatedAt == default)
            {
                tenant.CreatedAt = now;
            }
        }

        return tenant;
    }

    private static User EnsureUser(
        SrcDbContext context,
        string username,
        string password,
        string role,
        string fullName,
        string email,
        DateTime now)
    {
        var user = context.Users.SingleOrDefault(u => u.Username == username);
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password);

        if (user == null)
        {
            user = new User
            {
                Username = username,
                PasswordHash = passwordHash,
                Email = email,
                FullName = fullName,
                Role = role,
                IsActive = true,
                CreatedAt = now
            };
            context.Users.Add(user);
        }
        else
        {
            user.PasswordHash = passwordHash;
            user.Email = email;
            user.FullName = fullName;
            user.Role = role;
            user.IsActive = true;
            if (user.CreatedAt == default)
            {
                user.CreatedAt = now;
            }
        }

        return user;
    }

    private static void EnsureUserTenant(SrcDbContext context, User user, string tenantId)
    {
        // User.Id'nin 0 olmadığından emin ol
        if (user.Id == 0)
        {
            context.SaveChanges();
        }

        var exists = context.UserTenants
            .IgnoreQueryFilters() // Global query filter'ı bypass et
            .Any(ut => ut.UserId == user.Id && ut.TenantId == tenantId);
        
        if (!exists)
        {
            context.UserTenants.Add(new UserTenant
            {
                UserId = user.Id,
                TenantId = tenantId
            });
        }
    }
}



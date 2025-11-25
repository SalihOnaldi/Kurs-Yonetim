using System.Reflection;
using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces.Tenancy;
using SRC.Domain.Entities;

namespace SRC.Infrastructure.Data;

public class SrcDbContext : DbContext
{
    private readonly ITenantProvider _tenantProvider;

    public SrcDbContext(DbContextOptions<SrcDbContext> options, ITenantProvider tenantProvider)
        : base(options)
    {
        _tenantProvider = tenantProvider;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<UserTenant> UserTenants => Set<UserTenant>();
    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<StudentDocument> StudentDocuments => Set<StudentDocument>();
    public DbSet<MebGroup> MebGroups => Set<MebGroup>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<ScheduleSlot> ScheduleSlots => Set<ScheduleSlot>();
    public DbSet<Attendance> Attendances => Set<Attendance>();
    public DbSet<Exam> Exams => Set<Exam>();
    public DbSet<ExamResult> ExamResults => Set<ExamResult>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<MebbisTransferJob> MebbisTransferJobs => Set<MebbisTransferJob>();
    public DbSet<MebbisTransferItem> MebbisTransferItems => Set<MebbisTransferItem>();
    public DbSet<AiQuery> AiQueries => Set<AiQuery>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<MebbisSyncLog> MebbisSyncLogs => Set<MebbisSyncLog>();
    public DbSet<AccountTransaction> AccountTransactions => Set<AccountTransaction>();
    public DbSet<LicenseReminderLog> LicenseReminderLogs => Set<LicenseReminderLog>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<TenantApiToken> TenantApiTokens => Set<TenantApiToken>();
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<SrcCourseTemplate> SrcCourseTemplates => Set<SrcCourseTemplate>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    public override int SaveChanges()
    {
        ApplyTenantInformation();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyTenantInformation();
        return base.SaveChangesAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        ApplyTenantFilters(modelBuilder);
        ConfigureTenantIndexes(modelBuilder);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<Tenant>()
            .HasIndex(t => t.Username)
            .IsUnique()
            .HasFilter("[Username] IS NOT NULL");

        modelBuilder.Entity<UserTenant>()
            .HasIndex(x => new { x.UserId, x.TenantId })
            .IsUnique();

        modelBuilder.Entity<UserTenant>()
            .HasOne(ut => ut.User)
            .WithMany(u => u.UserTenants)
            .HasForeignKey(ut => ut.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserTenant>()
            .HasOne(ut => ut.Tenant)
            .WithMany(t => t.UserTenants)
            .HasForeignKey(ut => ut.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configure decimal precision
        modelBuilder.Entity<ExamResult>().Property(e => e.Score).HasPrecision(5, 2);
        modelBuilder.Entity<Payment>().Property(p => p.Amount).HasPrecision(18, 2);
        modelBuilder.Entity<Payment>().Property(p => p.PenaltyAmount).HasPrecision(18, 2);
        modelBuilder.Entity<StudentDocument>().Property(d => d.OcrConfidence).HasPrecision(5, 4);
        modelBuilder.Entity<Enrollment>().Property(e => e.Fee).HasPrecision(18, 2);
        modelBuilder.Entity<Enrollment>().Property(e => e.PaidAmount).HasPrecision(18, 2);
        modelBuilder.Entity<Attendance>().Property(a => a.GpsLat).HasPrecision(18, 10);
        modelBuilder.Entity<Attendance>().Property(a => a.GpsLng).HasPrecision(18, 10);
        modelBuilder.Entity<Attendance>().Property(a => a.GpsAccuracy).HasPrecision(18, 10);
        modelBuilder.Entity<AccountTransaction>().Property(a => a.Amount).HasPrecision(18, 2);

        // Configure relationships
        modelBuilder.Entity<StudentDocument>()
            .HasOne(sd => sd.Student)
            .WithMany(s => s.Documents)
            .HasForeignKey(sd => sd.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Enrollment>()
            .HasOne(e => e.Student)
            .WithMany(s => s.Enrollments)
            .HasForeignKey(e => e.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Enrollment>()
            .HasOne(e => e.MebGroup)
            .WithMany(g => g.Enrollments)
            .HasForeignKey(e => e.MebGroupId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ScheduleSlot>()
            .HasOne(ss => ss.MebGroup)
            .WithMany(g => g.ScheduleSlots)
            .HasForeignKey(ss => ss.MebGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Attendance>()
            .HasOne(a => a.Student)
            .WithMany(s => s.Attendances)
            .HasForeignKey(a => a.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Attendance>()
            .HasOne(a => a.ScheduleSlot)
            .WithMany(ss => ss.Attendances)
            .HasForeignKey(a => a.ScheduleSlotId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ExamResult>()
            .HasOne(er => er.Student)
            .WithMany(s => s.ExamResults)
            .HasForeignKey(er => er.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ExamResult>()
            .HasOne(er => er.Exam)
            .WithMany(e => e.ExamResults)
            .HasForeignKey(er => er.ExamId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.Student)
            .WithMany(s => s.Payments)
            .HasForeignKey(p => p.StudentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Payment>()
            .HasOne(p => p.Enrollment)
            .WithMany()
            .HasForeignKey(p => p.EnrollmentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Exam>()
            .HasOne(e => e.MebGroup)
            .WithMany(g => g.Exams)
            .HasForeignKey(e => e.MebGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MebbisTransferJob>()
            .HasOne(j => j.MebGroup)
            .WithMany(g => g.MebbisTransferJobs)
            .HasForeignKey(j => j.MebGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MebbisTransferItem>()
            .HasOne(mti => mti.Enrollment)
            .WithMany(e => e.MebbisTransferItems)
            .HasForeignKey(mti => mti.EnrollmentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Reminder>()
            .HasOne(reminder => reminder.Student)
            .WithMany(student => student.Reminders)
            .HasForeignKey(reminder => reminder.StudentId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Reminder>()
            .HasOne(reminder => reminder.StudentDocument)
            .WithMany(document => document.Reminders)
            .HasForeignKey(reminder => reminder.StudentDocumentId)
            .OnDelete(DeleteBehavior.SetNull);

        // Configure miscellaneous indexes
        modelBuilder.Entity<Student>()
            .HasIndex(s => new { s.TenantId, s.TcKimlikNo })
            .IsUnique();

        modelBuilder.Entity<Student>()
            .Property(s => s.FaceProfileId)
            .HasMaxLength(200);

        modelBuilder.Entity<Student>()
            .Property(s => s.SelectedSrcCourses)
            .HasMaxLength(50); // "1,2,3,4" formatında, max 50 karakter yeterli

        modelBuilder.Entity<MebGroup>()
            .HasIndex(m => new { m.TenantId, m.Year, m.Month, m.GroupNo, m.Branch })
            .IsUnique();

        modelBuilder.Entity<AiQuery>()
            .Property(ai => ai.Question)
            .HasMaxLength(2000);

        modelBuilder.Entity<AiQuery>()
            .Property(ai => ai.Answer)
            .HasMaxLength(8000);

        modelBuilder.Entity<AiQuery>()
            .Property(ai => ai.Provider)
            .HasMaxLength(50);

        modelBuilder.Entity<AiQuery>()
            .HasIndex(ai => new { ai.TenantId, ai.CreatedAt });

        modelBuilder.Entity<Reminder>()
            .HasIndex(reminder => new { reminder.TenantId, reminder.Status });

        modelBuilder.Entity<Reminder>()
            .HasIndex(reminder => new { reminder.TenantId, reminder.ScheduledAt });

        modelBuilder.Entity<MebbisSyncLog>()
            .HasIndex(log => new { log.TenantId, log.CreatedAt });

        modelBuilder.Entity<LicenseReminderLog>()
            .HasIndex(log => new { log.TenantId, log.ThresholdDays, log.Channel });

        modelBuilder.Entity<LicenseReminderLog>()
            .HasIndex(log => new { log.TenantId, log.CreatedAt });

        modelBuilder.Entity<AuditLog>()
            .HasIndex(log => new { log.CreatedAt });

        modelBuilder.Entity<AuditLog>()
            .HasIndex(log => new { log.TenantId });
        modelBuilder.Entity<AuditLog>()
            .Property(log => log.Action)
            .HasMaxLength(100);
        modelBuilder.Entity<AuditLog>()
            .Property(log => log.ActorName)
            .HasMaxLength(200);
        modelBuilder.Entity<AuditLog>()
            .Property(log => log.ActorRole)
            .HasMaxLength(100);
        modelBuilder.Entity<AuditLog>()
            .Property(log => log.EntityType)
            .HasMaxLength(100);
        modelBuilder.Entity<AuditLog>()
            .Property(log => log.EntityId)
            .HasMaxLength(200);
    }

    private void ApplyTenantInformation()
    {
        foreach (var entry in ChangeTracker.Entries<TenantEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (string.IsNullOrWhiteSpace(entry.Entity.TenantId))
                {
                    entry.Entity.TenantId = _tenantProvider.TenantId;
                }

                if (entry.Property(x => x.CreatedAt).CurrentValue == default)
                {
                    entry.Entity.CreatedAt = DateTime.UtcNow;
                }
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
    }

    private void ApplyTenantFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(TenantEntity).IsAssignableFrom(entityType.ClrType))
            {
                var method = typeof(SrcDbContext)
                    .GetMethod(nameof(ConfigureTenantFilter), BindingFlags.NonPublic | BindingFlags.Instance)!
                    .MakeGenericMethod(entityType.ClrType);

                method.Invoke(this, new object[] { modelBuilder });
            }
        }
    }

    private void ConfigureTenantFilter<TEntity>(ModelBuilder builder) where TEntity : TenantEntity
    {
        builder.Entity<TEntity>().HasQueryFilter(e => e.TenantId == _tenantProvider.TenantId);
    }

    private static void ConfigureTenantIndexes(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Student>()
            .HasIndex(x => new { x.TenantId, x.CreatedAt });

        modelBuilder.Entity<MebGroup>()
            .HasIndex(x => new { x.TenantId, x.MebApprovalStatus });

        modelBuilder.Entity<Enrollment>()
            .HasIndex(x => new { x.TenantId, x.MebGroupId });

        modelBuilder.Entity<Attendance>()
            .HasIndex(x => new { x.TenantId, x.ScheduleSlotId, x.CreatedAt });

        modelBuilder.Entity<Exam>()
            .HasIndex(x => new { x.TenantId, x.ExamDate });

        modelBuilder.Entity<ExamResult>()
            .HasIndex(x => new { x.TenantId, x.ExamId, x.StudentId });

        modelBuilder.Entity<Payment>()
            .HasIndex(x => new { x.TenantId, x.Status, x.DueDate });

        modelBuilder.Entity<Reminder>()
            .HasIndex(x => new { x.TenantId, x.Type, x.Channel });

        modelBuilder.Entity<AccountTransaction>()
            .HasIndex(x => new { x.TenantId, x.TransactionDate });

        modelBuilder.Entity<AccountTransaction>()
            .HasIndex(x => new { x.TenantId, x.Type, x.Category });

        modelBuilder.Entity<TenantApiToken>()
            .HasIndex(x => new { x.TenantId, x.TokenPrefix })
            .IsUnique();

        modelBuilder.Entity<TenantApiToken>()
            .HasIndex(x => new { x.TenantId, x.IsRevoked, x.ExpiresAt });

        // Certificate ilişkileri
        modelBuilder.Entity<Certificate>()
            .HasOne(c => c.Student)
            .WithMany(s => s.Certificates)
            .HasForeignKey(c => c.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Certificate>()
            .HasOne(c => c.MebGroup)
            .WithMany(g => g.Certificates)
            .HasForeignKey(c => c.MebGroupId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Certificate>()
            .HasOne(c => c.WrittenExam)
            .WithMany()
            .HasForeignKey(c => c.WrittenExamId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Certificate>()
            .HasOne(c => c.PracticalExam)
            .WithMany()
            .HasForeignKey(c => c.PracticalExamId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Certificate>()
            .HasIndex(x => new { x.TenantId, x.CertificateNumber })
            .IsUnique();

        modelBuilder.Entity<Certificate>()
            .HasIndex(x => new { x.TenantId, x.StudentId });

        modelBuilder.Entity<Certificate>()
            .HasIndex(x => new { x.TenantId, x.MebGroupId });

        // SrcCourseTemplate index'leri
        modelBuilder.Entity<SrcCourseTemplate>()
            .HasIndex(x => new { x.TenantId, x.SrcType, x.SubjectCode })
            .IsUnique();

        modelBuilder.Entity<SrcCourseTemplate>()
            .HasIndex(x => new { x.TenantId, x.SrcType, x.Order });

        // PasswordResetToken index'leri
        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(x => new { x.Username, x.Token, x.IsUsed });

        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(x => x.ExpiresAt);
    }
}


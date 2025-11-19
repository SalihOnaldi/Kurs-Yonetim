using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Notifications;
using SRC.Application.Options;
using SRC.Infrastructure.Data;
using System.Text;

namespace SRC.Infrastructure.Jobs;

public class LicenseSummaryEmailJob
{
    private readonly SrcDbContext _context;
    private readonly IEmailSender _emailSender;
    private readonly LicenseSummaryEmailOptions _options;
    private readonly ILogger<LicenseSummaryEmailJob> _logger;
    private readonly IAuditLogger _auditLogger;
    private readonly ILicenseEventPublisher _eventPublisher;

    public LicenseSummaryEmailJob(
        SrcDbContext context,
        IEmailSender emailSender,
        IOptions<LicenseSummaryEmailOptions> options,
        ILogger<LicenseSummaryEmailJob> logger,
        IAuditLogger auditLogger,
        ILicenseEventPublisher eventPublisher)
    {
        _context = context;
        _emailSender = emailSender;
        _options = options.Value;
        _logger = logger;
        _auditLogger = auditLogger;
        _eventPublisher = eventPublisher;
    }

    [Queue("maintenance")]
    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled || _options.Recipients.Length == 0)
        {
            _logger.LogDebug("License summary email disabled or recipients missing.");
            return;
        }

        var now = DateTime.UtcNow;
        var sevenDaysLater = now.AddDays(7);
        var dayAgo = now.AddDays(-1);

        var tenants = await _context.Tenants.IgnoreQueryFilters().ToListAsync(cancellationToken);
        var totalLicenses = tenants.Count;
        var expiringSoon = tenants.Count(t => t.ExpireDate.HasValue && t.ExpireDate >= now && t.ExpireDate <= sevenDaysLater);
        var expired = tenants.Count(t => t.ExpireDate.HasValue && t.ExpireDate < now);

        var importsLastDay = await _context.AuditLogs.AsNoTracking()
            .CountAsync(log => log.Action == "license_import" && log.CreatedAt >= dayAgo, cancellationToken);

        var exportsLastDay = await _context.AuditLogs.AsNoTracking()
            .CountAsync(log => log.Action == "license_export" && log.CreatedAt >= dayAgo, cancellationToken);

        var reminderFailures = await _context.LicenseReminderLogs.AsNoTracking()
            .CountAsync(log => log.Status == "failed" && log.CreatedAt >= dayAgo, cancellationToken);

        var expiringList = tenants
            .Where(t => t.ExpireDate.HasValue && t.ExpireDate.Value >= now && t.ExpireDate.Value <= sevenDaysLater)
            .OrderBy(t => t.ExpireDate)
            .Select(t => $"{t.Name} — {t.ExpireDate:dd.MM.yyyy}")
            .Take(10)
            .ToList();

        var builder = new StringBuilder();
        builder.AppendLine("Merhaba HQ ekibi,\n");
        builder.AppendLine("Güncel lisans özeti aşağıdadır:");
        builder.AppendLine($"• Toplam Lisans: {totalLicenses}");
        builder.AppendLine($"• Yakında Dolacak (<=7 gün): {expiringSoon}");
        builder.AppendLine($"• Süresi Dolmuş: {expired}");
        builder.AppendLine();
        builder.AppendLine("Son 24 saat:");
        builder.AppendLine($"• CSV İçe Aktarma: {importsLastDay}");
        builder.AppendLine($"• CSV Dışa Aktarma: {exportsLastDay}");
        builder.AppendLine($"• Hatırlatma Hataları: {reminderFailures}");
        builder.AppendLine();

        if (expiringList.Count > 0)
        {
            builder.AppendLine("Önümüzdeki 7 gün içinde dolacak lisanslar:");
            foreach (var line in expiringList)
            {
                builder.AppendLine($"- {line}");
            }
            builder.AppendLine();
        }

        builder.AppendLine("Bu e-posta otomatik olarak gönderilmiştir.");

        var body = builder.ToString();
        foreach (var recipient in _options.Recipients)
        {
            try
            {
                await _emailSender.SendAsync(recipient, _options.Subject, body, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "License summary email failed for {Recipient}", recipient);
                await _eventPublisher.PublishAsync("license_summary_failed", new { recipient, error = ex.Message }, cancellationToken);
            }
        }

        var metadata = new
        {
            totalLicenses,
            expiringSoon,
            expired,
            importsLastDay,
            exportsLastDay,
            reminderFailures
        };
        await _auditLogger.LogAsync("license_summary_sent", "license_summary", metadata: metadata, cancellationToken: cancellationToken);
        await _eventPublisher.PublishAsync("license_summary_sent", metadata, cancellationToken);
    }
}



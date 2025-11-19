using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Notifications;
using SRC.Application.Options;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;

namespace SRC.Infrastructure.Jobs;

public class LicenseExpiryReminderJob
{
    private readonly SrcDbContext _context;
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;
    private readonly ILicenseEventPublisher _eventPublisher;
    private readonly LicenseReminderOptions _options;
    private readonly ILogger<LicenseExpiryReminderJob> _logger;

    public LicenseExpiryReminderJob(
        SrcDbContext context,
        IEmailSender emailSender,
        ISmsSender smsSender,
        ILicenseEventPublisher eventPublisher,
        IOptions<LicenseReminderOptions> options,
        ILogger<LicenseExpiryReminderJob> logger)
    {
        _context = context;
        _emailSender = emailSender;
        _smsSender = smsSender;
        _eventPublisher = eventPublisher;
        _options = options.Value;
        _logger = logger;
    }

    [Queue("maintenance")]
    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var thresholds = _options.ThresholdDays
            .Distinct()
            .Where(day => day >= 0)
            .OrderByDescending(day => day)
            .ToArray();

        if (thresholds.Length == 0)
        {
            _logger.LogWarning("License reminder thresholds not configured. Job skipped.");
            return;
        }

        var today = DateTime.UtcNow.Date;
        var tenants = await _context.Tenants
            .AsNoTracking()
            .Where(t => t.IsActive && t.ExpireDate != null)
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.ExpireDate,
                t.City,
                t.ContactEmail,
                t.ContactPhone
            })
            .ToListAsync(cancellationToken);

        var logsToInsert = new List<LicenseReminderLog>();
        var eventsToPublish = new List<(string EventType, object Payload)>();

        foreach (var tenant in tenants)
        {
            var daysRemaining = (tenant.ExpireDate!.Value.Date - today).Days;

            foreach (var threshold in thresholds)
            {
                if (daysRemaining != threshold)
                {
                    continue;
                }

                if (await _context.LicenseReminderLogs
                        .AnyAsync(log => log.TenantId == tenant.Id && log.ThresholdDays == threshold, cancellationToken))
                {
                    continue;
                }

                var (channel, recipientEmail, recipientPhone) = DetermineChannel(tenant);

                if (channel == null)
                {
                    logsToInsert.Add(new LicenseReminderLog
                    {
                        TenantId = tenant.Id,
                        ThresholdDays = threshold,
                        Status = "skipped",
                        Error = "İletişim bilgisi bulunamadığı için hatırlatma gönderilmedi."
                    });
                    continue;
                }

                var log = new LicenseReminderLog
                {
                    TenantId = tenant.Id,
                    Channel = channel,
                    ThresholdDays = threshold,
                    Recipient = channel switch
                    {
                        "email" => recipientEmail,
                        "sms" => recipientPhone,
                        "both" => $"{recipientEmail};{recipientPhone}",
                        _ => recipientEmail ?? recipientPhone
                    },
                    Status = "queued"
                };

                try
                {
                    var tasks = new List<Task>();
                    var subject = $"[{tenant.Name}] Lisans süreniz {threshold} gün içinde dolacak";
                    var body = BuildEmailBody(tenant.Name, tenant.City, tenant.ExpireDate!.Value, threshold);
                    var smsBody = BuildSmsBody(tenant.Name, tenant.ExpireDate.Value, threshold);

                    if (channel is "email" or "both" && recipientEmail != null)
                    {
                        tasks.Add(_emailSender.SendAsync(recipientEmail, subject, body, cancellationToken));
                    }

                    if (_options.EnableSms && channel is "sms" or "both" && recipientPhone != null)
                    {
                        tasks.Add(_smsSender.SendAsync(recipientPhone, smsBody, cancellationToken));
                    }

                    await Task.WhenAll(tasks);

                    log.Status = "sent";
                    log.SentAt = DateTime.UtcNow;
                    eventsToPublish.Add(("license_reminder_sent", new
                    {
                        tenant.Id,
                        tenant.Name,
                        threshold,
                        channel = log.Channel,
                        recipient = log.Recipient
                    }));
                }
                catch (Exception ex)
                {
                    log.Status = "failed";
                    log.Error = ex.Message;
                    _logger.LogError(ex, "Tenant {TenantId}: License reminder failed for threshold {Threshold}", tenant.Id, threshold);
                    eventsToPublish.Add(("license_reminder_failed", new
                    {
                        tenant.Id,
                        tenant.Name,
                        threshold,
                        channel = log.Channel,
                        recipient = log.Recipient,
                        error = ex.Message
                    }));
                }

                logsToInsert.Add(log);
            }
        }

        if (logsToInsert.Count > 0)
        {
            await _context.LicenseReminderLogs.AddRangeAsync(logsToInsert, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);
        }

        foreach (var (eventType, payload) in eventsToPublish)
        {
            await _eventPublisher.PublishAsync(eventType, payload, cancellationToken);
        }
    }

    private (string? channel, string? email, string? phone) DetermineChannel(dynamic tenant)
    {
        var hasEmail = !string.IsNullOrWhiteSpace((string?)tenant.ContactEmail) || !string.IsNullOrWhiteSpace(_options.DefaultEmail);
        var hasPhone = _options.EnableSms && (!string.IsNullOrWhiteSpace((string?)tenant.ContactPhone) || !string.IsNullOrWhiteSpace(_options.DefaultPhone));

        if (!hasEmail && !hasPhone)
        {
            return (null, null, null);
        }

        var email = !string.IsNullOrWhiteSpace((string?)tenant.ContactEmail) ? tenant.ContactEmail : _options.DefaultEmail;
        var phone = !string.IsNullOrWhiteSpace((string?)tenant.ContactPhone) ? tenant.ContactPhone : _options.DefaultPhone;

        if (hasEmail && hasPhone)
        {
            return ("both", email, phone);
        }

        if (hasEmail)
        {
            return ("email", email, null);
        }

        return ("sms", null, phone);
    }

    private static string BuildEmailBody(string tenantName, string? city, DateTime expireDate, int threshold)
    {
        var lines = new List<string>
        {
            $"Merhaba {tenantName} ekibi,",
            string.Empty,
            $"Lisansınız {expireDate:dd.MM.yyyy} tarihinde sona erecek. (Kalan gün: {threshold})",
        };

        if (!string.IsNullOrWhiteSpace(city))
        {
            lines.Add($"Şubeniz: {city}");
        }

        lines.AddRange(new[]
        {
            "Lisansınızı uzatmak veya sorularınız için HQ ekibimizle iletişime geçebilirsiniz.",
            string.Empty,
            "İyi çalışmalar."
        });

        return string.Join(Environment.NewLine, lines);
    }

    private static string BuildSmsBody(string tenantName, DateTime expireDate, int threshold)
    {
        return $"{tenantName} lisansınız {expireDate:dd.MM} tarihinde dolacak. (Kalan {threshold} gün) HQ ile iletişime geçin.";
    }
}



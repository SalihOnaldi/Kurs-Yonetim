using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces.Notifications;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;
using System.Linq;
using Hangfire;
using SRC.Application.Interfaces.Tenancy;

namespace SRC.Infrastructure.Jobs;

public class ReminderDispatchJob
{
    private readonly SrcDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;
    private readonly ILogger<ReminderDispatchJob> _logger;

    public ReminderDispatchJob(
        SrcDbContext context,
        ITenantProvider tenantProvider,
        IEmailSender emailSender,
        ISmsSender smsSender,
        ILogger<ReminderDispatchJob> logger)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _emailSender = emailSender;
        _smsSender = smsSender;
        _logger = logger;
    }

    [Queue("critical")]
    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var tenantIds = await _context.Tenants
            .AsNoTracking()
            .Where(tenant => tenant.IsActive)
            .Select(tenant => tenant.Id)
            .ToListAsync(cancellationToken);

        foreach (var tenantId in tenantIds)
        {
            _tenantProvider.SetTenant(tenantId);
            await ExecuteForTenantAsync(tenantId, cancellationToken);
        }
    }

    private async Task ExecuteForTenantAsync(string tenantId, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var reminders = await _context.Reminders
            .Where(reminder => reminder.Status == "pending" && reminder.ScheduledAt <= now)
            .Include(reminder => reminder.Student)
            .Include(reminder => reminder.StudentDocument)
            .OrderBy(reminder => reminder.ScheduledAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        if (reminders.Count == 0)
        {
            _logger.LogDebug("Tenant {TenantId}: No reminders ready for delivery.", tenantId);
            return;
        }

        _logger.LogInformation("Tenant {TenantId}: Processing {Count} reminders.", tenantId, reminders.Count);

        foreach (var reminder in reminders)
        {
            reminder.Status = "queued";
            reminder.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        var payloads = reminders.Select(ReminderDispatchPayload.FromEntity).ToList();
        var results = new ConcurrentBag<ReminderDispatchResult>();
        var parallelOptions = new ParallelOptions
        {
            CancellationToken = cancellationToken,
            MaxDegreeOfParallelism = Math.Clamp(Environment.ProcessorCount, 2, 8)
        };

        await Parallel.ForEachAsync(payloads, parallelOptions, async (payload, token) =>
        {
            try
            {
                await DispatchReminderAsync(payload, token);
                results.Add(ReminderDispatchResult.FromSuccess(payload.ReminderId, DateTime.UtcNow));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tenant {TenantId}: Reminder dispatch failed for reminder {ReminderId}", tenantId, payload.ReminderId);
                results.Add(ReminderDispatchResult.FromFailure(payload.ReminderId, ex.Message));
            }
        });

        var resultLookup = results.GroupBy(result => result.ReminderId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(r => r.CompletedAt).First());

        foreach (var reminder in reminders)
        {
            if (!resultLookup.TryGetValue(reminder.Id, out var outcome))
            {
                continue;
            }

            reminder.UpdatedAt = outcome.CompletedAt;

            if (outcome.IsSuccess)
            {
                reminder.Status = "sent";
                reminder.SentAt = outcome.CompletedAt;
                reminder.Error = null;
            }
            else
            {
                reminder.Status = "failed";
                reminder.Error = outcome.Error;
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Tenant {TenantId}: Reminder dispatch completed.", tenantId);
    }

    private async Task DispatchReminderAsync(ReminderDispatchPayload payload, CancellationToken cancellationToken)
    {
        var tasks = new List<Task>();

        if (payload.Channel is "email" or "both")
        {
            if (!string.IsNullOrWhiteSpace(payload.StudentEmail))
            {
                tasks.Add(_emailSender.SendAsync(
                    payload.StudentEmail!,
                    payload.Title,
                    BuildEmailBody(payload),
                    cancellationToken));
            }
            else if (payload.Channel == "email")
            {
                throw new InvalidOperationException("Öğrencinin e-posta adresi bulunamadı.");
            }
        }

        if (payload.Channel is "sms" or "both")
        {
            if (!string.IsNullOrWhiteSpace(payload.StudentPhone))
            {
                tasks.Add(_smsSender.SendAsync(
                    payload.StudentPhone!,
                    BuildSmsBody(payload),
                    cancellationToken));
            }
            else if (payload.Channel == "sms")
            {
                throw new InvalidOperationException("Öğrencinin telefon numarası bulunamadı.");
            }
        }

        if (tasks.Count == 0)
        {
            throw new InvalidOperationException("Hiçbir kanal için gönderim yapılamadı.");
        }

        await Task.WhenAll(tasks);
    }

    private static string BuildEmailBody(ReminderDispatchPayload payload)
    {
        var lines = new List<string>
        {
            $"Merhaba {payload.StudentFirstName} {payload.StudentLastName},",
            string.Empty,
            payload.Message,
            string.Empty,
            "Herhangi bir sorunuz varsa kurs yönetimi ile iletişime geçebilirsiniz.",
            string.Empty,
            "İyi çalışmalar."
        };

        return string.Join(Environment.NewLine, lines);
    }

    private static string BuildSmsBody(ReminderDispatchPayload payload)
    {
        return $"{payload.StudentFirstName} {payload.StudentLastName}, {payload.Message}";
    }

    private sealed record ReminderDispatchPayload(
        int ReminderId,
        string Title,
        string Message,
        string Channel,
        string? StudentFirstName,
        string? StudentLastName,
        string? StudentEmail,
        string? StudentPhone)
    {
        public static ReminderDispatchPayload FromEntity(Reminder reminder) => new(
            reminder.Id,
            reminder.Title,
            reminder.Message,
            reminder.Channel,
            reminder.Student?.FirstName,
            reminder.Student?.LastName,
            reminder.Student?.Email,
            reminder.Student?.Phone);
    }

    private sealed record ReminderDispatchResult(int ReminderId, bool IsSuccess, string? Error, DateTime CompletedAt)
    {
        public static ReminderDispatchResult FromSuccess(int reminderId, DateTime completedAt) =>
            new(reminderId, true, null, completedAt);

        public static ReminderDispatchResult FromFailure(int reminderId, string? error) =>
            new(reminderId, false, error, DateTime.UtcNow);
    }
}



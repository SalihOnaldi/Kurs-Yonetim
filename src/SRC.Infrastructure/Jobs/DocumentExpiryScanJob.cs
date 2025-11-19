using System;
using System.Collections.Generic;
using System.Linq;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using Hangfire;
using SRC.Application.Interfaces.Tenancy;

namespace SRC.Infrastructure.Jobs;

public class DocumentExpiryScanJob
{
    private readonly SrcDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<DocumentExpiryScanJob> _logger;

    public DocumentExpiryScanJob(
        SrcDbContext context,
        ITenantProvider tenantProvider,
        ILogger<DocumentExpiryScanJob> logger)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    [Queue("maintenance")]
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
        var today = DateTime.UtcNow.Date;
        var limit = today.AddDays(30);

        var candidates = await _context.StudentDocuments
            .AsNoTracking()
            .Include(document => document.Student)
            .Where(document =>
                document.DocDate.HasValue &&
                document.DocDate.Value.Date >= today &&
                document.DocDate.Value.Date <= limit)
            .Select(document => new
            {
                Document = document,
                Student = document.Student
            })
            .ToListAsync(cancellationToken);

        if (candidates.Count == 0)
        {
            _logger.LogInformation("Tenant {TenantId}: No documents within the next 30 days.", tenantId);
            return;
        }

        var documentIds = candidates.Select(candidate => candidate.Document.Id).ToList();

        var existingRemindersLookup = await _context.Reminders
            .AsNoTracking()
            .Where(reminder =>
                reminder.Type == "document_expiry" &&
                reminder.StudentDocumentId.HasValue &&
                documentIds.Contains(reminder.StudentDocumentId.Value) &&
                reminder.Status != "sent")
            .GroupBy(reminder => reminder.StudentDocumentId!.Value)
            .ToDictionaryAsync(group => group.Key, group => group.ToList(), cancellationToken);

        var remindersBag = new ConcurrentBag<Reminder>();
        var parallelOptions = new ParallelOptions
        {
            CancellationToken = cancellationToken,
            MaxDegreeOfParallelism = Math.Clamp(Environment.ProcessorCount, 2, 8)
        };

        await Parallel.ForEachAsync(candidates, parallelOptions, (candidate, token) =>
        {
            if (candidate.Student == null)
            {
                return ValueTask.CompletedTask;
            }

            var document = candidate.Document;
            if (existingRemindersLookup.TryGetValue(document.Id, out var reminderList) &&
                reminderList.Any(reminder =>
                    reminder.ScheduledAt.Date >= today &&
                    reminder.Status is "pending" or "queued"))
            {
                return ValueTask.CompletedTask;
            }

            var scheduledAt = document.DocDate!.Value.AddDays(-7);
            if (scheduledAt < DateTime.UtcNow)
            {
                scheduledAt = DateTime.UtcNow.AddMinutes(5);
            }

            var reminder = new Reminder
            {
                StudentId = candidate.Student.Id,
                StudentDocumentId = document.Id,
                Type = "document_expiry",
                Channel = "both",
                Title = $"{document.DocumentType} belgenizin süresi dolmak üzere",
                Message =
                    $"{candidate.Student.FirstName} {candidate.Student.LastName}, {document.DocumentType} belgenizin son geçerlilik tarihi {document.DocDate:dd.MM.yyyy}. Lütfen güncelleme işlemlerini tamamlayın.",
                ScheduledAt = scheduledAt,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };

            remindersBag.Add(reminder);
            return ValueTask.CompletedTask;
        });

        var remindersToAdd = remindersBag.ToList();

        if (remindersToAdd.Count == 0)
        {
            _logger.LogInformation("Tenant {TenantId}: No new reminders created.", tenantId);
            return;
        }

        await _context.Reminders.AddRangeAsync(remindersToAdd, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Tenant {TenantId}: {Count} reminders queued.", tenantId, remindersToAdd.Count);
    }
}



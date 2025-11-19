using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SRC.Application.DTOs.Notification;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Infrastructure.Services;

public class NotificationService : INotificationService
{
    private readonly SrcDbContext _context;
    private readonly IMemoryCache _cache;

    private static readonly MemoryCacheEntryOptions NotificationsCacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
    };

    private static readonly MemoryCacheEntryOptions SummaryCacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(45)
    };

    public NotificationService(SrcDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<List<NotificationDto>> GetNotificationsAsync(string? category, string? severity, int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 100);
        var cacheKey = $"notifications:list:{category ?? "_"}:{severity ?? "_"}:{limit}";

        if (_cache.TryGetValue(cacheKey, out List<NotificationDto>? cached) && cached != null)
        {
            return cached;
        }

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.AddDays(-7);
        var upcomingLimit = now.AddDays(7);

        var notifications = new List<NotificationDto>();

        if (category is null or "finance")
        {
            var overduePayments = await _context.Payments
                .AsNoTracking()
                .Include(p => p.Student)
                .Where(p => p.Status == "pending" && p.DueDate < now)
                .OrderBy(p => p.DueDate)
                .Take(limit)
                .ToListAsync();

            notifications.AddRange(overduePayments.Select(p => new NotificationDto
            {
                Id = $"payment-{p.Id}",
                Title = "Geciken Ödeme",
                Message = $"{p.Student.FirstName} {p.Student.LastName} için {p.Amount + (p.PenaltyAmount ?? 0m):C} tutarında ödeme gecikti.",
                Category = "finance",
                Severity = "warning",
                CreatedAt = p.DueDate,
                RelatedEntityType = "payment",
                RelatedEntityId = p.Id,
                Metadata = new Dictionary<string, string>
                {
                    ["Amount"] = p.Amount.ToString("F2"),
                    ["Penalty"] = (p.PenaltyAmount ?? 0m).ToString("F2"),
                    ["DueDate"] = p.DueDate.ToString("o"),
                    ["StudentId"] = p.StudentId.ToString()
                }
            }));
        }

        if (category is null or "transfer")
        {
            var failedTransfers = await _context.MebbisTransferJobs
                .AsNoTracking()
                .Include(j => j.Course)
                    .ThenInclude(c => c.MebGroup)
                .Where(j => j.Status == "failed" && j.CreatedAt >= sevenDaysAgo)
                .OrderByDescending(j => j.CreatedAt)
                .Take(limit)
                .ToListAsync();

            notifications.AddRange(failedTransfers.Select(j => new NotificationDto
            {
                Id = $"transfer-{j.Id}",
                Title = "MEBBİS Aktarımı Başarısız",
                Message = $"SRC{j.Course.SrcType} {j.Course.MebGroup.Branch} grup aktarımı başarısız oldu. {j.FailureCount} kayıt hatalı.",
                Category = "transfer",
                Severity = "danger",
                CreatedAt = j.CreatedAt,
                RelatedEntityType = "mebbisTransferJob",
                RelatedEntityId = j.Id,
                Metadata = new Dictionary<string, string>
                {
                    ["CourseId"] = j.CourseId.ToString(),
                    ["Mode"] = j.Mode,
                    ["ErrorMessage"] = j.ErrorMessage ?? string.Empty
                }
            }));
        }

        if (category is null or "exam")
        {
            var upcomingExams = await _context.Exams
                .AsNoTracking()
                .Include(e => e.Course)
                    .ThenInclude(c => c.MebGroup)
                .Where(e => e.ExamDate >= now && e.ExamDate <= upcomingLimit)
                .OrderBy(e => e.ExamDate)
                .Take(limit)
                .ToListAsync();

            notifications.AddRange(upcomingExams.Select(e => new NotificationDto
            {
                Id = $"exam-{e.Id}",
                Title = "Yaklaşan Sınav",
                Message = $"SRC{e.Course.SrcType} sınavı {e.ExamDate:dd.MM.yyyy HH:mm} tarihinde ({e.Course.MebGroup.Branch}) yapılacak.",
                Category = "exam",
                Severity = "info",
                CreatedAt = e.ExamDate,
                RelatedEntityType = "exam",
                RelatedEntityId = e.Id,
                Metadata = new Dictionary<string, string>
                {
                    ["ExamType"] = e.ExamType,
                    ["CourseId"] = e.CourseId.ToString(),
                    ["Status"] = e.Status
                }
            }));
        }

        if (!string.IsNullOrWhiteSpace(severity))
        {
            var severityNormalized = severity.Trim().ToLowerInvariant();
            notifications = notifications
                .Where(n => string.Equals(n.Severity, severityNormalized, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        notifications = notifications
            .OrderByDescending(n => n.CreatedAt)
            .Take(limit)
            .ToList();

        _cache.Set(cacheKey, notifications, NotificationsCacheOptions);

        return notifications;
    }

    public async Task<NotificationSummaryDto> GetSummaryAsync()
    {
        if (_cache.TryGetValue("notifications:summary", out NotificationSummaryDto? cached) && cached != null)
        {
            return cached;
        }

        var now = DateTime.UtcNow;
        var sevenDaysAgo = now.AddDays(-7);
        var upcomingLimit = now.AddDays(7);

        var overduePayments = await _context.Payments
            .AsNoTracking()
            .CountAsync(p => p.Status == "pending" && p.DueDate < now);

        var failedTransfers = await _context.MebbisTransferJobs
            .AsNoTracking()
            .CountAsync(j => j.Status == "failed" && j.CreatedAt >= sevenDaysAgo);

        var upcomingExams = await _context.Exams
            .AsNoTracking()
            .CountAsync(e => e.ExamDate >= now && e.ExamDate <= upcomingLimit);

        var summary = new NotificationSummaryDto
        {
            OverduePayments = overduePayments,
            FailedTransfers = failedTransfers,
            UpcomingExams = upcomingExams,
            TotalCount = overduePayments + failedTransfers + upcomingExams
        };

        _cache.Set("notifications:summary", summary, SummaryCacheOptions);

        return summary;
    }
}


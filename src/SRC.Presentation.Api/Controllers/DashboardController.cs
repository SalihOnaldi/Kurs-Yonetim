using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IMemoryCache _cache;
    private static readonly MemoryCacheEntryOptions SummaryCacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
    };

    private static readonly MemoryCacheEntryOptions ShortCacheOptions = new()
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(20)
    };

    public DashboardController(SrcDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    [HttpGet("summary")]
    [ResponseCache(Duration = 30, Location = ResponseCacheLocation.Client, NoStore = false)]
    public async Task<ActionResult> GetSummary()
    {
        if (_cache.TryGetValue("dashboard:summary", out object? cachedSummary))
        {
            return Ok(cachedSummary);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfMonth = new DateTime(today.Year, today.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1);

        var activeCourseCount = await _context.Courses
            .AsNoTracking()
            .Where(c =>
                c.MebGroup.StartDate <= endOfMonth &&
                c.MebGroup.EndDate >= startOfMonth &&
                c.MebApprovalStatus != "rejected")
            .CountAsync();

        var totalStudentCount = await _context.Students.AsNoTracking().CountAsync();

        var pendingMebTransferJobs = await _context.MebbisTransferJobs
            .AsNoTracking()
            .Where(j => j.Status == "pending" || j.Status == "running")
            .CountAsync();

        var upcomingMonthExamCount = await _context.Exams
            .AsNoTracking()
            .Where(e =>
                e.ExamDate >= startOfMonth &&
                e.ExamDate < endOfMonth)
            .CountAsync();

        var response = new
        {
            ActiveCourseCount = activeCourseCount,
            TotalStudentCount = totalStudentCount,
            PendingMebbisTransferJobs = pendingMebTransferJobs,
            UpcomingExamCount = upcomingMonthExamCount
        };

        _cache.Set("dashboard:summary", response, SummaryCacheOptions);

        return Ok(response);
    }

    [HttpGet("today-schedule")]
    [ResponseCache(Duration = 15, Location = ResponseCacheLocation.Client, NoStore = false)]
    public async Task<ActionResult> GetTodaySchedule()
    {
        var cacheKey = $"dashboard:today-schedule:{DateOnly.FromDateTime(DateTime.UtcNow):yyyyMMdd}";
        if (_cache.TryGetValue(cacheKey, out object? cachedSchedule))
        {
            return Ok(cachedSchedule);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var startOfDay = today.ToDateTime(TimeOnly.MinValue);
        var endOfDay = today.ToDateTime(TimeOnly.MaxValue);

        var items = await _context.ScheduleSlots
            .AsNoTracking()
            .Include(s => s.Course)
                .ThenInclude(c => c.MebGroup)
            .Include(s => s.Instructor)
            .Where(s => s.StartTime >= startOfDay && s.StartTime <= endOfDay)
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                s.Id,
                Course = new
                {
                    s.Course.Id,
                    s.Course.SrcType,
                    Group = new
                    {
                        s.Course.MebGroup.Year,
                        s.Course.MebGroup.Month,
                        s.Course.MebGroup.GroupNo,
                        s.Course.MebGroup.Branch
                    }
                },
                Instructor = s.Instructor != null ? new
                {
                    s.Instructor.Id,
                    s.Instructor.FullName,
                    s.Instructor.Username
                } : null,
                s.Subject,
                s.ClassroomName,
                s.StartTime,
                s.EndTime,
                AttendanceCount = s.Attendances.Count
            })
            .ToListAsync();

        _cache.Set(cacheKey, items, ShortCacheOptions);

        return Ok(items);
    }

    [HttpGet("upcoming-exams")]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Client, NoStore = false)]
    public async Task<ActionResult> GetUpcomingExams([FromQuery] int days = 7)
    {
        if (days <= 0 || days > 90)
        {
            days = 7;
        }

        var cacheKey = $"dashboard:upcoming-exams:{days}";
        if (_cache.TryGetValue(cacheKey, out object? cachedExams))
        {
            return Ok(cachedExams);
        }

        var now = DateTime.UtcNow;
        var until = now.AddDays(days);

        var exams = await _context.Exams
            .AsNoTracking()
            .Include(e => e.Course)
                .ThenInclude(c => c.MebGroup)
            .Where(e => e.ExamDate >= now && e.ExamDate <= until)
            .OrderBy(e => e.ExamDate)
            .Select(e => new
            {
                e.Id,
                e.ExamType,
                e.ExamDate,
                e.Status,
                e.MebSessionCode,
                Course = new
                {
                    e.Course.Id,
                    e.Course.SrcType,
                    Group = new
                    {
                        e.Course.MebGroup.Year,
                        e.Course.MebGroup.Month,
                        e.Course.MebGroup.GroupNo,
                        e.Course.MebGroup.Branch
                    }
                }
            })
            .ToListAsync();

        _cache.Set(cacheKey, exams, ShortCacheOptions);

        return Ok(exams);
    }

    [HttpGet("alerts")]
    [ResponseCache(Duration = 30, Location = ResponseCacheLocation.Client, NoStore = false)]
    public async Task<ActionResult> GetAlerts()
    {
        const string cacheKey = "dashboard:alerts";
        if (_cache.TryGetValue(cacheKey, out object? cachedAlerts))
        {
            return Ok(cachedAlerts);
        }

        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

        var failedTransfers = await _context.MebbisTransferJobs
            .AsNoTracking()
            .Include(j => j.Course)
                .ThenInclude(c => c.MebGroup)
            .Where(j =>
                j.Status == "failed" &&
                j.CreatedAt >= sevenDaysAgo)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id,
                j.Mode,
                j.Status,
                j.SuccessCount,
                j.FailureCount,
                j.ErrorMessage,
                j.CreatedAt,
                Course = new
                {
                    j.Course.Id,
                    j.Course.SrcType,
                    Group = new
                    {
                        j.Course.MebGroup.Year,
                        j.Course.MebGroup.Month,
                        j.Course.MebGroup.GroupNo,
                        j.Course.MebGroup.Branch
                    }
                }
            })
            .Take(10)
            .ToListAsync();

        var overduePayments = await _context.Payments
            .AsNoTracking()
            .Include(p => p.Student)
            .Where(p =>
                p.Status == "pending" &&
                p.DueDate < DateTime.UtcNow)
            .OrderBy(p => p.DueDate)
            .Select(p => new
            {
                p.Id,
                p.Amount,
                p.PaymentType,
                p.DueDate,
                p.PenaltyAmount,
                Student = new
                {
                    p.Student.Id,
                    p.Student.FirstName,
                    p.Student.LastName,
                    p.Student.TcKimlikNo
                }
            })
            .Take(20)
            .ToListAsync();

        var response = new
        {
            FailedMebbisTransfers = failedTransfers,
            OverduePayments = overduePayments
        };

        _cache.Set(cacheKey, response, ShortCacheOptions);

        return Ok(response);
    }
}


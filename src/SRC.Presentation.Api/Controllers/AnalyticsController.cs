using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SRC.Application.DTOs.Analytics;
using SRC.Application.Interfaces.Tenancy;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/analytics")]
[Authorize]
public class AnalyticsController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IMemoryCache _cache;
    private readonly ITenantProvider _tenantProvider;

    public AnalyticsController(SrcDbContext context, IMemoryCache cache, ITenantProvider tenantProvider)
    {
        _context = context;
        _cache = cache;
        _tenantProvider = tenantProvider;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary(CancellationToken cancellationToken)
    {
        var tenantKey = GetTenantKey();
        var cacheKey = $"analytics:summary:{tenantKey}";

        if (_cache.TryGetValue(cacheKey, out AnalyticsSummaryDto? cached))
        {
            return Ok(cached);
        }

        var totalStudents = await _context.Students
            .AsNoTracking()
            .CountAsync(cancellationToken);
        var activeCourses = await _context.Courses
            .AsNoTracking()
            .CountAsync(c => c.MebApprovalStatus != "draft", cancellationToken);

        var occupancyQuery = await _context.MebGroups
            .AsNoTracking()
            .Select(group => new
            {
                group.Capacity,
                EnrollmentCount = group.Courses.SelectMany(course => course.Enrollments).Count()
            })
            .ToListAsync(cancellationToken);

        var averageOccupancy = occupancyQuery.Count == 0
            ? 0
            : occupancyQuery.Average(item => item.Capacity == 0 ? 0 : (double)item.EnrollmentCount / item.Capacity);

        var soonDate = DateTime.UtcNow.AddDays(30);
        var documentsExpiring = await _context.StudentDocuments
            .AsNoTracking()
            .CountAsync(doc => doc.DocDate != null && doc.DocDate <= soonDate, cancellationToken);

        var ninetyDays = DateTime.UtcNow.AddDays(-90);
        var lowAttendanceCourses = await _context.Courses
            .AsNoTracking()
            .Where(course => course.ScheduleSlots.Any(slot => slot.StartTime >= ninetyDays))
            .Select(course => new
            {
                course.Id,
                AttendanceRate = course.ScheduleSlots
                    .Where(slot => slot.StartTime >= ninetyDays)
                    .Select(slot => new
                    {
                        slot.Id,
                        Attended = slot.Attendances.Count(att => att.IsPresent),
                        Total = slot.Attendances.Count()
                    })
            })
            .ToListAsync(cancellationToken);

        var lowAttendanceCount = lowAttendanceCourses.Count(course =>
        {
            var totals = course.AttendanceRate.ToList();
            if (totals.Count == 0) return false;
            var attended = totals.Sum(item => item.Attended);
            var total = totals.Sum(item => item.Total);
            if (total == 0) return false;
            var ratio = (double)attended / total;
            return ratio < 0.75;
        });

        var summary = new AnalyticsSummaryDto
        {
            TotalStudents = totalStudents,
            ActiveCourses = activeCourses,
            AverageOccupancy = Math.Round((decimal)averageOccupancy * 100, 2),
            DocumentsExpiringSoon = documentsExpiring,
            LowAttendanceCourses = lowAttendanceCount
        };

        var cacheEntryOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
            SlidingExpiration = TimeSpan.FromMinutes(1)
        };

        _cache.Set(cacheKey, summary, cacheEntryOptions);

        return Ok(summary);
    }

    [HttpGet("monthly-revenue")]
    public async Task<ActionResult<IEnumerable<MonthlyRevenuePointDto>>> GetMonthlyRevenue(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var start = new DateTime(now.Year - 1, now.Month, 1);

        var tenantKey = GetTenantKey();
        var cacheKey = $"analytics:monthly-revenue:{tenantKey}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<MonthlyRevenuePointDto>? cached))
        {
            return Ok(cached);
        }

        var payments = await _context.Payments
            .AsNoTracking()
            .Where(payment => payment.PaidDate != null && payment.PaidDate >= start)
            .GroupBy(payment => new { payment.PaidDate!.Value.Year, payment.PaidDate!.Value.Month })
            .Select(group => new MonthlyRevenuePointDto
            {
                Year = group.Key.Year,
                Month = group.Key.Month,
                Amount = group.Sum(payment => payment.Amount + (payment.PenaltyAmount ?? 0m))
            })
            .OrderBy(point => point.Year)
            .ThenBy(point => point.Month)
            .ToListAsync(cancellationToken);

        if (payments.Count == 0)
        {
            var fallback = Enumerable.Range(0, 12).Select(offset =>
            {
                var date = start.AddMonths(offset);
                return new MonthlyRevenuePointDto
                {
                    Year = date.Year,
                    Month = date.Month,
                    Amount = 0m
                };
            }).ToList();
            _cache.Set(cacheKey, fallback, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                SlidingExpiration = TimeSpan.FromMinutes(2)
            });
            return Ok(fallback);
        }

        _cache.Set(cacheKey, payments, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
            SlidingExpiration = TimeSpan.FromMinutes(2)
        });

        return Ok(payments);
    }

    [HttpGet("occupancy-trend")]
    public async Task<ActionResult<IEnumerable<OccupancyTrendPointDto>>> GetOccupancyTrend(CancellationToken cancellationToken)
    {
        var start = DateTime.UtcNow.AddDays(-30).Date;

        var tenantKey = GetTenantKey();
        var cacheKey = $"analytics:occupancy-trend:{tenantKey}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<OccupancyTrendPointDto>? cached))
        {
            return Ok(cached);
        }

        var data = await _context.MebGroups
            .AsNoTracking()
            .Select(group => group.Courses.SelectMany(course => course.ScheduleSlots))
            .SelectMany(slots => slots)
            .Where(slot => slot.StartTime >= start)
            .Select(slot => new
            {
                Date = slot.StartTime.Date,
                Attendance = slot.Attendances.Count(att => att.IsPresent),
                Total = slot.Attendances.Count()
            })
            .GroupBy(item => item.Date)
            .Select(group => new OccupancyTrendPointDto
            {
                Date = group.Key,
                Occupancy = group.Average(item => item.Total == 0 ? 0 : (double)item.Attendance / item.Total)
            })
            .OrderBy(point => point.Date)
            .ToListAsync(cancellationToken);

        _cache.Set(cacheKey, data, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
            SlidingExpiration = TimeSpan.FromMinutes(1)
        });

        return Ok(data);
    }

    private string GetTenantKey()
    {
        var tenantId = _tenantProvider?.TenantId;
        return string.IsNullOrWhiteSpace(tenantId) ? "default" : tenantId!;
    }
}



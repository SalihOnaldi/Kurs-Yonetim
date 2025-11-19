using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Portal;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/portal")]
public class PortalController : ControllerBase
{
    private readonly SrcDbContext _context;

    public PortalController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<PortalLoginResponse>> Login([FromBody] PortalLoginRequest request, CancellationToken cancellationToken)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.TcKimlikNo))
        {
            return BadRequest(new { message = "TC Kimlik numarası gereklidir." });
        }

        var tc = request.TcKimlikNo.Trim();
        var email = request.Email?.Trim().ToLower();

        var studentQuery = _context.Students.AsNoTracking().Where(s => s.TcKimlikNo == tc);
        if (!string.IsNullOrWhiteSpace(email))
        {
            studentQuery = studentQuery.Where(s => s.Email != null && s.Email.ToLower() == email);
        }

        var student = await studentQuery.Select(s => new
        {
            s.Id,
            s.FirstName,
            s.LastName,
            s.Email,
            s.Phone
        }).FirstOrDefaultAsync(cancellationToken);

        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bilgileri doğrulanamadı." });
        }

        return Ok(new PortalLoginResponse
        {
            StudentId = student.Id,
            FirstName = student.FirstName,
            LastName = student.LastName,
            Email = student.Email,
            Phone = student.Phone
        });
    }

    [HttpGet("summary")]
    [AllowAnonymous]
    public async Task<ActionResult<PortalSummaryResponse>> GetSummary(
        [FromQuery] int studentId,
        [FromQuery] string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var student = await _context.Students
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == studentId && s.TcKimlikNo == tcKimlikNo, cancellationToken);

        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bulunamadı." });
        }

        var enrollmentStats = await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == studentId)
            .GroupBy(e => 1)
            .Select(group => new
            {
                Total = group.Count(),
                Active = group.Count(e => e.Status == "active"),
                Completed = group.Count(e => e.Status == "completed")
            })
            .FirstOrDefaultAsync(cancellationToken) ?? new { Total = 0, Active = 0, Completed = 0 };

        var attendanceStart = DateTime.UtcNow;
        var upcomingLessons = await _context.ScheduleSlots
            .AsNoTracking()
            .Where(s => s.Course.Enrollments.Any(e => e.StudentId == studentId))
            .Where(s => s.StartTime >= attendanceStart)
            .OrderBy(s => s.StartTime)
            .Take(5)
            .Select(s => new PortalUpcomingLessonDto
            {
                ScheduleSlotId = s.Id,
                StartTime = s.StartTime,
                EndTime = s.EndTime,
                Subject = s.Subject,
                CourseLabel = $"SRC{s.Course.SrcType} {s.Course.MebGroup.Year}-{s.Course.MebGroup.Month:00} GRUP {s.Course.MebGroup.GroupNo}"
            })
            .ToListAsync(cancellationToken);

        var pendingDocuments = await _context.StudentDocuments
            .AsNoTracking()
            .Where(d => d.StudentId == studentId && d.IsRequired && d.ValidationStatus != "approved")
            .CountAsync(cancellationToken);

        var pendingPayments = await _context.Payments
            .AsNoTracking()
            .Where(p => p.Enrollment != null && p.Enrollment.StudentId == studentId && p.Status == "pending")
            .GroupBy(p => 1)
            .Select(group => new
            {
                Count = group.Count(),
                Amount = group.Sum(payment => payment.Amount + (payment.PenaltyAmount ?? 0m))
            })
            .FirstOrDefaultAsync(cancellationToken) ?? new { Count = 0, Amount = 0m };

        return Ok(new PortalSummaryResponse
        {
            StudentName = $"{student.FirstName} {student.LastName}",
            Email = student.Email,
            Phone = student.Phone,
            TotalCourses = enrollmentStats.Total,
            ActiveCourses = enrollmentStats.Active,
            UpcomingLessons = upcomingLessons.Count,
            PendingDocuments = pendingDocuments,
            PendingPayments = pendingPayments.Count,
            PendingPaymentAmount = pendingPayments.Amount,
            Lessons = upcomingLessons
        });
    }

    [HttpGet("attendance/recent")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<PortalRecentAttendanceDto>>> GetRecentAttendance(
        [FromQuery] int studentId,
        [FromQuery] string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var exists = await _context.Students.AsNoTracking()
            .AnyAsync(s => s.Id == studentId && s.TcKimlikNo == tcKimlikNo, cancellationToken);
        if (!exists)
        {
            return NotFound(new { message = "Kursiyer bulunamadı." });
        }

        var records = await _context.Attendances
            .AsNoTracking()
            .Where(a => a.StudentId == studentId)
            .OrderByDescending(a => a.MarkedAt ?? a.CreatedAt)
            .Take(10)
            .Select(a => new PortalRecentAttendanceDto
            {
                AttendanceId = a.Id,
                IsPresent = a.IsPresent,
                Excuse = a.Excuse,
                StartTime = a.ScheduleSlot.StartTime,
                EndTime = a.ScheduleSlot.EndTime,
                Subject = a.ScheduleSlot.Subject,
                CourseLabel = "SRC" + a.ScheduleSlot.Course.SrcType,
                MarkedAt = a.MarkedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(records);
    }

    [HttpGet("documents")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<PortalDocumentDto>>> GetDocuments(
        [FromQuery] int studentId,
        [FromQuery] string tcKimlikNo,
        CancellationToken cancellationToken)
    {
        var exists = await _context.Students.AsNoTracking()
            .AnyAsync(s => s.Id == studentId && s.TcKimlikNo == tcKimlikNo, cancellationToken);
        if (!exists)
        {
            return NotFound(new { message = "Kursiyer bulunamadı." });
        }

        var documents = await _context.StudentDocuments
            .AsNoTracking()
            .Where(d => d.StudentId == studentId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new PortalDocumentDto
            {
                DocumentId = d.Id,
                DocumentType = d.DocumentType,
                DocDate = d.DocDate,
                IsRequired = d.IsRequired,
                ValidationStatus = d.ValidationStatus,
                ValidationNotes = d.ValidationNotes
            })
            .ToListAsync(cancellationToken);

        return Ok(documents);
    }
}



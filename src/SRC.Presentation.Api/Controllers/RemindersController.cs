using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.ReminderDtos;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/reminders")]
[Authorize]
public class RemindersController : ControllerBase
{
    private readonly SrcDbContext _context;

    public RemindersController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ReminderDto>>> GetReminders(
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);

        var query = _context.Reminders
            .AsNoTracking()
            .Include(reminder => reminder.Student)
            .Include(reminder => reminder.StudentDocument)
            .OrderByDescending(reminder => reminder.CreatedAt)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(reminder => reminder.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(reminder => reminder.Type == type);
        }

        var items = await query
            .Take(take)
            .ToListAsync(cancellationToken);

        var result = items.Select(MapReminder).ToList();
        return Ok(result);
    }

    [HttpGet("upcoming-documents")]
    public async Task<ActionResult<IEnumerable<UpcomingDocumentDto>>> GetUpcomingDocuments(
        [FromQuery] int days = 30,
        [FromQuery] int take = 200,
        CancellationToken cancellationToken = default)
    {
        if (days <= 0) days = 30;
        take = Math.Clamp(take, 1, 500);

        var today = DateTime.UtcNow.Date;
        var limit = today.AddDays(days);

        var documents = await _context.StudentDocuments
            .AsNoTracking()
            .Include(doc => doc.Student)
            .Where(doc =>
                doc.DocDate.HasValue &&
                doc.DocDate.Value.Date >= today &&
                doc.DocDate.Value.Date <= limit &&
                doc.Student != null)
            .OrderBy(doc => doc.DocDate)
            .Take(take)
            .Select(doc => new
            {
                Document = doc,
                Student = doc.Student
            })
            .ToListAsync(cancellationToken);

        var documentIds = documents.Select(item => item.Document.Id).ToList();

        var reminderLookup = await _context.Reminders
            .AsNoTracking()
            .Where(reminder =>
                reminder.Type == "document_expiry" &&
                reminder.StudentDocumentId.HasValue &&
                documentIds.Contains(reminder.StudentDocumentId.Value) &&
                reminder.Status != "sent" &&
                reminder.Status != "cancelled")
            .GroupBy(reminder => reminder.StudentDocumentId!.Value)
            .ToDictionaryAsync(group => group.Key, group => group.Any(), cancellationToken);

        var result = documents.Select(item => new UpcomingDocumentDto
        {
            DocumentId = item.Document.Id,
            DocumentType = item.Document.DocumentType,
            DocDate = item.Document.DocDate,
            StudentId = item.Student.Id,
            StudentName = $"{item.Student.FirstName} {item.Student.LastName}",
            Email = item.Student.Email,
            Phone = item.Student.Phone,
            HasPendingReminder = reminderLookup.TryGetValue(item.Document.Id, out var hasPending) && hasPending
        }).ToList();

        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<ReminderDto>> CreateReminder(
        [FromBody] CreateReminderRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
        {
            return BadRequest(new { message = "Geçersiz istek." });
        }

        if (request.StudentId <= 0)
        {
            return BadRequest(new { message = "Geçerli bir kursiyer seçmelisiniz." });
        }

        var student = await _context.Students.FindAsync(new object[] { request.StudentId }, cancellationToken);
        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bulunamadı." });
        }

        StudentDocument? document = null;
        if (request.StudentDocumentId.HasValue)
        {
            document = await _context.StudentDocuments
                .FirstOrDefaultAsync(doc => doc.Id == request.StudentDocumentId, cancellationToken);
            if (document == null)
            {
                return NotFound(new { message = "Belge kaydı bulunamadı." });
            }
        }

        var scheduledAt = request.ScheduledAt == default
            ? DateTime.UtcNow.AddHours(1)
            : request.ScheduledAt.ToUniversalTime();

        var reminder = new Reminder
        {
            StudentId = student.Id,
            StudentDocumentId = document?.Id,
            Type = document != null ? "document_expiry" : "manual",
            Channel = string.IsNullOrWhiteSpace(request.Channel) ? "both" : request.Channel.Trim().ToLowerInvariant(),
            Title = string.IsNullOrWhiteSpace(request.Title) ? "Hatırlatma" : request.Title.Trim(),
            Message = string.IsNullOrWhiteSpace(request.Message)
                ? "Belge işlemlerinizi tamamlamayı unutmayın."
                : request.Message.Trim(),
            ScheduledAt = scheduledAt,
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        };

        await _context.Reminders.AddAsync(reminder, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);

        var dto = MapReminder(reminder, student, document);
        return CreatedAtAction(nameof(GetReminders), new { id = reminder.Id }, dto);
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult> CancelReminder(int id, CancellationToken cancellationToken = default)
    {
        var reminder = await _context.Reminders.FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
        if (reminder == null)
        {
            return NotFound();
        }

        if (reminder.Status == "sent")
        {
            return BadRequest(new { message = "Gönderilmiş bir hatırlatma iptal edilemez." });
        }

        reminder.Status = "cancelled";
        reminder.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static ReminderDto MapReminder(Reminder reminder)
    {
        return MapReminder(reminder, reminder.Student, reminder.StudentDocument);
    }

    private static ReminderDto MapReminder(Reminder reminder, Student? student, StudentDocument? document)
    {
        return new ReminderDto
        {
            Id = reminder.Id,
            Type = reminder.Type,
            Channel = reminder.Channel,
            Title = reminder.Title,
            Message = reminder.Message,
            Status = reminder.Status,
            ScheduledAt = reminder.ScheduledAt,
            SentAt = reminder.SentAt,
            Error = reminder.Error,
            CreatedAt = reminder.CreatedAt,
            Student = student == null
                ? null
                : new ReminderStudentDto
                {
                    Id = student.Id,
                    FirstName = student.FirstName,
                    LastName = student.LastName,
                    Email = student.Email,
                    Phone = student.Phone
                },
            Document = document == null
                ? null
                : new ReminderDocumentDto
                {
                    Id = document.Id,
                    DocumentType = document.DocumentType,
                    DocDate = document.DocDate
                }
        };
    }
}



using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ScheduleController : ControllerBase
{
    private readonly SrcDbContext _context;

    public ScheduleController(SrcDbContext context)
    {
        _context = context;
    }

    private const int MaxWeeklyMinutes = 40 * 60;

    private static int GetDurationMinutes(DateTime start, DateTime end)
    {
        var minutes = (int)Math.Round((end - start).TotalMinutes);
        return minutes < 0 ? 0 : minutes;
    }

    private static DateTime GetWeekStart(DateTime referenceDate)
    {
        var date = referenceDate.Date;
        var diff = ((int)date.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        return date.AddDays(-diff);
    }

    private static DateTime GetWeekEndExclusive(DateTime referenceDate) => GetWeekStart(referenceDate).AddDays(7);

    private async Task<int> GetInstructorWeeklyMinutesAsync(int instructorId, DateTime referenceDate, int? excludeSlotId = null)
    {
        var weekStart = GetWeekStart(referenceDate);
        var weekEnd = GetWeekEndExclusive(referenceDate);

        var query = _context.ScheduleSlots
            .AsNoTracking()
            .Where(s => s.InstructorId == instructorId && s.StartTime >= weekStart && s.StartTime < weekEnd);

        if (excludeSlotId.HasValue)
        {
            query = query.Where(s => s.Id != excludeSlotId.Value);
        }

        var slots = await query
            .Select(s => new { s.StartTime, s.EndTime })
            .ToListAsync();

        return slots.Sum(s => GetDurationMinutes(s.StartTime, s.EndTime));
    }

    private async Task<object> BuildScheduleSlotResponseAsync(ScheduleSlot slot)
    {
        if (slot.InstructorId.HasValue)
        {
            await _context.Entry(slot).Reference(s => s.Instructor).LoadAsync();
        }

        return new
        {
            slot.Id,
            slot.MebGroupId,
            slot.InstructorId,
            Instructor = slot.Instructor != null ? new
            {
                slot.Instructor.Id,
                slot.Instructor.FullName,
                slot.Instructor.Username,
                slot.Instructor.Email
            } : null,
            slot.ClassroomId,
            slot.ClassroomName,
            slot.StartTime,
            slot.EndTime,
            slot.Subject,
            slot.Notes,
            slot.CreatedAt,
            slot.UpdatedAt,
            DurationMinutes = (int)(slot.EndTime - slot.StartTime).TotalMinutes
        };
    }

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? mebGroupId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
    {
        var query = _context.ScheduleSlots
            .Include(s => s.MebGroup)
            .Include(s => s.Instructor)
            .AsQueryable();

        if (mebGroupId.HasValue)
        {
            query = query.Where(s => s.MebGroupId == mebGroupId.Value);
        }

        if (startDate.HasValue)
        {
            query = query.Where(s => s.StartTime >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(s => s.EndTime <= endDate.Value);
        }

        var slots = await query
            .Select(s => new
            {
                s.Id,
                    GroupInfo = new
                    {
                    s.MebGroup.Id,
                    s.MebGroup.SrcType,
                    s.MebGroup.Year,
                    s.MebGroup.Month,
                    s.MebGroup.GroupNo,
                    s.MebGroup.Branch
                },
                InstructorInfo = s.Instructor != null ? new
                {
                    s.Instructor.Id,
                    s.Instructor.FullName,
                    s.Instructor.Username
                } : null,
                s.ClassroomId,
                s.ClassroomName,
                s.StartTime,
                s.EndTime,
                s.Subject,
                s.Notes,
                AttendanceCount = s.Attendances.Count,
                s.CreatedAt
            })
            .ToListAsync();

        return Ok(slots);
    }

    [HttpGet("instructor-summary")]
    public async Task<ActionResult> GetInstructorSummary([FromQuery] DateTime? referenceDate, [FromQuery] bool includeInactive = false)
    {
        var targetDate = referenceDate ?? DateTime.Today;
        var weekStart = GetWeekStart(targetDate);
        var weekEndExclusive = GetWeekEndExclusive(targetDate);

        var instructors = await _context.Users
            .AsNoTracking()
            .Where(u => (u.Role == "Egitmen" || u.Role == "EgitimYoneticisi") && (includeInactive || u.IsActive))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Username,
                u.Email,
                u.IsActive
            })
            .ToListAsync();

        var minutesByInstructor = await _context.ScheduleSlots
            .AsNoTracking()
            .Where(s => s.InstructorId != null && s.StartTime >= weekStart && s.StartTime < weekEndExclusive)
            .Select(s => new
            {
                s.InstructorId,
                s.StartTime,
                s.EndTime
            })
            .ToListAsync();

        var summary = instructors
            .Select(i =>
            {
                var totalMinutes = minutesByInstructor
                    .Where(s => s.InstructorId == i.Id)
                    .Sum(s => GetDurationMinutes(s.StartTime, s.EndTime));
                var totalHours = Math.Round(totalMinutes / 60m, 2);
                return new
                {
                    i.Id,
                    i.FullName,
                    i.Username,
                    i.Email,
                    i.IsActive,
                    totalMinutes,
                    totalHours,
                    overLimit = totalMinutes > MaxWeeklyMinutes
                };
            })
            .OrderBy(i => i.FullName)
            .ToList();

        return Ok(new
        {
            weekStart,
            weekEnd = weekEndExclusive.AddTicks(-1),
            limitMinutes = MaxWeeklyMinutes,
            limitHours = MaxWeeklyMinutes / 60,
            instructors = summary
        });
    }

    [HttpGet("instructors/{instructorId}/weekly")]
    public async Task<ActionResult> GetInstructorWeekly(int instructorId, [FromQuery] DateTime? referenceDate)
    {
        var instructor = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == instructorId && (u.Role == "Egitmen" || u.Role == "EgitimYoneticisi"))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Username,
                u.Email,
                u.IsActive
            })
            .FirstOrDefaultAsync();

        if (instructor == null)
        {
            return NotFound(new { message = "Eğitmen bulunamadı." });
        }

        var targetDate = referenceDate ?? DateTime.Today;
        var weekStart = GetWeekStart(targetDate);
        var weekEndExclusive = GetWeekEndExclusive(targetDate);

        var rawSlots = await _context.ScheduleSlots
            .AsNoTracking()
            .Where(s => s.InstructorId == instructorId && s.StartTime >= weekStart && s.StartTime < weekEndExclusive)
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                s.Id,
                s.StartTime,
                s.EndTime,
                s.Subject,
                s.Notes,
                s.ClassroomName,
                s.MebGroupId,
                Group = new
                        {
                    s.MebGroup.Id,
                    s.MebGroup.SrcType,
                    s.MebGroup.Year,
                    s.MebGroup.Month,
                    s.MebGroup.GroupNo,
                    s.MebGroup.Branch
                }
            })
            .ToListAsync();

        var slots = rawSlots
            .Select(slot => new
            {
                slot.Id,
                slot.StartTime,
                slot.EndTime,
                slot.Subject,
                slot.Notes,
                slot.ClassroomName,
                slot.MebGroupId,
                Group = slot.Group,
                durationMinutes = GetDurationMinutes(slot.StartTime, slot.EndTime)
            })
            .ToList();

        var totalMinutes = slots.Sum(slot => slot.durationMinutes);

        return Ok(new
        {
            instructor,
            weekStart,
            weekEnd = weekEndExclusive.AddTicks(-1),
            limitMinutes = MaxWeeklyMinutes,
            limitHours = MaxWeeklyMinutes / 60,
            totalMinutes,
            totalHours = Math.Round(totalMinutes / 60m, 2),
            overLimit = totalMinutes > MaxWeeklyMinutes,
            slots
        });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateScheduleSlotRequest request)
    {
        var group = await _context.MebGroups.FindAsync(request.MebGroupId);
        if (group == null)
        {
            return BadRequest(new { message = "Sınıf bulunamadı" });
        }

        if (request.EndTime <= request.StartTime)
        {
            return BadRequest(new { message = "Bitiş saati başlangıç saatinden sonra olmalıdır." });
        }

        if (request.InstructorId.HasValue)
        {
            var existingMinutes = await GetInstructorWeeklyMinutesAsync(request.InstructorId.Value, request.StartTime);
            var newMinutes = GetDurationMinutes(request.StartTime, request.EndTime);
            var totalMinutes = existingMinutes + newMinutes;
            if (totalMinutes > MaxWeeklyMinutes)
            {
                var totalHours = Math.Round(totalMinutes / 60m, 2);
                var limitHours = MaxWeeklyMinutes / 60m;
                return Conflict(new
                {
                    message = $"Eğitmen haftalık {limitHours} saat sınırını aşamaz. Bu oturum ile toplam {totalHours} saate ulaşıyor.",
                    totalMinutes,
                    limitMinutes = MaxWeeklyMinutes
                });
            }
        }

        var slot = new SRC.Domain.Entities.ScheduleSlot
        {
            MebGroupId = request.MebGroupId,
            InstructorId = request.InstructorId,
            ClassroomId = request.ClassroomId,
            ClassroomName = request.ClassroomName,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Subject = request.Subject,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.ScheduleSlots.Add(slot);
        await _context.SaveChangesAsync();

        var response = await BuildScheduleSlotResponseAsync(slot);
        return CreatedAtAction(nameof(GetAll), new { id = slot.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateScheduleSlotRequest request)
    {
        var slot = await _context.ScheduleSlots.FindAsync(id);
        if (slot == null)
        {
            return NotFound();
        }

        var finalInstructorId = request.InstructorId ?? slot.InstructorId;
        var finalStartTime = request.StartTime ?? slot.StartTime;
        var finalEndTime = request.EndTime ?? slot.EndTime;

        if (finalEndTime <= finalStartTime)
        {
            return BadRequest(new { message = "Bitiş saati başlangıç saatinden sonra olmalıdır." });
        }

        if (finalInstructorId.HasValue)
        {
            var existingMinutes = await GetInstructorWeeklyMinutesAsync(finalInstructorId.Value, finalStartTime, slot.Id);
            var newMinutes = GetDurationMinutes(finalStartTime, finalEndTime);
            var totalMinutes = existingMinutes + newMinutes;
            if (totalMinutes > MaxWeeklyMinutes)
            {
                var totalHours = Math.Round(totalMinutes / 60m, 2);
                var limitHours = MaxWeeklyMinutes / 60m;
                return Conflict(new
                {
                    message = $"Eğitmen haftalık {limitHours} saat sınırını aşamaz. Bu oturum ile toplam {totalHours} saate ulaşıyor.",
                    totalMinutes,
                    limitMinutes = MaxWeeklyMinutes
                });
            }
        }

        if (request.InstructorId.HasValue) slot.InstructorId = request.InstructorId;
        if (request.ClassroomId.HasValue) slot.ClassroomId = request.ClassroomId;
        if (request.ClassroomName != null) slot.ClassroomName = request.ClassroomName;
        if (request.StartTime.HasValue) slot.StartTime = request.StartTime.Value;
        if (request.EndTime.HasValue) slot.EndTime = request.EndTime.Value;
        if (request.Subject != null) slot.Subject = request.Subject;
        if (request.Notes != null) slot.Notes = request.Notes;
        slot.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var response = await BuildScheduleSlotResponseAsync(slot);
        return Ok(response);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var slot = await _context.ScheduleSlots.FindAsync(id);
        if (slot == null)
        {
            return NotFound();
        }

        _context.ScheduleSlots.Remove(slot);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreateScheduleSlotRequest
{
    public int MebGroupId { get; set; }
    public int? InstructorId { get; set; }
    public int? ClassroomId { get; set; }
    public string? ClassroomName { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Subject { get; set; }
    public string? Notes { get; set; }
}

public class UpdateScheduleSlotRequest
{
    public int? InstructorId { get; set; }
    public int? ClassroomId { get; set; }
    public string? ClassroomName { get; set; }
    public DateTime? StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public string? Subject { get; set; }
    public string? Notes { get; set; }
}


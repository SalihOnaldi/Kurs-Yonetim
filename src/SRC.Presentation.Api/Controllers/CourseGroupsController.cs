using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;
using SRC.Presentation.Api.Utilities;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/courses/groups")]
[Authorize]
public class CourseGroupsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public CourseGroupsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] string? branch,
        [FromQuery] string? status)
    {
        var groups = await _context.MebGroups
            .AsNoTracking()
            .Include(g => g.Courses)
            .Where(g =>
                (!year.HasValue || g.Year == year.Value) &&
                (!month.HasValue || g.Month == month.Value) &&
                (string.IsNullOrWhiteSpace(branch) ||
                    (g.Branch != null && g.Branch.ToLower() == branch.Trim().ToLower())) &&
                (string.IsNullOrWhiteSpace(status) ||
                    g.Status.ToLower() == status.Trim().ToLower()))
            .Select(g => new
            {
                g.Id,
                g.Year,
                g.Month,
                g.GroupNo,
                g.Branch,
                g.StartDate,
                g.EndDate,
                g.Capacity,
                g.Status,
                Name = MebNamingHelper.BuildGroupName(g),
                CourseCount = g.Courses.Count,
                ActiveCourseCount = g.Courses.Count(c => c.MebApprovalStatus != "rejected"),
                g.CreatedAt
            })
            .OrderByDescending(g => g.Year)
            .ThenByDescending(g => g.Month)
            .ThenBy(g => g.GroupNo)
            .ToListAsync();

        return Ok(groups);
    }

    [HttpGet("{id}/detail")]
    public async Task<ActionResult> GetDetail(int id)
    {
        var group = await _context.MebGroups
            .AsNoTracking()
            .Include(g => g.Courses)
                .ThenInclude(c => c.Enrollments)
                    .ThenInclude(e => e.Student)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "MEB grubu bulunamadı." });
        }

        var response = new
        {
            group.Id,
            group.Year,
            group.Month,
            group.GroupNo,
            group.Branch,
            group.StartDate,
            group.EndDate,
            group.Capacity,
            group.Status,
            Name = MebNamingHelper.BuildGroupName(group),
            Courses = group.Courses.Select(course => new
            {
                course.Id,
                course.SrcType,
                course.PlannedHours,
                course.MebApprovalStatus,
                CourseName = MebNamingHelper.BuildCourseName(course.SrcType, group),
                Enrollments = course.Enrollments
                    .OrderBy(e => e.Student.LastName)
                    .ThenBy(e => e.Student.FirstName)
                    .Select(enrollment => new
                    {
                        enrollment.Id,
                        enrollment.StudentId,
                        enrollment.Status,
                        enrollment.EnrollmentDate,
                        Student = new
                        {
                            enrollment.Student.Id,
                            enrollment.Student.TcKimlikNo,
                            enrollment.Student.FirstName,
                            enrollment.Student.LastName,
                            enrollment.Student.Phone,
                            enrollment.Student.Email
                        }
                    })
            })
        };

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCourseGroupRequest request)
    {
        if (request.StartDate >= request.EndDate)
        {
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden büyük olmalıdır." });
        }

        var branchValue = string.IsNullOrWhiteSpace(request.Branch) ? null : request.Branch.Trim();
        var branchNormalized = branchValue?.ToLower();

        var existing = await _context.MebGroups
            .AnyAsync(g => g.Year == request.Year &&
                           g.Month == request.Month &&
                           g.GroupNo == request.GroupNo &&
                           ((g.Branch == null && branchValue == null) ||
                            (g.Branch != null && branchNormalized != null && g.Branch.ToLower() == branchNormalized)));
        if (existing)
        {
            return Conflict(new { message = "Bu yıl/ay/grup numarası ve şube kombinasyonu zaten mevcut." });
        }

        var group = new MebGroup
        {
            Year = request.Year,
            Month = request.Month,
            GroupNo = request.GroupNo,
            Branch = branchValue,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Capacity = request.Capacity,
            Status = "draft",
            CreatedAt = DateTime.UtcNow
        };

        _context.MebGroups.Add(group);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), group);
    }

    [HttpPost("{id}/students")]
    public async Task<ActionResult> AddStudent(int id, [FromBody] AddGroupStudentRequest request)
    {
        var group = await _context.MebGroups
            .Include(g => g.Courses)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "MEB grubu bulunamadı." });
        }

        var student = await _context.Students.FindAsync(request.StudentId);
        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bulunamadı." });
        }

        Course? course = null;
        if (request.CourseId.HasValue)
        {
            course = group.Courses.FirstOrDefault(c => c.Id == request.CourseId.Value);
            if (course == null)
            {
                return BadRequest(new { message = "Belirtilen kurs bu gruba ait değil." });
            }
        }
        else
        {
            course = group.Courses.FirstOrDefault(c => c.SrcType == request.SrcType);
        }

        if (course == null)
        {
            course = new Course
            {
                MebGroupId = group.Id,
                SrcType = request.SrcType,
                PlannedHours = request.PlannedHours ?? 40,
                MebApprovalStatus = "draft",
                CreatedAt = DateTime.UtcNow
            };

            _context.Courses.Add(course);
            await _context.SaveChangesAsync();

            _context.Entry(group).Collection(g => g.Courses).Load();
        }

        var alreadyEnrolled = await _context.Enrollments
            .AnyAsync(e => e.CourseId == course.Id && e.StudentId == request.StudentId);

        if (alreadyEnrolled)
        {
            return Conflict(new { message = "Kursiyer bu kursa zaten kayıtlı." });
        }

        var enrollment = new Enrollment
        {
            CourseId = course.Id,
            StudentId = request.StudentId,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status!,
            EnrollmentDate = request.EnrollmentDate ?? DateTime.UtcNow
        };

        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();

        return Ok(new { enrollment.Id, enrollment.CourseId, enrollment.StudentId });
    }

    [HttpDelete("{groupId}/students/{enrollmentId}")]
    public async Task<ActionResult> RemoveStudent(int groupId, int enrollmentId)
    {
        var enrollment = await _context.Enrollments
            .Include(e => e.Course)
            .FirstOrDefaultAsync(e => e.Id == enrollmentId && e.Course.MebGroupId == groupId);

        if (enrollment == null)
        {
            return NotFound(new { message = "Kayıt bulunamadı." });
        }

        _context.Enrollments.Remove(enrollment);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateCourseGroupRequest request)
    {
        var group = await _context.MebGroups.FindAsync(id);
        if (group == null)
        {
            return NotFound();
        }

        if (request.Year.HasValue) group.Year = request.Year.Value;
        if (request.Month.HasValue) group.Month = request.Month.Value;
        if (request.GroupNo.HasValue) group.GroupNo = request.GroupNo.Value;
        if (request.Branch != null) group.Branch = string.IsNullOrWhiteSpace(request.Branch) ? null : request.Branch.Trim();
        if (request.StartDate.HasValue) group.StartDate = request.StartDate.Value;
        if (request.EndDate.HasValue) group.EndDate = request.EndDate.Value;
        if (request.Capacity.HasValue) group.Capacity = request.Capacity.Value;
        if (request.Status != null) group.Status = request.Status;
        group.UpdatedAt = DateTime.UtcNow;

        if (group.StartDate >= group.EndDate)
        {
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden büyük olmalıdır." });
        }

        await _context.SaveChangesAsync();

        return Ok(group);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id, [FromQuery] bool soft = true)
    {
        var group = await _context.MebGroups
            .Include(g => g.Courses)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound();
        }

        if (soft)
        {
            group.Status = "inactive";
            group.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "MEB grubu pasif hale getirildi." });
        }

        foreach (var course in group.Courses.ToList())
        {
            await CourseDeletionHelper.CleanupCourseAsync(_context, course);
            _context.Courses.Remove(course);
        }

        _context.MebGroups.Remove(group);
        await _context.SaveChangesAsync();

        return NoContent();
    }

}

public class CreateCourseGroupRequest
{
    public int Year { get; set; }
    public int Month { get; set; }
    public int GroupNo { get; set; }
    public string? Branch { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public int Capacity { get; set; }
}

public class UpdateCourseGroupRequest
{
    public int? Year { get; set; }
    public int? Month { get; set; }
    public int? GroupNo { get; set; }
    public string? Branch { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public int? Capacity { get; set; }
    public string? Status { get; set; }
}

public class AddGroupStudentRequest
{
    public int StudentId { get; set; }
    public int SrcType { get; set; }
    public int? CourseId { get; set; }
    public int? PlannedHours { get; set; }
    public string? Status { get; set; }
    public DateTime? EnrollmentDate { get; set; }
}


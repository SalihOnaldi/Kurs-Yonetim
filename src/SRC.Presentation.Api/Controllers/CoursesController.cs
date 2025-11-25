using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Infrastructure.Utilities;
using SRC.Domain.Entities;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CoursesController : ControllerBase
{
    private readonly SrcDbContext _context;

    public CoursesController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? srcType,
        [FromQuery] string? branchId,
        [FromQuery] string? mebApprovalStatus,
        [FromQuery] string? month, // "2025-11" formatında
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _context.Courses
            .Include(c => c.MebGroup)
            .AsQueryable();

        // Filtreler
        if (srcType.HasValue)
        {
            query = query.Where(c => c.SrcType == srcType.Value);
        }

        if (!string.IsNullOrEmpty(mebApprovalStatus))
        {
            query = query.Where(c => c.MebApprovalStatus == mebApprovalStatus);
        }

        if (!string.IsNullOrWhiteSpace(branchId))
        {
            var branchFilter = branchId.Trim().ToLower();
            query = query.Where(c =>
                c.MebGroup.Branch != null &&
                c.MebGroup.Branch.ToLower().Contains(branchFilter));
        }

        if (!string.IsNullOrEmpty(month))
        {
            var parts = month.Split('-');
            if (parts.Length == 2 && int.TryParse(parts[0], out var year) && int.TryParse(parts[1], out var monthNum))
            {
                query = query.Where(c => c.MebGroup.Year == year && c.MebGroup.Month == monthNum);
            }
        }

        if (!string.IsNullOrEmpty(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(c => 
                (c.MebGroup.Branch != null && c.MebGroup.Branch.ToLower().Contains(searchLower)) ||
                ($"{c.MebGroup.Year}-{MebNamingHelper.GetMonthName(c.MebGroup.Month)}-GRUP {c.MebGroup.GroupNo}").ToLower().Contains(searchLower) ||
                $"src{c.SrcType}".Contains(searchLower));
        }

        // Toplam sayı
        var totalCount = await query.CountAsync();

        // Sayfalama
        var courses = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                id = c.Id,
                name = $"SRC{c.SrcType} {MebNamingHelper.GetMonthName(c.MebGroup.Month)} {c.MebGroup.Year}",
                srcType = c.SrcType,
                srcTypeName = $"SRC{c.SrcType}",
                branchName = c.MebGroup.Branch ?? "Merkez Şube",
                mebGroupName = MebNamingHelper.BuildGroupName(c.MebGroup),
                startDate = c.MebGroup.StartDate,
                endDate = c.MebGroup.EndDate,
                plannedHours = c.PlannedHours,
                isMixed = c.IsMixed,
                capacity = c.MebGroup.Capacity,
                enrolledCount = c.Enrollments.Count,
                mebApprovalStatus = c.MebApprovalStatus,
                createdAt = c.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            items = courses,
            page = page,
            pageSize = pageSize,
            totalCount = totalCount
        });
    }


    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var courseInfo = await _context.Courses
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new
            {
                c.Id,
                c.SrcType,
                c.IsMixed,
                c.MixedTypes,
                c.PlannedHours,
                c.MebApprovalStatus,
                c.ApprovalAt,
                c.ApprovalNotes,
                c.CreatedAt,
                c.UpdatedAt,
                Group = new
                {
                    c.MebGroup.Id,
                    c.MebGroup.Year,
                    c.MebGroup.Month,
                    c.MebGroup.GroupNo,
                    c.MebGroup.Branch,
                    c.MebGroup.StartDate,
                    c.MebGroup.EndDate,
                    c.MebGroup.Capacity,
                    c.MebGroup.Status
                }
            })
            .FirstOrDefaultAsync();

        if (courseInfo == null)
        {
            return NotFound();
        }
 
        var groupCourses = await _context.Courses
            .AsNoTracking()
            .Where(gc => gc.MebGroupId == courseInfo.Group.Id)
            .OrderBy(gc => gc.SrcType)
            .Select(gc => new
            {
                gc.Id,
                gc.SrcType,
                gc.PlannedHours,
                gc.IsMixed,
                gc.MixedTypes,
                gc.MebApprovalStatus,
                EnrollmentCount = gc.Enrollments.Count,
                gc.CreatedAt
            })
            .ToListAsync();

        var scheduleItems = await _context.ScheduleSlots
            .AsNoTracking()
            .Where(s => s.CourseId == id)
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                s.Id,
                s.Subject,
                s.ClassroomName,
                s.StartTime,
                s.EndTime,
                Instructor = s.Instructor == null
                    ? null
                    : new
                    {
                        s.Instructor.Id,
                        s.Instructor.FullName,
                        s.Instructor.Username
                    },
                AttendanceCount = s.Attendances.Count,
                PresentCount = s.Attendances.Count(att => att.IsPresent)
            })
            .ToListAsync();

        var totalSlots = scheduleItems.Count;
        var now = DateTime.UtcNow;

        var enrollmentItems = await _context.Enrollments
            .AsNoTracking()
            .Where(e => e.CourseId == id)
            .OrderBy(e => e.Student.LastName)
            .ThenBy(e => e.Student.FirstName)
            .Select(e => new
            {
                e.Id,
                e.StudentId,
                e.Status,
                e.EnrollmentDate,
                Student = new
                {
                    e.Student.Id,
                    e.Student.TcKimlikNo,
                    e.Student.FirstName,
                    e.Student.LastName,
                    e.Student.Phone,
                    e.Student.Email
                }
            })
            .ToListAsync();

        var attendanceStats = await _context.Attendances
            .AsNoTracking()
            .Where(a => a.ScheduleSlot.CourseId == id)
            .GroupBy(a => a.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Present = g.Count(att => att.IsPresent),
                Recorded = g.Count()
            })
            .ToListAsync();

        var examAttempts = await _context.ExamResults
            .AsNoTracking()
            .Where(r => r.Exam.CourseId == id)
            .GroupBy(r => r.StudentId)
            .Select(g => new
            {
                StudentId = g.Key,
                Attempts = g.Count()
            })
            .ToListAsync();

        var exams = await _context.Exams
            .AsNoTracking()
            .Where(e => e.CourseId == id)
            .OrderByDescending(e => e.ExamDate)
            .Select(e => new
            {
                e.Id,
                e.ExamType,
                e.ExamDate,
                e.MebSessionCode,
                e.Status,
                e.Notes,
                ParticipantCount = e.ExamResults.Count,
                PassedCount = e.ExamResults.Count(r => r.Pass),
                FailedCount = e.ExamResults.Count(r => !r.Pass)
            })
            .ToListAsync();

        var transfers = await _context.MebbisTransferJobs
            .AsNoTracking()
            .Where(j => j.CourseId == id)
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id,
                j.Mode,
                j.Status,
                j.SuccessCount,
                j.FailureCount,
                j.ErrorMessage,
                j.StartedAt,
                j.CompletedAt,
                j.CreatedAt
            })
            .ToListAsync();

        var attendanceDict = attendanceStats.ToDictionary(a => a.StudentId, a => a);
        var examAttemptDict = examAttempts.ToDictionary(a => a.StudentId, a => a);

        var students = enrollmentItems.Select(e =>
        {
            attendanceDict.TryGetValue(e.StudentId, out var attendance);
            examAttemptDict.TryGetValue(e.StudentId, out var attempt);

            decimal? attendanceRate = null;
            if (attendance != null && attendance.Recorded > 0 && totalSlots > 0)
            {
                attendanceRate = (decimal)attendance.Present / totalSlots;
            }

            return new
            {
                e.Id,
                e.Student,
                e.Status,
                e.EnrollmentDate,
                AttendanceRate = attendanceRate,
                ExamAttempts = attempt?.Attempts ?? 0
            };
        }).ToList();

        var summary = new
        {
            TotalEnrollments = enrollmentItems.Count,
            ActiveEnrollments = enrollmentItems.Count(e => e.Status == "active"),
            CompletedEnrollments = enrollmentItems.Count(e => e.Status == "completed"),
            UpcomingScheduleCount = scheduleItems.Count(s => s.StartTime >= now),
            UpcomingExamCount = exams.Count(e => e.ExamDate >= now),
            LastTransferStatus = transfers.FirstOrDefault()?.Status
        };

        var groupData = courseInfo.Group;
        var groupEntity = new MebGroup
        {
            Id = groupData.Id,
            Year = groupData.Year,
            Month = groupData.Month,
            GroupNo = groupData.GroupNo,
            Branch = groupData.Branch,
            StartDate = groupData.StartDate,
            EndDate = groupData.EndDate,
            Capacity = groupData.Capacity,
            Status = groupData.Status
        };

        var response = new
        {
            courseInfo.Id,
            courseInfo.SrcType,
            SrcTypeName = $"SRC{courseInfo.SrcType}",
            courseInfo.IsMixed,
            courseInfo.MixedTypes,
            courseInfo.PlannedHours,
            courseInfo.MebApprovalStatus,
            courseInfo.ApprovalAt,
            courseInfo.ApprovalNotes,
            courseInfo.CreatedAt,
            courseInfo.UpdatedAt,
            Group = new
            {
                groupEntity.Id,
                groupEntity.Year,
                groupEntity.Month,
                MonthName = MebNamingHelper.GetMonthName(groupEntity.Month),
                groupEntity.GroupNo,
                groupEntity.Branch,
                groupEntity.StartDate,
                groupEntity.EndDate,
                groupEntity.Capacity,
                groupEntity.Status,
                Name = MebNamingHelper.BuildGroupName(groupEntity),
                Courses = groupCourses.Select(gc => new
                {
                    gc.Id,
                    gc.SrcType,
                    SrcTypeName = $"SRC{gc.SrcType}",
                    gc.PlannedHours,
                    gc.IsMixed,
                    gc.MixedTypes,
                    gc.MebApprovalStatus,
                    gc.EnrollmentCount,
                    gc.CreatedAt
                })
            },
            Summary = summary,
            Schedule = scheduleItems,
            Students = students,
            Exams = exams,
            MebbisTransfers = transfers
        };
 
        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCourseRequest request)
    {
        MebGroup? mebGroup = null;

        if (request.MebGroupId.HasValue && request.MebGroupId.Value > 0)
        {
            mebGroup = await _context.MebGroups.FindAsync(request.MebGroupId.Value);
            if (mebGroup == null)
            {
                return BadRequest(new { message = "Sınıf kaydı bulunamadı." });
            }
        }
        else
        {
            if (!request.GroupYear.HasValue || !request.GroupMonth.HasValue || !request.GroupStartDate.HasValue || !request.GroupEndDate.HasValue)
            {
                return BadRequest(new { message = "Yeni bir sınıf oluşturmak için yıl, ay ve tarih bilgileri gereklidir." });
            }

            var startDate = request.GroupStartDate.Value.Date;
            var endDate = request.GroupEndDate.Value.Date;
            if (startDate >= endDate)
            {
                return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden büyük olmalıdır." });
            }

            var branch = string.IsNullOrWhiteSpace(request.GroupBranch) ? null : request.GroupBranch.Trim();
            var groupNo = request.GroupNo.HasValue && request.GroupNo.Value > 0 ? request.GroupNo.Value : 1;
            var capacity = request.GroupCapacity.HasValue && request.GroupCapacity.Value > 0 ? request.GroupCapacity.Value : 30;

            var duplicateExists = await _context.MebGroups
                .AnyAsync(g =>
                    g.Year == request.GroupYear.Value &&
                    g.Month == request.GroupMonth.Value &&
                    g.GroupNo == groupNo &&
                    (g.Branch ?? string.Empty) == (branch ?? string.Empty));
            if (duplicateExists)
            {
                return Conflict(new { message = "Bu sınıf bilgileriyle daha önce kayıt oluşturulmuş." });
            }

            mebGroup = new MebGroup
            {
                Year = request.GroupYear.Value,
                Month = request.GroupMonth.Value,
                GroupNo = groupNo,
                Branch = branch,
                StartDate = startDate,
                EndDate = endDate,
                Capacity = capacity,
                Status = "draft",
                CreatedAt = DateTime.UtcNow
            };

            _context.MebGroups.Add(mebGroup);
            await _context.SaveChangesAsync();
        }
 
        var course = new SRC.Domain.Entities.Course
        {
            MebGroupId = mebGroup.Id,
            SrcType = request.SrcType,
            IsMixed = request.IsMixed,
            MixedTypes = request.MixedTypes,
            PlannedHours = request.PlannedHours,
            MebApprovalStatus = "draft",
            CreatedAt = DateTime.UtcNow
        };

        _context.Courses.Add(course);
        await _context.SaveChangesAsync();

        var response = new
        {
            course.Id,
            course.MebGroupId,
            course.SrcType,
            course.IsMixed,
            course.MixedTypes,
            course.PlannedHours,
            course.MebApprovalStatus,
            course.CreatedAt
        };

        return CreatedAtAction(nameof(GetById), new { id = course.Id }, response);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateCourseRequest request)
    {
        var course = await _context.Courses.FindAsync(id);
        if (course == null)
        {
            return NotFound();
        }

        if (request.SrcType.HasValue) course.SrcType = request.SrcType.Value;
        if (request.IsMixed.HasValue) course.IsMixed = request.IsMixed.Value;
        if (request.MixedTypes != null) course.MixedTypes = request.MixedTypes;
        if (request.PlannedHours.HasValue) course.PlannedHours = request.PlannedHours.Value;
        if (request.MebApprovalStatus != null) course.MebApprovalStatus = request.MebApprovalStatus;
        course.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(course);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var course = await _context.Courses
            .FirstOrDefaultAsync(c => c.Id == id);
        if (course == null)
        {
            return NotFound();
        }

        await CourseDeletionHelper.CleanupCourseAsync(_context, course);
        _context.Courses.Remove(course);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id}/students")]
    public async Task<ActionResult> AddStudent(int id, [FromBody] AddStudentToCourseRequest request)
    {
        var course = await _context.Courses
            .Include(c => c.Enrollments)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (course == null)
        {
            return NotFound(new { message = "Kurs bulunamadı" });
        }

        var student = await _context.Students.FindAsync(request.StudentId);
        if (student == null)
        {
            return NotFound(new { message = "Kursiyer bulunamadı" });
        }

        if (course.Enrollments.Any(e => e.StudentId == request.StudentId))
        {
            return BadRequest(new { message = "Kursiyer zaten bu kursa kayıtlı" });
        }

        // SRC türü uyumluluğu kontrolü
        if (!string.IsNullOrWhiteSpace(student.SelectedSrcCourses))
        {
            var selectedSrcTypes = student.SelectedSrcCourses
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var num) ? num : (int?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .ToList();

            if (selectedSrcTypes.Count > 0 && !selectedSrcTypes.Contains(course.SrcType))
            {
                var selectedSrcNames = string.Join(", ", selectedSrcTypes.Select(t => $"SRC{t}"));
                return BadRequest(new 
                { 
                    message = $"Uyarı: Bu kursiyer {selectedSrcNames} kursları için kayıt yaptırmış ancak bu sınıf SRC{course.SrcType} sınıfıdır. Devam etmek istediğinizden emin misiniz?",
                    warning = true,
                    studentSelectedSrcTypes = selectedSrcTypes,
                    courseSrcType = course.SrcType
                });
            }
        }

        var enrollment = new SRC.Domain.Entities.Enrollment
        {
            CourseId = id,
            StudentId = request.StudentId,
            EnrollmentDate = DateTime.UtcNow,
            Status = "active"
        };

        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Kursiyer kursa eklendi", enrollment });
    }

    [HttpDelete("{id}/students/{studentId}")]
    public async Task<IActionResult> RemoveStudent(int id, int studentId)
    {
        var enrollment = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.CourseId == id && e.StudentId == studentId);

        if (enrollment == null)
        {
            return NotFound();
        }

        _context.Enrollments.Remove(enrollment);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreateCourseRequest
{
    public int? MebGroupId { get; set; }
    public int SrcType { get; set; }
    public bool IsMixed { get; set; }
    public string? MixedTypes { get; set; }
    public int PlannedHours { get; set; }
    public int? GroupYear { get; set; }
    public int? GroupMonth { get; set; }
    public int? GroupNo { get; set; }
    public DateTime? GroupStartDate { get; set; }
    public DateTime? GroupEndDate { get; set; }
    public string? GroupBranch { get; set; }
    public int? GroupCapacity { get; set; }
}

public class UpdateCourseRequest
{
    public int? SrcType { get; set; }
    public bool? IsMixed { get; set; }
    public string? MixedTypes { get; set; }
    public int? PlannedHours { get; set; }
    public string? MebApprovalStatus { get; set; }
}

public class AddStudentToCourseRequest
{
    public int StudentId { get; set; }
}


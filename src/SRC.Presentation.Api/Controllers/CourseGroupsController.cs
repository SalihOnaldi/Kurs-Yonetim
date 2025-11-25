using System;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;
using SRC.Infrastructure.Utilities;

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
        try
        {
            var query = _context.MebGroups
                .AsNoTracking()
                .AsQueryable();

            if (year.HasValue)
            {
                query = query.Where(g => g.Year == year.Value);
            }

            if (month.HasValue)
            {
                query = query.Where(g => g.Month == month.Value);
            }

            if (!string.IsNullOrWhiteSpace(branch))
            {
                query = query.Where(g => g.Branch != null && g.Branch.ToLower() == branch.Trim().ToLower());
            }

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(g => g.Status.ToLower() == status.Trim().ToLower());
            }

            var groups = await query
                .Select(g => new
                {
                    id = g.Id,
                    year = g.Year,
                    month = g.Month,
                    groupNo = g.GroupNo,
                    branch = g.Branch,
                    startDate = g.StartDate,
                    endDate = g.EndDate,
                    capacity = g.Capacity,
                    status = g.Status,
                    name = MebNamingHelper.BuildGroupName(g),
                    srcType = g.SrcType,
                    isMixed = g.IsMixed,
                    mixedTypes = g.MixedTypes,
                    plannedHours = g.PlannedHours,
                    mebApprovalStatus = g.MebApprovalStatus,
                    enrollmentCount = g.Enrollments.Count,
                    createdAt = g.CreatedAt
                })
                .OrderByDescending(g => g.year)
                .ThenByDescending(g => g.month)
                .ThenBy(g => g.groupNo)
                .ToListAsync();

            return Ok(groups);
        }
        catch (Exception ex)
        {
            // Log the exception
            return StatusCode(500, new { message = "Sınıflar yüklenirken hata oluştu.", error = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    [HttpGet("{id}/detail")]
    public async Task<ActionResult> GetDetail(int id)
    {
        var group = await _context.MebGroups
            .AsNoTracking()
            .Include(g => g.Enrollments)
                .ThenInclude(e => e.Student)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (group == null)
        {
            return NotFound(new { message = "MEB grubu bulunamadı." });
        }

        var now = DateTime.UtcNow;
        var enrollments = group.Enrollments
            .OrderBy(e => e.Student.LastName)
            .ThenBy(e => e.Student.FirstName)
            .ToList();

        var scheduleSlots = await _context.ScheduleSlots
            .AsNoTracking()
            .Include(s => s.Instructor)
            .Include(s => s.Attendances)
            .Where(s => s.MebGroupId == id)
            .OrderBy(s => s.StartTime)
            .Select(s => new
            {
                s.Id,
                s.Subject,
                s.ClassroomName,
                s.StartTime,
                s.EndTime,
                Instructor = s.Instructor != null ? new
                {
                    s.Instructor.Id,
                    s.Instructor.FullName,
                    s.Instructor.Username
                } : null,
                AttendanceCount = s.Attendances.Count,
                PresentCount = s.Attendances.Count(a => a.IsPresent)
            })
            .ToListAsync();

        var exams = await _context.Exams
            .AsNoTracking()
            .Include(e => e.ExamResults)
            .Where(e => e.MebGroupId == id)
            .OrderBy(e => e.ExamDate)
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

        var mebbisTransfers = await _context.MebbisTransferJobs
            .AsNoTracking()
            .Where(j => j.MebGroupId == id)
            .OrderByDescending(j => j.CreatedAt)
            .Take(5)
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

        var activeEnrollments = enrollments.Count(e => e.Status == "active");
        var completedEnrollments = enrollments.Count(e => e.Status == "completed");
        var upcomingScheduleCount = scheduleSlots.Count(s => s.StartTime >= now);
        var upcomingExamCount = exams.Count(e => e.ExamDate >= now);
        var lastTransfer = mebbisTransfers.FirstOrDefault();
        var lastTransferStatus = lastTransfer != null ? lastTransfer.Status : null;

        var response = new
        {
            id = group.Id,
            group.Id,
            group.Year,
            group.Month,
            group.GroupNo,
            group.Branch,
            group.StartDate,
            group.EndDate,
            group.Capacity,
            group.Status,
            group.SrcType,
            srcTypeName = $"SRC{group.SrcType}",
            group.IsMixed,
            group.MixedTypes,
            group.PlannedHours,
            group.MebApprovalStatus,
            approvalAt = group.ApprovalAt,
            approvalNotes = group.ApprovalNotes,
            createdAt = group.CreatedAt,
            updatedAt = group.UpdatedAt,
            name = MebNamingHelper.BuildGroupName(group),
            group = new
            {
                id = group.Id,
                group.Id,
                group.Year,
                group.Month,
                monthName = new DateTime(group.Year, group.Month, 1).ToString("MMMM", new System.Globalization.CultureInfo("tr-TR")),
                group.GroupNo,
                group.Branch,
                group.StartDate,
                group.EndDate,
                group.Capacity,
                group.Status,
                name = MebNamingHelper.BuildGroupName(group)
            },
            enrollments = enrollments.Select(enrollment => new
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
            }),
            students = enrollments.Select(enrollment => new
            {
                id = enrollment.Id,
                student = new
                {
                    enrollment.Student.Id,
                    enrollment.Student.TcKimlikNo,
                    enrollment.Student.FirstName,
                    enrollment.Student.LastName,
                    enrollment.Student.Phone,
                    enrollment.Student.Email
                },
                status = enrollment.Status,
                enrollmentDate = enrollment.EnrollmentDate,
                attendanceRate = (double?)null, // Bu bilgiyi ayrı hesaplamak gerekebilir
                examAttempts = 0 // Bu bilgiyi ayrı hesaplamak gerekebilir
            }),
            schedule = scheduleSlots,
            exams = exams,
            mebbisTransfers = mebbisTransfers,
            summary = new
            {
                totalEnrollments = enrollments.Count,
                activeEnrollments = activeEnrollments,
                completedEnrollments = completedEnrollments,
                upcomingScheduleCount = upcomingScheduleCount,
                upcomingExamCount = upcomingExamCount,
                lastTransferStatus = lastTransferStatus
            }
        };

        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCourseGroupRequest request)
    {
        // Validasyonlar
        if (request.Year < 2020 || request.Year > 2100)
        {
            return BadRequest(new { message = "Geçerli bir yıl giriniz." });
        }
        
        if (request.Month < 1 || request.Month > 12)
        {
            return BadRequest(new { message = "Geçerli bir ay giriniz (1-12)." });
        }
        
        if (request.GroupNo < 1)
        {
            return BadRequest(new { message = "Grup numarası en az 1 olmalıdır." });
        }
        
        if (request.StartDate == default || request.EndDate == default)
        {
            return BadRequest(new { message = "Başlangıç ve bitiş tarihleri gereklidir." });
        }
        
        // Tarihleri sadece tarih kısmına göre karşılaştır (saat bilgisini göz ardı et)
        var startDateOnly = new DateTime(request.StartDate.Year, request.StartDate.Month, request.StartDate.Day);
        var endDateOnly = new DateTime(request.EndDate.Year, request.EndDate.Month, request.EndDate.Day);
        
        if (startDateOnly >= endDateOnly)
        {
            return BadRequest(new { message = "Bitiş tarihi başlangıç tarihinden büyük olmalıdır." });
        }
        
        if (request.SrcType == null || request.SrcType < 1 || request.SrcType > 5)
        {
            return BadRequest(new { message = "Geçerli bir SRC türü seçiniz (1-5)." });
        }
        
        if (request.Capacity <= 0)
        {
            return BadRequest(new { message = "Kontenjan en az 1 olmalıdır." });
        }
        
        if (request.PlannedHours != null && request.PlannedHours <= 0)
        {
            return BadRequest(new { message = "Planlanan saat en az 1 olmalıdır." });
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
            SrcType = request.SrcType ?? 1,
            IsMixed = request.IsMixed ?? false,
            MixedTypes = request.MixedTypes,
            PlannedHours = request.PlannedHours ?? 40,
            MebApprovalStatus = "draft",
            CreatedAt = DateTime.UtcNow
        };

        _context.MebGroups.Add(group);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), group);
    }

    [HttpPost("{id}/students")]
    public async Task<ActionResult> AddStudent(int id, [FromBody] AddGroupStudentRequest request)
    {
        if (request == null)
        {
            return BadRequest(new { message = "İstek verisi gereklidir." });
        }

        var group = await _context.MebGroups
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

        var alreadyEnrolled = await _context.Enrollments
            .AnyAsync(e => e.MebGroupId == group.Id && e.StudentId == request.StudentId);

        if (alreadyEnrolled)
        {
            return Conflict(new { message = "Kursiyer bu sınıfa zaten kayıtlı." });
        }

        // Aynı dönem içinde aktif kurs kontrolü
        var activeEnrollmentsInSamePeriod = await _context.Enrollments
            .Include(e => e.MebGroup)
            .Where(e => e.StudentId == request.StudentId && 
                       e.Status == "active" &&
                       e.MebGroup.StartDate <= group.EndDate &&
                       e.MebGroup.EndDate >= group.StartDate &&
                       e.MebGroupId != group.Id)
            .ToListAsync();

        if (activeEnrollmentsInSamePeriod.Any())
        {
            var conflictingEnrollment = activeEnrollmentsInSamePeriod.First();
            var conflictingGroup = conflictingEnrollment.MebGroup;
            
            if (conflictingGroup == null)
            {
                return BadRequest(new 
                { 
                    message = "Bu kursiyer aynı dönem içinde zaten aktif bir kursa kayıtlı. Aynı dönem içinde sadece bir aktif kursa kayıt olunabilir.",
                    warning = true
                });
            }
            
            var conflictingCourseName = MebNamingHelper.BuildCourseName(conflictingGroup.SrcType, conflictingGroup);
            return BadRequest(new 
            { 
                message = $"Bu kursiyer aynı dönem içinde zaten aktif bir kursa kayıtlı: {conflictingCourseName}. Aynı dönem içinde sadece bir aktif kursa kayıt olunabilir.",
                warning = true,
                conflictingGroupId = conflictingGroup.Id,
                conflictingCourseName = conflictingCourseName
            });
        }

        // SRC türü uyumluluğu kontrolü - ZORUNLU (ignoreSrcWarning false ise)
        if (!request.IgnoreSrcWarning)
        {
            if (string.IsNullOrWhiteSpace(student.SelectedSrcCourses))
            {
                return BadRequest(new 
                { 
                    message = $"Bu kursiyer için SRC kurs seçimi yapılmamış. Önce kursiyerin hangi SRC kurslarını almak istediğini belirtmeniz gerekmektedir.",
                    warning = true,
                    requiresSrcSelection = true
                });
            }

            var selectedSrcTypes = student.SelectedSrcCourses
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(s => int.TryParse(s.Trim(), out var num) ? num : (int?)null)
                .Where(n => n.HasValue)
                .Select(n => n!.Value)
                .ToList();

            if (selectedSrcTypes.Count == 0)
            {
                return BadRequest(new 
                { 
                    message = $"Bu kursiyer için geçerli bir SRC kurs seçimi bulunamadı.",
                    warning = true,
                    requiresSrcSelection = true,
                    blockEnrollment = true
                });
            }

            // Karma sınıf kontrolü
            if (group.IsMixed && !string.IsNullOrWhiteSpace(group.MixedTypes))
            {
                // MixedTypes formatını parse et (örn: "1,3" veya "SRC1,SRC3")
                var mixedSrcTypes = group.MixedTypes
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(s =>
                    {
                        var trimmed = s.Trim();
                        // "SRC1" formatından "1" çıkar veya direkt sayıyı al
                        if (trimmed.StartsWith("SRC", StringComparison.OrdinalIgnoreCase))
                        {
                            trimmed = trimmed.Substring(3);
                        }
                        return int.TryParse(trimmed, out var num) ? num : (int?)null;
                    })
                    .Where(n => n.HasValue)
                    .Select(n => n!.Value)
                    .ToList();

                if (mixedSrcTypes.Count > 0)
                {
                    // Öğrencinin seçtiği SRC türlerinden en az biri karma sınıfta olmalı
                    var hasMatchingSrc = selectedSrcTypes.Any(st => mixedSrcTypes.Contains(st));
                    if (!hasMatchingSrc)
                    {
                        var mixedSrcNames = string.Join(", ", mixedSrcTypes.Select(t => $"SRC{t}"));
                        var selectedSrcNames = string.Join(", ", selectedSrcTypes.Select(t => $"SRC{t}"));
                        return BadRequest(new 
                        { 
                            message = $"Bu kursiyer {selectedSrcNames} kursları için kayıt yaptırmış ancak bu karma sınıf {mixedSrcNames} kurslarını içermektedir. Sadece seçili SRC kurslarına kayıt yapılabilir.",
                            warning = true,
                            studentSelectedSrcTypes = selectedSrcTypes,
                            groupMixedSrcTypes = mixedSrcTypes,
                            blockEnrollment = true
                        });
                    }
                }
            }
            else
            {
                // Normal sınıf kontrolü (karma değilse)
                if (!selectedSrcTypes.Contains(group.SrcType))
                {
                    var selectedSrcNames = string.Join(", ", selectedSrcTypes.Select(t => $"SRC{t}"));
                    return BadRequest(new 
                    { 
                        message = $"Bu kursiyer {selectedSrcNames} kursları için kayıt yaptırmış ancak bu sınıf SRC{group.SrcType} sınıfıdır. Sadece seçili SRC kurslarına kayıt yapılabilir.",
                        warning = true,
                        studentSelectedSrcTypes = selectedSrcTypes,
                        groupSrcType = group.SrcType,
                        blockEnrollment = true
                    });
                }
            }
        }

        var enrollment = new Enrollment
        {
            MebGroupId = group.Id,
            StudentId = request.StudentId,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status!,
            EnrollmentDate = request.EnrollmentDate ?? DateTime.UtcNow
        };

        _context.Enrollments.Add(enrollment);
        await _context.SaveChangesAsync();

        return Ok(new { enrollment.Id, enrollment.MebGroupId, enrollment.StudentId });
    }

    [HttpDelete("{groupId}/students/{enrollmentId}")]
    public async Task<ActionResult> RemoveStudent(int groupId, int enrollmentId)
    {
        var enrollment = await _context.Enrollments
            .FirstOrDefaultAsync(e => e.Id == enrollmentId && e.MebGroupId == groupId);

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
        if (request.SrcType.HasValue) group.SrcType = request.SrcType.Value;
        if (request.IsMixed.HasValue) group.IsMixed = request.IsMixed.Value;
        if (request.MixedTypes != null) group.MixedTypes = request.MixedTypes;
        if (request.PlannedHours.HasValue) group.PlannedHours = request.PlannedHours.Value;
        if (request.MebApprovalStatus != null) group.MebApprovalStatus = request.MebApprovalStatus;
        group.UpdatedAt = DateTime.UtcNow;

        // Tarihleri sadece tarih kısmına göre karşılaştır (saat bilgisini göz ardı et)
        var startDateOnly = new DateTime(group.StartDate.Year, group.StartDate.Month, group.StartDate.Day);
        var endDateOnly = new DateTime(group.EndDate.Year, group.EndDate.Month, group.EndDate.Day);
        
        if (startDateOnly >= endDateOnly)
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
            .Include(g => g.Enrollments)
            .Include(g => g.ScheduleSlots)
            .Include(g => g.Exams)
            .Include(g => g.MebbisTransferJobs)
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

        // Hard delete - cleanup related data
        foreach (var enrollment in group.Enrollments.ToList())
        {
            await _context.Entry(enrollment).Collection(e => e.MebbisTransferItems).LoadAsync();
            var transferItems = enrollment.MebbisTransferItems.ToList();
            if (transferItems.Any())
            {
                _context.MebbisTransferItems.RemoveRange(transferItems);
            }
            
            var relatedPayments = await _context.Payments
                .Where(p => p.EnrollmentId.HasValue && p.EnrollmentId.Value == enrollment.Id)
                .ToListAsync();
            foreach (var payment in relatedPayments)
            {
                payment.EnrollmentId = null;
            }
        }

        foreach (var exam in group.Exams.ToList())
        {
            await _context.Entry(exam).Collection(e => e.ExamResults).LoadAsync();
        }

        foreach (var job in group.MebbisTransferJobs.ToList())
        {
            await _context.Entry(job).Collection(j => j.TransferItems).LoadAsync();
        }

        _context.Enrollments.RemoveRange(group.Enrollments);
        _context.ScheduleSlots.RemoveRange(group.ScheduleSlots);
        _context.Exams.RemoveRange(group.Exams);
        _context.MebbisTransferJobs.RemoveRange(group.MebbisTransferJobs);
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
    public int? SrcType { get; set; }
    public bool? IsMixed { get; set; }
    public string? MixedTypes { get; set; }
    public int? PlannedHours { get; set; }
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
    public int? SrcType { get; set; }
    public bool? IsMixed { get; set; }
    public string? MixedTypes { get; set; }
    public int? PlannedHours { get; set; }
    public string? MebApprovalStatus { get; set; }
}

public class AddGroupStudentRequest
{
    public int StudentId { get; set; }
    public string? Status { get; set; }
    public DateTime? EnrollmentDate { get; set; }
    public bool IgnoreSrcWarning { get; set; } = false; // SRC uyarısını görmezden gel
}

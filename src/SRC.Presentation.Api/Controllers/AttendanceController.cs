using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IFileStorageService _fileStorageService;
    private readonly IFaceService _faceService;

    public AttendanceController(
        SrcDbContext context,
        IFileStorageService fileStorageService,
        IFaceService faceService)
    {
        _context = context;
        _fileStorageService = fileStorageService;
        _faceService = faceService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? scheduleSlotId, [FromQuery] int? studentId)
    {
        var query = _context.Attendances
            .Include(a => a.Student)
            .Include(a => a.ScheduleSlot)
                .ThenInclude(s => s.Course)
            .AsQueryable();

        if (scheduleSlotId.HasValue)
        {
            query = query.Where(a => a.ScheduleSlotId == scheduleSlotId.Value);
        }

        if (studentId.HasValue)
        {
            query = query.Where(a => a.StudentId == studentId.Value);
        }

        var attendances = await query
            .Select(a => new
            {
                a.Id,
                StudentInfo = new
                {
                    a.Student.Id,
                    a.Student.TcKimlikNo,
                    a.Student.FirstName,
                    a.Student.LastName
                },
                ScheduleSlotInfo = new
                {
                    a.ScheduleSlot.Id,
                    a.ScheduleSlot.StartTime,
                    a.ScheduleSlot.EndTime,
                    a.ScheduleSlot.Subject,
                    CourseInfo = new
                    {
                        a.ScheduleSlot.Course.Id,
                        a.ScheduleSlot.Course.SrcType
                    }
                },
                a.IsPresent,
                a.Excuse,
                a.GpsLat,
                a.GpsLng,
                a.GpsAccuracy,
                a.MarkedAt,
                a.CreatedAt
            })
            .ToListAsync();

        return Ok(attendances);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAttendanceRequest request)
    {
        var student = await _context.Students.FindAsync(request.StudentId);
        if (student == null)
        {
            return BadRequest(new { message = "Kursiyer bulunamadı" });
        }

        var scheduleSlot = await _context.ScheduleSlots.FindAsync(request.ScheduleSlotId);
        if (scheduleSlot == null)
        {
            return BadRequest(new { message = "Ders programı bulunamadı" });
        }

        var attendance = new SRC.Domain.Entities.Attendance
        {
            StudentId = request.StudentId,
            ScheduleSlotId = request.ScheduleSlotId,
            IsPresent = request.IsPresent,
            Excuse = request.Excuse,
            GpsLat = request.GpsLat,
            GpsLng = request.GpsLng,
            GpsAccuracy = request.GpsAccuracy,
            EvidenceUrl = request.EvidenceUrl,
            FaceVerified = request.FaceVerified,
            MarkedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _context.Attendances.Add(attendance);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = attendance.Id }, attendance);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateAttendanceRequest request)
    {
        var attendance = await _context.Attendances.FindAsync(id);
        if (attendance == null)
        {
            return NotFound();
        }

        if (request.IsPresent.HasValue) attendance.IsPresent = request.IsPresent.Value;
        if (request.Excuse != null) attendance.Excuse = request.Excuse;
        if (request.GpsLat.HasValue) attendance.GpsLat = request.GpsLat;
        if (request.GpsLng.HasValue) attendance.GpsLng = request.GpsLng;
        if (request.GpsAccuracy.HasValue) attendance.GpsAccuracy = request.GpsAccuracy;
        if (request.EvidenceUrl != null) attendance.EvidenceUrl = request.EvidenceUrl;
        if (request.FaceVerified.HasValue) attendance.FaceVerified = request.FaceVerified.Value;

        await _context.SaveChangesAsync();

        return Ok(attendance);
    }

    [HttpPost("bulk")]
    public async Task<ActionResult> CreateBulk([FromBody] CreateBulkAttendanceRequest request)
    {
        var scheduleSlot = await _context.ScheduleSlots.FindAsync(request.ScheduleSlotId);
        if (scheduleSlot == null)
        {
            return BadRequest(new { message = "Ders programı bulunamadı" });
        }

        var attendances = request.Attendances.Select(a => new SRC.Domain.Entities.Attendance
        {
            StudentId = a.StudentId,
            ScheduleSlotId = request.ScheduleSlotId,
            IsPresent = a.IsPresent,
            Excuse = a.Excuse,
            GpsLat = a.GpsLat,
            GpsLng = a.GpsLng,
            GpsAccuracy = a.GpsAccuracy,
            EvidenceUrl = a.EvidenceUrl,
            FaceVerified = a.FaceVerified,
            MarkedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        }).ToList();

        _context.Attendances.AddRange(attendances);
        await _context.SaveChangesAsync();

        return Ok(new { message = $"{attendances.Count} yoklama kaydı eklendi" });
    }

    [HttpPost("check-in")]
    public async Task<ActionResult> CheckIn([FromBody] AttendanceCheckInRequest request, CancellationToken cancellationToken)
    {
        if (request == null)
        {
            return BadRequest(new { message = "Geçersiz istek." });
        }

        if (string.IsNullOrWhiteSpace(request.PhotoBase64))
        {
            return BadRequest(new { message = "Fotoğraf gereklidir." });
        }

        var student = await _context.Students.FirstOrDefaultAsync(s => s.Id == request.StudentId, cancellationToken);
        if (student == null)
        {
            return BadRequest(new { message = "Kursiyer bulunamadı." });
        }

        var scheduleSlot = await _context.ScheduleSlots.FirstOrDefaultAsync(s => s.Id == request.ScheduleSlotId, cancellationToken);
        if (scheduleSlot == null)
        {
            return BadRequest(new { message = "Ders programı bulunamadı." });
        }

        byte[] photoBytes;
        try
        {
            var base64 = request.PhotoBase64.Contains(",")
                ? request.PhotoBase64.Split(',', 2)[1]
                : request.PhotoBase64;
            photoBytes = Convert.FromBase64String(base64);
        }
        catch (Exception)
        {
            return BadRequest(new { message = "Fotoğraf verisi çözümlenemedi." });
        }

        var utcNow = DateTime.UtcNow;
        var fileName = $"attendance/{scheduleSlot.Id}/student-{student.Id}-{utcNow:yyyyMMddHHmmss}.jpg";
        string evidenceUrl;

        using (var imageStream = new MemoryStream(photoBytes))
        {
            if (string.IsNullOrWhiteSpace(student.FaceProfileId))
            {
                student.FaceProfileId = await _faceService.EnrollAsync(imageStream, cancellationToken);
                imageStream.Position = 0;
            }
            else
            {
                var verified = await _faceService.VerifyAsync(student.FaceProfileId, imageStream, cancellationToken);
                if (!verified)
                {
                    return BadRequest(new { message = "Yüz doğrulaması başarısız oldu. Lütfen tekrar deneyin." });
                }
                imageStream.Position = 0;
            }

            evidenceUrl = await _fileStorageService.UploadFileAsync(imageStream, fileName, "image/jpeg");
        }

        var attendance = await _context.Attendances
            .FirstOrDefaultAsync(a => a.StudentId == student.Id && a.ScheduleSlotId == scheduleSlot.Id, cancellationToken);

        if (attendance == null)
        {
            attendance = new SRC.Domain.Entities.Attendance
            {
                StudentId = student.Id,
                ScheduleSlotId = scheduleSlot.Id,
                CreatedAt = utcNow
            };

            _context.Attendances.Add(attendance);
        }

        attendance.IsPresent = true;
        attendance.GpsLat = request.GpsLat;
        attendance.GpsLng = request.GpsLng;
        attendance.GpsAccuracy = request.GpsAccuracy;
        attendance.EvidenceUrl = evidenceUrl;
        attendance.FaceVerified = true;
        attendance.MarkedAt = utcNow;
        attendance.Excuse = null;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            attendance.Id,
            attendance.StudentId,
            attendance.ScheduleSlotId,
            attendance.FaceVerified,
            attendance.GpsLat,
            attendance.GpsLng,
            attendance.GpsAccuracy,
            attendance.EvidenceUrl,
            attendance.MarkedAt
        });
    }
}

public class CreateAttendanceRequest
{
    public int StudentId { get; set; }
    public int ScheduleSlotId { get; set; }
    public bool IsPresent { get; set; }
    public string? Excuse { get; set; }
    public decimal? GpsLat { get; set; }
    public decimal? GpsLng { get; set; }
    public decimal? GpsAccuracy { get; set; }
    public string? EvidenceUrl { get; set; }
    public bool FaceVerified { get; set; }
}

public class UpdateAttendanceRequest
{
    public bool? IsPresent { get; set; }
    public string? Excuse { get; set; }
    public decimal? GpsLat { get; set; }
    public decimal? GpsLng { get; set; }
    public decimal? GpsAccuracy { get; set; }
    public string? EvidenceUrl { get; set; }
    public bool? FaceVerified { get; set; }
}

public class CreateBulkAttendanceRequest
{
    public int ScheduleSlotId { get; set; }
    public List<BulkAttendanceItem> Attendances { get; set; } = new();
}

public class BulkAttendanceItem
{
    public int StudentId { get; set; }
    public bool IsPresent { get; set; }
    public string? Excuse { get; set; }
    public decimal? GpsLat { get; set; }
    public decimal? GpsLng { get; set; }
    public decimal? GpsAccuracy { get; set; }
    public string? EvidenceUrl { get; set; }
    public bool FaceVerified { get; set; }
}

public class AttendanceCheckInRequest
{
    public int StudentId { get; set; }
    public int ScheduleSlotId { get; set; }
    public string PhotoBase64 { get; set; } = string.Empty;
    public decimal? GpsLat { get; set; }
    public decimal? GpsLng { get; set; }
    public decimal? GpsAccuracy { get; set; }
}


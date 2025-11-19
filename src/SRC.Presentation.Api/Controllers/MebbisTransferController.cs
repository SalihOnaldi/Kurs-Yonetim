using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/mebbis-transfer")]
[Authorize]
public class MebbisTransferController : ControllerBase
{
    private readonly SrcDbContext _context;
    private readonly IMebbisAdapter _mebbisAdapter;

    public MebbisTransferController(SrcDbContext context, IMebbisAdapter mebbisAdapter)
    {
        _context = context;
        _mebbisAdapter = mebbisAdapter;
    }

    [HttpGet]
    public async Task<ActionResult> GetJobs([FromQuery] int? courseId)
    {
        var query = _context.MebbisTransferJobs
            .AsNoTracking()
            .Include(j => j.Course)
                .ThenInclude(c => c.MebGroup)
            .AsQueryable();

        if (courseId.HasValue)
        {
            query = query.Where(j => j.CourseId == courseId.Value);
        }

        var jobs = await query
            .OrderByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id,
                j.CourseId,
                j.Mode,
                j.Status,
                j.SuccessCount,
                j.FailureCount,
                j.ErrorMessage,
                j.StartedAt,
                j.CompletedAt,
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
            .ToListAsync();

        return Ok(jobs);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetJobById(int id)
    {
        var job = await BuildJobResponseAsync(id, includeItems: true);
        if (job == null)
        {
            return NotFound();
        }

        return Ok(job);
    }

    [HttpPost("{courseId}")]
    public async Task<ActionResult> TriggerTransfer(int courseId, [FromQuery] string mode = "dry_run")
    {
        var normalizedMode = (mode ?? "dry_run").Trim().ToLower();
        var isDryRun = normalizedMode != "live";

        var course = await _context.Courses
            .Include(c => c.MebGroup)
            .Include(c => c.Enrollments)
                .ThenInclude(e => e.Student)
            .FirstOrDefaultAsync(c => c.Id == courseId);

        if (course == null)
        {
            return NotFound(new { message = "Kurs bulunamadı" });
        }

        var enrollments = course.Enrollments
            .Where(e => e.Status == "active")
            .ToList();

        if (!enrollments.Any())
        {
            return BadRequest(new { message = "Aktarılacak aktif kursiyer bulunamadı" });
        }

        var enrollmentLookup = enrollments.ToDictionary(e => e.Id);

        var job = new SRC.Domain.Entities.MebbisTransferJob
        {
            CourseId = courseId,
            Mode = isDryRun ? "dry_run" : "live",
            Status = "running",
            StartedAt = DateTime.UtcNow,
            SuccessCount = 0,
            FailureCount = 0
        };

        _context.MebbisTransferJobs.Add(job);
        await _context.SaveChangesAsync();

        var transferItems = new List<SRC.Domain.Entities.MebbisTransferItem>(enrollments.Count);

        foreach (var enrollment in enrollments)
        {
            var item = new SRC.Domain.Entities.MebbisTransferItem
            {
                MebbisTransferJobId = job.Id,
                EnrollmentId = enrollment.Id,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };
            transferItems.Add(item);
        }

        _context.MebbisTransferItems.AddRange(transferItems);
        await _context.SaveChangesAsync();

        try
        {
            foreach (var item in transferItems)
            {
                var enrollment = enrollmentLookup[item.EnrollmentId];
                var student = enrollment.Student;

                var request = new MebbisTransferRequest
                {
                    EnrollmentId = enrollment.Id,
                    StudentTcKimlikNo = student.TcKimlikNo,
                    StudentName = student.FirstName,
                    StudentSurname = student.LastName,
                    BirthDate = student.BirthDate,
                    SrcType = enrollment.Course.SrcType,
                    EnrollmentDate = enrollment.EnrollmentDate
                };

                try
                {
                    var response = await _mebbisAdapter.TransferStudentAsync(request, isDryRun);

                    if (response.Success)
                    {
                        item.Status = "transferred";
                        job.SuccessCount++;
                    }
                    else
                    {
                        item.Status = "failed";
                        item.ErrorCode = response.ErrorCode;
                        item.ErrorMessage = response.ErrorMessage;
                        job.FailureCount++;
                    }
                }
                catch (Exception ex)
                {
                    item.Status = "failed";
                    item.ErrorCode = "EXCEPTION";
                    item.ErrorMessage = ex.Message;
                    job.FailureCount++;
                }

                item.TransferredAt = DateTime.UtcNow;
            }

            job.Status = job.FailureCount > 0 ? "failed" : "completed";
            job.CompletedAt = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            job.Status = "failed";
            job.ErrorMessage = ex.Message;
            job.CompletedAt = DateTime.UtcNow;

            foreach (var item in transferItems.Where(i => i.Status == "pending"))
            {
                item.Status = "failed";
                item.ErrorCode = "JOB_FAILED";
                item.ErrorMessage = "Genel aktarım hatası";
            }
        }

        await _context.SaveChangesAsync();

        var result = await BuildJobResponseAsync(job.Id, includeItems: true);
        return CreatedAtAction(nameof(GetJobById), new { id = job.Id }, result);
    }

    private async Task<object?> BuildJobResponseAsync(int jobId, bool includeItems = false)
    {
        var query = _context.MebbisTransferJobs
            .AsNoTracking()
            .Include(j => j.Course)
                .ThenInclude(c => c.MebGroup)
            .Include(j => j.TransferItems)
                .ThenInclude(t => t.Enrollment)
                    .ThenInclude(e => e.Student)
            .Where(j => j.Id == jobId)
            .Select(j => new
            {
                j.Id,
                j.CourseId,
                j.Mode,
                j.Status,
                j.SuccessCount,
                j.FailureCount,
                j.ErrorMessage,
                j.StartedAt,
                j.CompletedAt,
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
                        j.Course.MebGroup.Branch,
                        j.Course.MebGroup.StartDate,
                        j.Course.MebGroup.EndDate
                    }
                },
                Items = includeItems
                    ? j.TransferItems
                        .OrderBy(t => t.Id)
                        .Select(t => new
                        {
                            t.Id,
                            t.EnrollmentId,
                            t.Status,
                            t.ErrorCode,
                            t.ErrorMessage,
                            t.TransferredAt,
                            Enrollment = new
                            {
                                t.Enrollment.Id,
                                t.Enrollment.Student.FirstName,
                                t.Enrollment.Student.LastName,
                                t.Enrollment.Student.TcKimlikNo
                            }
                        })
                    : null
            });

        return await query.FirstOrDefaultAsync();
    }
}


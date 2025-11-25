using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Infrastructure.Utilities;
using SRC.Presentation.Api.Utilities;
using System.Globalization;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public ReportsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpPost("generate")]
    public async Task<ActionResult> Generate([FromBody] GenerateReportRequest request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.ReportType))
        {
            return BadRequest(new { message = "Rapor tipi belirtilmelidir." });
        }

        var type = request.ReportType.Trim().ToLower();
        object data;
        object meta;

        switch (type)
        {
            case "lesson_schedule":
            case "schedule":
                {
                    if (!TryGetIntParam(request.Parameters, "mebGroupId", out var mebGroupId))
                    {
                        return BadRequest(new { message = "Ders programı raporu için mebGroupId gereklidir." });
                    }

                    var group = await _context.MebGroups
                        .AsNoTracking()
                        .Where(g => g.Id == mebGroupId)
                        .Select(g => new
                        {
                            g.Id,
                            g.SrcType,
                            g.IsMixed,
                            g.Year,
                            g.Month,
                            g.GroupNo,
                            g.Branch,
                            g.StartDate,
                            g.EndDate
                        })
                        .FirstOrDefaultAsync();

                    if (group == null)
                    {
                        return NotFound(new { message = "Sınıf bulunamadı." });
                    }

                    var slots = await _context.ScheduleSlots
                        .AsNoTracking()
                        .Where(s => s.MebGroupId == mebGroupId)
                        .OrderBy(s => s.StartTime)
                        .Select(s => new
                        {
                            s.Id,
                            s.Subject,
                            s.StartTime,
                            s.EndTime,
                            s.ClassroomName,
                            Instructor = s.Instructor != null ? s.Instructor.FullName : null
                        })
                        .ToListAsync();

                    data = slots;
                    meta = new
                    {
                        Group = group,
                        TotalSlots = slots.Count
                    };
                    break;
                }

            case "attendance":
                {
                    if (!TryGetIntParam(request.Parameters, "mebGroupId", out var mebGroupId))
                    {
                        return BadRequest(new { message = "Yoklama raporu için mebGroupId gereklidir." });
                    }

                    var attendanceQuery = _context.Attendances
                        .AsNoTracking()
                        .Include(a => a.ScheduleSlot)
                        .Where(a => a.ScheduleSlot.MebGroupId == mebGroupId);

                    DateTime? startFilter = null;
                    if (TryGetDateParam(request.Parameters, "startDate", out var startDate))
                    {
                        startFilter = startDate;
                        attendanceQuery = attendanceQuery.Where(a => a.ScheduleSlot.StartTime >= startDate);
                    }

                    DateTime? endFilter = null;
                    if (TryGetDateParam(request.Parameters, "endDate", out var endDate))
                    {
                        endFilter = endDate;
                        attendanceQuery = attendanceQuery.Where(a => a.ScheduleSlot.StartTime <= endDate);
                    }

                    var attendances = await attendanceQuery
                        .OrderBy(a => a.ScheduleSlot.StartTime)
                        .ThenBy(a => a.Student.LastName)
                        .Select(a => new
                        {
                            a.Id,
                            SlotId = a.ScheduleSlotId,
                            SlotStart = a.ScheduleSlot.StartTime,
                            SlotEnd = a.ScheduleSlot.EndTime,
                            a.IsPresent,
                            a.Excuse,
                            Student = new
                            {
                                a.Student.Id,
                                a.Student.FirstName,
                                a.Student.LastName,
                                a.Student.TcKimlikNo
                            }
                        })
                        .ToListAsync();

                    data = attendances;
                    meta = new
                    {
                        TotalRecords = attendances.Count,
                        PresentCount = attendances.Count(a => a.IsPresent),
                        AbsentCount = attendances.Count(a => !a.IsPresent),
                        Filters = new
                        {
                            StartDate = startFilter,
                            EndDate = endFilter
                        }
                    };
                    break;
                }

            case "exam_results":
            case "exam":
                {
                    if (!TryGetIntParam(request.Parameters, "examId", out var examId))
                    {
                        return BadRequest(new { message = "Sınav raporu için examId gereklidir." });
                    }

                    var examInfo = await _context.Exams
                        .AsNoTracking()
                        .Include(e => e.MebGroup)
                        .Where(e => e.Id == examId)
                        .Select(e => new
                        {
                            e.Id,
                            e.ExamType,
                            e.ExamDate,
                            e.MebSessionCode,
                            e.Status,
                            Group = new
                            {
                                e.MebGroup.Id,
                                e.MebGroup.SrcType,
                                e.MebGroup.GroupNo,
                                Branch = e.MebGroup.Branch
                            }
                        })
                        .FirstOrDefaultAsync();

                    if (examInfo == null)
                    {
                        return NotFound(new { message = "Sınav bulunamadı." });
                    }

                    var results = await _context.ExamResults
                        .AsNoTracking()
                        .Where(r => r.ExamId == examId)
                        .OrderBy(r => r.Student.LastName)
                        .ThenBy(r => r.Student.FirstName)
                        .Select(r => new
                        {
                            r.Student.TcKimlikNo,
                            r.Student.FirstName,
                            r.Student.LastName,
                            r.Score,
                            r.Pass,
                            r.AttemptNo,
                            r.Notes
                        })
                        .ToListAsync();

                    var total = results.Count;
                    var passed = results.Count(r => r.Pass);
                    var failed = total - passed;
                    var average = total > 0 ? results.Average(r => r.Score) : 0m;

                    data = results;
                    meta = new
                    {
                        Exam = new
                        {
                            examInfo.Id,
                            examInfo.ExamType,
                            examInfo.ExamDate,
                            examInfo.MebSessionCode,
                            examInfo.Status
                        },
                        Group = examInfo.Group,
                        Stats = new
                        {
                            Total = total,
                            Passed = passed,
                            Failed = failed,
                            AverageScore = average
                        }
                    };
                    break;
                }

            case "certificates":
                {
                    if (!TryGetIntParam(request.Parameters, "mebGroupId", out var mebGroupId))
                    {
                        return BadRequest(new { message = "Sertifika listesi için mebGroupId gereklidir." });
                    }

                    var groupInfo = await _context.MebGroups
                        .AsNoTracking()
                        .Where(g => g.Id == mebGroupId)
                        .Select(g => new
                        {
                            g.Id,
                            g.SrcType,
                            g.Year,
                            g.Month,
                            g.GroupNo,
                            g.Branch
                        })
                        .FirstOrDefaultAsync();

                    if (groupInfo == null)
                    {
                        return NotFound(new { message = "Sınıf bulunamadı." });
                    }

                    var attemptCounts = await _context.ExamResults
                        .AsNoTracking()
                        .Include(er => er.Exam)
                        .Where(r => r.Exam.MebGroupId == mebGroupId)
                        .GroupBy(r => r.StudentId)
                        .Select(g => new
                        {
                            StudentId = g.Key,
                            AttemptCount = g.Count()
                        })
                        .ToDictionaryAsync(x => x.StudentId, x => x.AttemptCount);

                    var passedResults = await _context.ExamResults
                        .AsNoTracking()
                        .Include(er => er.Exam)
                        .Where(r => r.Exam.MebGroupId == mebGroupId && r.Pass)
                        .Select(r => new
                        {
                            r.StudentId,
                            r.Student.TcKimlikNo,
                            r.Student.FirstName,
                            r.Student.LastName,
                            r.Score,
                            ExamDate = r.Exam.ExamDate
                        })
                        .ToListAsync();

                    var passedStudents = passedResults
                        .GroupBy(r => r.StudentId)
                        .Select(g =>
                        {
                            var last = g.OrderByDescending(x => x.ExamDate).First();
                            return new
                            {
                                last.TcKimlikNo,
                                last.FirstName,
                                last.LastName,
                                LastExamDate = last.ExamDate,
                                last.Score,
                                AttemptCount = attemptCounts.TryGetValue(g.Key, out var count) ? count : g.Count()
                            };
                        })
                        .OrderBy(r => r.LastName)
                        .ThenBy(r => r.FirstName)
                        .ToList();

                    data = passedStudents;
                    meta = new
                    {
                        Group = groupInfo,
                        TotalCertificates = passedStudents.Count
                    };
                    break;
                }

            case "payments":
                {
                    TryGetIntParam(request.Parameters, "mebGroupId", out var mebGroupId);
                    TryGetIntParam(request.Parameters, "studentId", out var studentId);

                    if (mebGroupId == 0 && studentId == 0)
                    {
                        return BadRequest(new { message = "Ödeme raporu için mebGroupId veya studentId gereklidir." });
                    }

                    var paymentsQuery = _context.Payments
                        .AsNoTracking()
                        .AsQueryable();

                    if (studentId != 0)
                    {
                        paymentsQuery = paymentsQuery.Where(p => p.StudentId == studentId);
                    }

                    if (mebGroupId != 0)
                    {
                        paymentsQuery = paymentsQuery.Where(p => p.Enrollment != null && p.Enrollment.MebGroupId == mebGroupId);
                    }

                    var payments = await paymentsQuery
                        .OrderBy(p => p.DueDate)
                        .Select(p => new
                        {
                            p.Id,
                            Student = new
                            {
                                p.Student.Id,
                                p.Student.FirstName,
                                p.Student.LastName,
                                p.Student.TcKimlikNo
                            },
                            Group = p.Enrollment != null ? new
                            {
                                p.Enrollment.MebGroup.Id,
                                p.Enrollment.MebGroup.SrcType,
                                GroupNo = p.Enrollment.MebGroup.GroupNo,
                                Branch = p.Enrollment.MebGroup.Branch
                            } : null,
                            p.Amount,
                            p.PenaltyAmount,
                            p.PaymentType,
                            p.Status,
                            p.DueDate,
                            p.PaidDate,
                            p.ReceiptNo
                        })
                        .ToListAsync();

                    data = payments;
                    meta = new
                    {
                        Total = payments.Count,
                        PendingAmount = payments.Where(p => p.Status == "pending").Sum(p => p.Amount + (p.PenaltyAmount ?? 0m)),
                        PaidAmount = payments.Where(p => p.Status == "paid").Sum(p => p.Amount + (p.PenaltyAmount ?? 0m))
                    };
                    break;
                }

            default:
                return BadRequest(new { message = $"Desteklenmeyen rapor tipi: {request.ReportType}" });
        }

        var format = string.IsNullOrWhiteSpace(request.Format)
            ? "json"
            : request.Format.Trim().ToLowerInvariant();

        var records = ReportExportFormatter.ExtractRecords(data);
        var fileNameBase = $"{type}-{DateTime.UtcNow:yyyyMMddHHmmss}";

        switch (format)
        {
            case "json":
                return Ok(new
                {
                    ReportType = request.ReportType,
                    Format = format,
                    GeneratedAt = DateTime.UtcNow,
                    Meta = meta,
                    Data = data
                });

            case "csv":
                {
                    var csv = ReportExportFormatter.ToCsv(records);
                    var bytes = Encoding.UTF8.GetBytes(csv);
                    return File(bytes, "text/csv", $"{fileNameBase}.csv");
                }

            case "html":
                {
                    var html = ReportExportFormatter.ToHtml(request.ReportType, records, meta);
                    var bytes = Encoding.UTF8.GetBytes(html);
                    return File(bytes, "text/html; charset=utf-8", $"{fileNameBase}.html");
                }

            case "doc":
                {
                    var html = ReportExportFormatter.ToHtml(request.ReportType, records, meta);
                    var bytes = Encoding.UTF8.GetBytes(html);
                    return File(bytes, "application/msword", $"{fileNameBase}.doc");
                }

            case "xls":
                {
                    var html = ReportExportFormatter.ToHtml(request.ReportType, records, meta);
                    var bytes = Encoding.UTF8.GetBytes(html);
                    return File(bytes, "application/vnd.ms-excel", $"{fileNameBase}.xls");
                }

            case "pdf":
                {
                    var pdfBytes = ReportExportFormatter.ToPdf(request.ReportType, records, meta);
                    return File(pdfBytes, "application/pdf", $"{fileNameBase}.pdf");
                }

            default:
                return BadRequest(new { message = $"Desteklenmeyen rapor formatı: {request.Format}" });
        }
    }

    private static bool TryGetIntParam(IDictionary<string, string>? parameters, string key, out int value)
    {
        value = 0;
        if (parameters == null)
        {
            return false;
        }

        if (!parameters.TryGetValue(key, out var text) || string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        return int.TryParse(text, out value);
    }

    private static bool TryGetDateParam(IDictionary<string, string>? parameters, string key, out DateTime value)
    {
        value = default;
        if (parameters == null)
        {
            return false;
        }

        if (!parameters.TryGetValue(key, out var text) || string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        return DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out value);
    }
}

public class GenerateReportRequest
{
    public string ReportType { get; set; } = string.Empty;
    public string? Format { get; set; }
    public Dictionary<string, string>? Parameters { get; set; }
}


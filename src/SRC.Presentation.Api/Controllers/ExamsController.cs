using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Exam;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using SRC.Presentation.Api.Utilities;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExamsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public ExamsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? courseId,
        [FromQuery] int? srcType,
        [FromQuery] string? examType,
        [FromQuery] string? status,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? branch,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = page < 1 ? 1 : page;
        pageSize = Math.Clamp(pageSize, 10, 100);

        var query = _context.Exams
            .AsNoTracking()
            .AsQueryable();

        if (courseId.HasValue)
        {
            query = query.Where(e => e.CourseId == courseId.Value);
        }

        if (srcType.HasValue)
        {
            query = query.Where(e => e.Course.SrcType == srcType.Value);
        }

        if (!string.IsNullOrWhiteSpace(examType))
        {
            var normalized = examType.Trim().ToLower();
            query = query.Where(e => e.ExamType.ToLower() == normalized);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalized = status.Trim().ToLower();
            query = query.Where(e => e.Status.ToLower() == normalized);
        }

        if (startDate.HasValue)
        {
            query = query.Where(e => e.ExamDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(e => e.ExamDate <= endDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(branch))
        {
            var pattern = $"%{branch.Trim()}%";
            query = query.Where(e => e.Course.MebGroup.Branch != null &&
                                     EF.Functions.Like(e.Course.MebGroup.Branch, pattern));
        }

        var totalCount = await query.CountAsync();
        var skip = (page - 1) * pageSize;
        var totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize);
        if (totalCount > 0 && page > totalPages)
        {
            page = totalPages;
            skip = (page - 1) * pageSize;
        }

        var exams = await query
            .OrderByDescending(e => e.ExamDate)
            .ThenByDescending(e => e.CreatedAt)
            .Skip(skip)
            .Take(pageSize)
            .Select(e => new
            {
                e.Id,
                e.ExamType,
                e.ExamDate,
                e.MebSessionCode,
                e.Status,
                e.Notes,
                CourseInfo = new
                {
                    e.Course.Id,
                    e.Course.SrcType,
                    GroupInfo = new
                    {
                        e.Course.MebGroup.Year,
                        e.Course.MebGroup.Month,
                        e.Course.MebGroup.GroupNo,
                        e.Course.MebGroup.Branch
                    }
                },
                ResultCount = e.ExamResults.Count,
                PassCount = e.ExamResults.Count(r => r.Pass),
                FailCount = e.ExamResults.Count(r => !r.Pass),
                e.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            Items = exams,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var exam = await LoadExamWithDetailsAsync(id);

        if (exam == null)
        {
            return NotFound();
        }

        return Ok(BuildExamResponse(exam));
    }

    [HttpGet("groups/{groupId}/results")]
    public async Task<ActionResult<GroupExamResultsDto>> GetResultsByGroup(int groupId)
    {
        var context = await LoadGroupExamContextAsync(groupId);
        if (context == null)
        {
            return NotFound(new { message = "Belirtilen sınıf bulunamadı." });
        }

        var written = context.Results
            .Where(item => IsWrittenExamType(item.ExamType))
            .OrderBy(item => item.LastName)
            .ThenBy(item => item.FirstName)
            .ThenByDescending(item => item.ExamDate)
            .ToList();

        var practical = context.Results
            .Where(item => IsPracticalExamType(item.ExamType))
            .OrderBy(item => item.LastName)
            .ThenBy(item => item.FirstName)
            .ThenByDescending(item => item.ExamDate)
            .ToList();

        var writtenPassCount = written.Count(item => item.Pass);
        var writtenFailCount = written.Count - writtenPassCount;
        var practicalPassCount = practical.Count(item => item.Pass);
        var practicalFailCount = practical.Count - practicalPassCount;

        var writtenPassStudents = written.Where(item => item.Pass).Select(item => item.StudentId).Distinct().ToHashSet();
        var practicalPassStudents = practical.Where(item => item.Pass).Select(item => item.StudentId).Distinct().ToHashSet();
        var graduatedStudents = writtenPassStudents.Intersect(practicalPassStudents).ToList();

        var summary = new GroupExamResultSummaryDto
        {
            TotalStudents = context.TotalStudents,
            WrittenPassCount = writtenPassCount,
            WrittenFailCount = writtenFailCount,
            PracticalPassCount = practicalPassCount,
            PracticalFailCount = practicalFailCount,
            PracticalEligibleCount = writtenPassStudents.Count,
            GraduatedCount = graduatedStudents.Count
        };

        var response = new GroupExamResultsDto
        {
            Group = context.GroupInfo,
            Written = written,
            Practical = practical,
            Summary = summary
        };

        return Ok(response);
    }

    [HttpGet("groups/{groupId}/practical-eligible")]
    public async Task<ActionResult<IReadOnlyList<PracticalEligibilityDto>>> GetPracticalEligibleByGroup(int groupId)
    {
        var context = await LoadGroupExamContextAsync(groupId);
        if (context == null)
        {
            return NotFound(new { message = "Belirtilen sınıf bulunamadı." });
        }

        var writtenPassLookup = context.Results
            .Where(item => IsWrittenExamType(item.ExamType) && item.Pass)
            .GroupBy(item => item.StudentId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.ExamDate)
                    .First());

        if (writtenPassLookup.Count == 0)
        {
            return Ok(Array.Empty<PracticalEligibilityDto>());
        }

        var practicalLookup = context.Results
            .Where(item => IsPracticalExamType(item.ExamType))
            .GroupBy(item => item.StudentId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.ExamDate)
                    .First());

        var eligibles = writtenPassLookup
            .Select(pair =>
            {
                var studentId = pair.Key;
                var written = pair.Value;
                practicalLookup.TryGetValue(studentId, out var practical);

                return new PracticalEligibilityDto
                {
                    StudentId = studentId,
                    TcKimlikNo = written.TcKimlikNo,
                    FirstName = written.FirstName,
                    LastName = written.LastName,
                    CourseId = written.CourseId,
                    CourseName = written.CourseName,
                    WrittenPassed = true,
                    WrittenExamDate = written.ExamDate,
                    WrittenScore = written.Score,
                    PracticalPassed = practical?.Pass ?? false,
                    PracticalExamDate = practical?.ExamDate,
                    PracticalScore = practical?.Score
                };
            })
            .OrderBy(item => item.LastName)
            .ThenBy(item => item.FirstName)
            .ToList();

        return Ok(eligibles);
    }

    [HttpGet("groups/{groupId}/graduates/export")]
    public async Task<IActionResult> ExportGraduatesByGroup(int groupId)
    {
        var context = await LoadGroupExamContextAsync(groupId);
        if (context == null)
        {
            return NotFound(new { message = "Belirtilen sınıf bulunamadı." });
        }

        var writtenPassLookup = context.Results
            .Where(item => IsWrittenExamType(item.ExamType) && item.Pass)
            .GroupBy(item => item.StudentId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.ExamDate)
                    .First());

        var practicalPassLookup = context.Results
            .Where(item => IsPracticalExamType(item.ExamType) && item.Pass)
            .GroupBy(item => item.StudentId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderByDescending(item => item.ExamDate)
                    .First());

        var graduateIds = writtenPassLookup.Keys.Intersect(practicalPassLookup.Keys).ToList();

        if (graduateIds.Count == 0)
        {
            return BadRequest(new { message = "Bu sınıfta hem yazılı hem pratik sınavı geçen kursiyer bulunmuyor." });
        }

        var graduates = graduateIds
            .Select(studentId =>
            {
                var reference = writtenPassLookup.TryGetValue(studentId, out var written)
                    ? written
                    : practicalPassLookup[studentId];

                return new GraduateExportItemDto
                {
                    TcKimlikNo = reference.TcKimlikNo,
                    FirstName = reference.FirstName,
                    LastName = reference.LastName
                };
            })
            .OrderBy(item => item.LastName)
            .ThenBy(item => item.FirstName)
            .ToList();

        var sb = new StringBuilder();
        sb.AppendLine("TcKimlikNo,Ad,Soyad");
        foreach (var graduate in graduates)
        {
            sb.AppendLine($"{graduate.TcKimlikNo},{graduate.FirstName},{graduate.LastName}");
        }

        var fileName = $"mezunlar_{context.Group.Year}_{context.Group.Month:00}_grup_{context.Group.GroupNo:D2}.csv";
        var encoding = new UTF8Encoding(true);
        var payload = encoding.GetBytes(sb.ToString());
        return File(payload, "text/csv", fileName);
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateExamRequest request)
    {
        var course = await _context.Courses.FindAsync(request.CourseId);
        if (course == null)
        {
            return BadRequest(new { message = "Kurs bulunamadı" });
        }

        var exam = new SRC.Domain.Entities.Exam
        {
            CourseId = request.CourseId,
            ExamType = request.ExamType,
            ExamDate = request.ExamDate,
            MebSessionCode = request.MebSessionCode,
            Status = "scheduled",
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.Exams.Add(exam);
        await _context.SaveChangesAsync();

        var createdExam = await LoadExamWithDetailsAsync(exam.Id);

        return CreatedAtAction(nameof(GetById), new { id = exam.Id }, createdExam != null ? BuildExamResponse(createdExam) : null);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateExamRequest request)
    {
        var exam = await _context.Exams.FindAsync(id);
        if (exam == null)
        {
            return NotFound();
        }

        if (request.ExamType != null) exam.ExamType = request.ExamType;
        if (request.ExamDate.HasValue) exam.ExamDate = request.ExamDate.Value;
        if (request.MebSessionCode != null) exam.MebSessionCode = request.MebSessionCode;
        if (request.Status != null) exam.Status = request.Status;
        if (request.Notes != null) exam.Notes = request.Notes;
        exam.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(await LoadExamWithDetailsAsync(id));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var exam = await _context.Exams.FindAsync(id);
        if (exam == null)
        {
            return NotFound();
        }

        _context.Exams.Remove(exam);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPost("{id}/results")]
    public async Task<ActionResult> SaveResults(int id, [FromBody] SaveExamResultsRequest request)
    {
        if (request.Results == null || request.Results.Count == 0)
        {
            return BadRequest(new { message = "En az bir sınav sonucu gönderilmelidir." });
        }

        var exam = await _context.Exams
            .Include(e => e.Course)
                .ThenInclude(c => c.MebGroup)
            .Include(e => e.ExamResults)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exam == null)
        {
            return NotFound();
        }

        try
        {
            var result = await ApplyExamResultsAsync(exam, request.Results, request.MarkCompleted);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/results/import")]
    public async Task<ActionResult> ImportResults(int id, [FromForm] IFormFile file, [FromQuery] bool markCompleted = false)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "CSV dosyası yüklenmelidir." });
        }

        var exam = await _context.Exams
            .Include(e => e.Course)
                .ThenInclude(c => c.MebGroup)
            .Include(e => e.ExamResults)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (exam == null)
        {
            return NotFound();
        }

        var entries = new List<ExamResultEntryRequest>();
        using var reader = new StreamReader(file.OpenReadStream());
        string? header = null;
        while (!reader.EndOfStream)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) continue;

            if (header == null)
            {
                header = line;
                if (header.ToLower().Contains("student") || header.ToLower().Contains("tc"))
                {
                    // skip header row
                    continue;
                }
            }

            var values = ParseCsvRow(line);
            if (values.Count < 3)
            {
                continue;
            }

            if (!int.TryParse(values[0], out var studentId))
            {
                continue;
            }

            if (!decimal.TryParse(values[1], NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var score))
            {
                if (!decimal.TryParse(values[1], out score))
                {
                    continue;
                }
            }

            bool? pass = null;
            if (values.Count > 2 && !string.IsNullOrWhiteSpace(values[2]))
            {
                if (bool.TryParse(values[2], out var passBool))
                {
                    pass = passBool;
                }
                else if (values[2].Trim().Equals("geçti", StringComparison.OrdinalIgnoreCase))
                {
                    pass = true;
                }
                else if (values[2].Trim().Equals("kaldı", StringComparison.OrdinalIgnoreCase))
                {
                    pass = false;
                }
            }

            int? attemptNo = null;
            if (values.Count > 3 && int.TryParse(values[3], out var attempt))
            {
                attemptNo = attempt;
            }

            var notes = values.Count > 4 ? values[4] : null;

            entries.Add(new ExamResultEntryRequest
            {
                StudentId = studentId,
                Score = score,
                Pass = pass,
                AttemptNo = attemptNo,
                Notes = notes
            });
        }

        if (entries.Count == 0)
        {
            return BadRequest(new { message = "CSV dosyasında geçerli kayıt bulunamadı." });
        }

        try
        {
            var result = await ApplyExamResultsAsync(exam, entries, markCompleted);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{examId}/results/{resultId}")]
    public async Task<ActionResult> DeleteResult(int examId, int resultId)
    {
        var result = await _context.ExamResults
            .FirstOrDefaultAsync(er => er.Id == resultId && er.ExamId == examId);

        if (result == null)
        {
            return NotFound();
        }

        _context.ExamResults.Remove(result);
        await _context.SaveChangesAsync();

        var exam = await LoadExamWithDetailsAsync(examId);
        return Ok(exam != null ? BuildExamResponse(exam) : null);
    }

    private async Task<GroupExamContext?> LoadGroupExamContextAsync(int groupId)
    {
        var group = await _context.MebGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == groupId);

        if (group == null)
        {
            return null;
        }

        var rawResults = await _context.ExamResults
            .AsNoTracking()
            .Where(er => er.Exam.Course.MebGroupId == groupId)
            .Select(er => new
            {
                er.ExamId,
                er.Exam.ExamDate,
                er.Exam.ExamType,
                er.Exam.CourseId,
                er.Exam.Course.SrcType,
                er.StudentId,
                er.Student.TcKimlikNo,
                er.Student.FirstName,
                er.Student.LastName,
                er.Score,
                er.Pass,
                er.AttemptNo,
                er.Notes
            })
            .ToListAsync();

        var results = rawResults
            .Select(item => new GroupExamResultItemDto
            {
                ExamId = item.ExamId,
                CourseId = item.CourseId,
                CourseName = MebNamingHelper.BuildCourseName(item.SrcType, group),
                ExamType = item.ExamType,
                ExamDate = item.ExamDate,
                StudentId = item.StudentId,
                TcKimlikNo = item.TcKimlikNo,
                FirstName = item.FirstName,
                LastName = item.LastName,
                Score = item.Score,
                Pass = item.Pass,
                AttemptNo = item.AttemptNo,
                Notes = item.Notes
            })
            .OrderBy(item => item.LastName)
            .ThenBy(item => item.FirstName)
            .ThenByDescending(item => item.ExamDate)
            .ToList();

        var totalStudents = await _context.Enrollments
            .AsNoTracking()
            .Where(enrollment => enrollment.Course.MebGroupId == groupId)
            .Select(enrollment => enrollment.StudentId)
            .Distinct()
            .CountAsync();

        var groupInfo = new GroupInfoDto
        {
            Id = group.Id,
            Year = group.Year,
            Month = group.Month,
            GroupNo = group.GroupNo,
            Branch = group.Branch,
            StartDate = group.StartDate,
            EndDate = group.EndDate,
            Name = MebNamingHelper.BuildGroupName(group)
        };

        return new GroupExamContext
        {
            Group = group,
            GroupInfo = groupInfo,
            Results = results,
            TotalStudents = totalStudents
        };
    }

    private static string NormalizeExamType(string? examType)
    {
        return string.IsNullOrWhiteSpace(examType)
            ? string.Empty
            : examType.Trim().ToLowerInvariant();
    }

    private static bool IsWrittenExamType(string? examType)
    {
        var normalized = NormalizeExamType(examType);
        return normalized is "written" or "yazili" or "yazılı";
    }

    private static bool IsPracticalExamType(string? examType)
    {
        var normalized = NormalizeExamType(examType);
        return normalized is "practical" or "uygulama" or "pratik";
    }

    private sealed class GroupExamContext
    {
        public MebGroup Group { get; init; } = null!;
        public GroupInfoDto GroupInfo { get; init; } = new();
        public List<GroupExamResultItemDto> Results { get; init; } = new();
        public int TotalStudents { get; init; }
    }

    private async Task<object> ApplyExamResultsAsync(Exam exam, List<ExamResultEntryRequest> entries, bool markCompleted)
    {
        var studentIds = entries.Select(r => r.StudentId).Distinct().ToList();
        if (studentIds.Count == 0)
        {
            throw new ArgumentException("Geçerli öğrenci bulunamadı.");
        }

        var existingExamResults = exam.ExamResults
            .Where(er => studentIds.Contains(er.StudentId))
            .ToDictionary(er => er.StudentId);

        var courseResults = await _context.ExamResults
            .Include(er => er.Exam)
            .Where(er => studentIds.Contains(er.StudentId) && er.Exam.CourseId == exam.CourseId)
            .Select(er => new { er.StudentId, er.AttemptNo, er.ExamId })
            .ToListAsync();

        var maxAttemptByStudent = courseResults
            .GroupBy(x => x.StudentId)
            .ToDictionary(g => g.Key, g => g.Max(x => x.AttemptNo));

        var studentExists = await _context.Students
            .Where(s => studentIds.Contains(s.Id))
            .Select(s => s.Id)
            .ToListAsync();

        if (studentExists.Count != studentIds.Count)
        {
            var missing = studentIds.Except(studentExists).ToList();
            throw new ArgumentException($"Sistemde olmayan öğrenci ID: {string.Join(", ", missing)}");
        }

        foreach (var entry in entries)
        {
            if (entry.Score < 0 || entry.Score > 100)
            {
                throw new ArgumentException($"Öğrenci {entry.StudentId} için puan 0-100 aralığında olmalıdır.");
            }

            var existingResult = existingExamResults.GetValueOrDefault(entry.StudentId);
            var maxAttempt = maxAttemptByStudent.GetValueOrDefault(entry.StudentId, 0);

            int attemptNo;
            if (entry.AttemptNo.HasValue)
            {
                if (entry.AttemptNo.Value < 1 || entry.AttemptNo.Value > 4)
                {
                    throw new ArgumentException($"Öğrenci {entry.StudentId} için hak numarası 1-4 aralığında olmalıdır.");
                }
                attemptNo = entry.AttemptNo.Value;
            }
            else if (existingResult != null)
            {
                attemptNo = existingResult.AttemptNo;
            }
            else
            {
                attemptNo = maxAttempt + 1;
            }

            if (attemptNo > 4)
            {
                throw new ArgumentException($"Öğrenci {entry.StudentId} için maksimum 4 hak kullanılabilir.");
            }

            var pass = entry.Pass ?? entry.Score >= 70m;

            if (existingResult != null)
            {
                existingResult.Score = entry.Score;
                existingResult.Pass = pass;
                existingResult.AttemptNo = attemptNo;
                existingResult.Notes = entry.Notes;
                existingResult.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var result = new ExamResult
                {
                    ExamId = exam.Id,
                    StudentId = entry.StudentId,
                    Score = entry.Score,
                    Pass = pass,
                    AttemptNo = attemptNo,
                    Notes = entry.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                _context.ExamResults.Add(result);
            }

            if (maxAttempt < attemptNo)
            {
                maxAttemptByStudent[entry.StudentId] = attemptNo;
            }
        }

        if (markCompleted)
        {
            exam.Status = "completed";
        }

        exam.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var refreshed = await LoadExamWithDetailsAsync(exam.Id);
        return BuildExamResponse(refreshed!);
    }

    private async Task<Exam?> LoadExamWithDetailsAsync(int id)
    {
        return await _context.Exams
            .AsNoTracking()
            .Include(e => e.Course)
                .ThenInclude(c => c.MebGroup)
            .Include(e => e.ExamResults)
                .ThenInclude(er => er.Student)
            .FirstOrDefaultAsync(e => e.Id == id);
    }

    private object BuildExamResponse(Exam exam)
    {
        return new
        {
            exam.Id,
            exam.CourseId,
            exam.ExamType,
            exam.ExamDate,
            exam.MebSessionCode,
            exam.Status,
            exam.Notes,
            CourseInfo = new
            {
                exam.Course.Id,
                exam.Course.SrcType,
                GroupInfo = new
                {
                    exam.Course.MebGroup.Year,
                    exam.Course.MebGroup.Month,
                    exam.Course.MebGroup.GroupNo,
                    exam.Course.MebGroup.Branch
                }
            },
            Results = exam.ExamResults
                .OrderBy(er => er.Student.LastName)
                .ThenBy(er => er.Student.FirstName)
                .Select(er => new
                {
                    er.Id,
                    StudentInfo = new
                    {
                        er.Student.Id,
                        er.Student.TcKimlikNo,
                        er.Student.FirstName,
                        er.Student.LastName
                    },
                    er.Score,
                    er.Pass,
                    er.AttemptNo,
                    er.Notes
                }),
            Stats = new
            {
                Total = exam.ExamResults.Count,
                Passed = exam.ExamResults.Count(r => r.Pass),
                Failed = exam.ExamResults.Count(r => !r.Pass),
                AverageScore = exam.ExamResults.Any() ? exam.ExamResults.Average(r => r.Score) : 0m
            },
            exam.CreatedAt,
            exam.UpdatedAt
        };
    }

    private static List<string> ParseCsvRow(string line)
    {
        var delimiter = line.Contains(';') ? ';' : ',';
        var values = new List<string>();
        var current = string.Empty;
        var inQuotes = false;

        foreach (var ch in line)
        {
            if (ch == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }

            if (ch == delimiter && !inQuotes)
            {
                values.Add(current.Trim());
                current = string.Empty;
            }
            else
            {
                current += ch;
            }
        }

        values.Add(current.Trim());
        return values;
    }
}

public class CreateExamRequest
{
    public int CourseId { get; set; }
    public string ExamType { get; set; } = string.Empty;
    public DateTime ExamDate { get; set; }
    public string? MebSessionCode { get; set; }
    public string? Notes { get; set; }
}

public class UpdateExamRequest
{
    public string? ExamType { get; set; }
    public DateTime? ExamDate { get; set; }
    public string? MebSessionCode { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
}

public class SaveExamResultsRequest
{
    public List<ExamResultEntryRequest> Results { get; set; } = new();
    public bool MarkCompleted { get; set; }
}

public class ExamResultEntryRequest
{
    public int StudentId { get; set; }
    public decimal Score { get; set; }
    public bool? Pass { get; set; }
    public int? AttemptNo { get; set; }
    public string? Notes { get; set; }
}

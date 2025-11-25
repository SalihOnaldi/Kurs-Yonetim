using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Student;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;
using System.Linq;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly IStudentService _studentService;
    private readonly SrcDbContext _context;

    public StudentsController(IStudentService studentService, SrcDbContext context)
    {
        _studentService = studentService;
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<StudentListItemDto>>> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? branch,
        [FromQuery] bool? hasActiveCourse)
    {
        var filter = new StudentListFilter
        {
            Search = search,
            Branch = branch,
            HasActiveCourse = hasActiveCourse
        };

        var students = await _studentService.SearchAsync(filter);
        return Ok(students);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentDetailDto>> GetById(int id)
    {
        var student = await _studentService.GetDetailAsync(id);
        if (student == null)
        {
            return NotFound();
        }

        return Ok(student);
    }

    [HttpPost]
    public async Task<ActionResult<StudentDto>> Create([FromBody] CreateStudentRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.TcKimlikNo))
            {
                return BadRequest(new { message = "TC Kimlik No gereklidir" });
            }

            if (string.IsNullOrWhiteSpace(request.FirstName))
            {
                return BadRequest(new { message = "Ad gereklidir" });
            }

            if (string.IsNullOrWhiteSpace(request.LastName))
            {
                return BadRequest(new { message = "Soyad gereklidir" });
            }

            var student = await _studentService.CreateAsync(request);
            return CreatedAtAction(nameof(GetById), new { id = student.Id }, student);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // Log the full exception for debugging
            Serilog.Log.Error(ex, "Error creating student in controller");
            Serilog.Log.Error("Stack trace: {StackTrace}", ex.StackTrace);
            if (ex.InnerException != null)
            {
                Serilog.Log.Error("Inner exception: {InnerException}", ex.InnerException.Message);
            }
            
            var errorMessage = ex.Message;
            if (ex.InnerException != null)
            {
                errorMessage += $" | Inner: {ex.InnerException.Message}";
            }
            
            return StatusCode(500, new { 
                message = $"Kursiyer eklenirken hata oluştu: {errorMessage}",
                type = ex.GetType().Name,
                details = ex.ToString()
            });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StudentDto>> Update(int id, [FromBody] UpdateStudentRequest request)
    {
        var student = await _studentService.UpdateAsync(id, request);
        if (student == null)
        {
            return NotFound();
        }

        return Ok(student);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _studentService.DeleteAsync(id);
        if (!result)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpGet("{id}/documents")]
    public async Task<ActionResult<List<StudentDocumentDto>>> GetDocuments(int id)
    {
        var documents = await _studentService.GetDocumentsAsync(id);
        return Ok(documents);
    }

    [HttpPost("{id}/documents")]
    public async Task<ActionResult<StudentDocumentDto>> UploadDocument(int id, [FromForm] IFormFile file, [FromForm] string documentType)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "File is required" });
        }

        using var stream = file.OpenReadStream();
        var document = await _studentService.UploadDocumentAsync(id, stream, file.FileName, file.ContentType, documentType);
        return Ok(document);
    }

    [HttpGet("{id}/documents/{documentId}/download")]
    public async Task<IActionResult> DownloadDocument(int id, int documentId)
    {
        var result = await _studentService.DownloadDocumentAsync(id, documentId);
        if (result == null)
        {
            return NotFound();
        }

        var (stream, fileName, contentType) = result.Value;
        return File(stream, contentType, fileName);
    }

    [HttpDelete("{id}/documents/{documentId}")]
    public async Task<IActionResult> DeleteDocument(int id, int documentId)
    {
        var deleted = await _studentService.DeleteDocumentAsync(id, documentId);
        if (!deleted)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpGet("ready-for-next-course")]
    public async Task<ActionResult> GetStudentsReadyForNextCourse()
    {
        // Sertifika almış ve bir sonraki kurs için hazır olan öğrencileri bul
        var students = await _context.Students
            .Include(s => s.Certificates)
                .ThenInclude(c => c.MebGroup)
            .Include(s => s.Reminders)
            .Where(s => s.Certificates.Any(c => c.Status == "active") &&
                       s.Reminders.Any(r => r.Type == "next_course_preparation" && r.Status == "pending"))
            .Select(s => new
            {
                s.Id,
                s.TcKimlikNo,
                s.FirstName,
                s.LastName,
                s.Phone,
                s.Email,
                CompletedCourses = s.Certificates
                    .Where(c => c.Status == "active")
                    .Select(c => new
                    {
                        c.MebGroup.SrcType,
                        c.IssueDate
                    })
                    .OrderByDescending(c => c.IssueDate)
                    .ToList(),
                NextCourseReminders = s.Reminders
                    .Where(r => r.Type == "next_course_preparation" && r.Status == "pending")
                    .Select(r => new
                    {
                        r.Id,
                        r.Title,
                        r.Message,
                        r.ScheduledAt
                    })
                    .ToList(),
                SelectedSrcCourses = s.SelectedSrcCourses
            })
            .ToListAsync();

        var result = students.Select(s =>
        {
            var maxCompletedSrc = s.CompletedCourses.Any() 
                ? s.CompletedCourses.Max(c => c.SrcType) 
                : 0;
            
            var selectedSrcTypes = !string.IsNullOrWhiteSpace(s.SelectedSrcCourses)
                ? s.SelectedSrcCourses.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => int.TryParse(x.Trim(), out var num) ? num : (int?)null)
                    .Where(n => n.HasValue)
                    .Select(n => n!.Value)
                    .ToList()
                : new List<int>();

            var nextSrcType = maxCompletedSrc + 1;
            var isReadyForNext = selectedSrcTypes.Contains(nextSrcType);

            return new
            {
                s.Id,
                s.TcKimlikNo,
                s.FirstName,
                s.LastName,
                s.Phone,
                s.Email,
                MaxCompletedSrcType = maxCompletedSrc,
                NextExpectedSrcType = nextSrcType,
                IsReadyForNext = isReadyForNext,
                SelectedSrcCourses = selectedSrcTypes,
                NextCourseReminders = s.NextCourseReminders
            };
        })
        .Where(s => s.IsReadyForNext)
        .ToList();

        return Ok(result);
    }
}


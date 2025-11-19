using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.DTOs.Student;
using SRC.Application.Interfaces;
using System.Linq;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly IStudentService _studentService;

    public StudentsController(IStudentService studentService)
    {
        _studentService = studentService;
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
}


using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.DTOs.Instructor;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InstructorsController : ControllerBase
{
    private readonly IInstructorService _instructorService;

    public InstructorsController(IInstructorService instructorService)
    {
        _instructorService = instructorService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InstructorSummaryDto>>> GetInstructors([FromQuery] string? search, [FromQuery] bool includeInactive = false)
    {
        var instructors = await _instructorService.GetInstructorsAsync(search, includeInactive);
        return Ok(instructors);
    }

    [HttpPost]
    [Authorize(Roles = "Admin,EgitimYoneticisi")]
    public async Task<ActionResult<InstructorSummaryDto>> CreateInstructor([FromBody] CreateInstructorRequest request)
    {
        try
        {
            var instructor = await _instructorService.CreateInstructorAsync(request);
            return CreatedAtAction(nameof(GetInstructors), new { id = instructor.Id }, instructor);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }
}


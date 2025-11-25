using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.DTOs.SrcCourseTemplate;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/src-course-templates")]
[Authorize]
public class SrcCourseTemplatesController : ControllerBase
{
    private readonly ISrcCourseTemplateService _templateService;

    public SrcCourseTemplatesController(ISrcCourseTemplateService templateService)
    {
        _templateService = templateService;
    }

    [HttpGet("src-type/{srcType}")]
    public async Task<ActionResult> GetTemplatesBySrcType(int srcType, [FromQuery] string? mixedTypes = null)
    {
        var templates = await _templateService.GetTemplatesBySrcTypeAsync(srcType, mixedTypes);
        return Ok(templates);
    }

    [HttpPost]
    public async Task<ActionResult> CreateTemplate([FromBody] CreateSrcCourseTemplateDto dto)
    {
        try
        {
            var template = await _templateService.CreateTemplateAsync(dto);
            return CreatedAtAction(nameof(GetTemplatesBySrcType), new { srcType = template.SrcType }, template);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTemplate(int id, [FromBody] UpdateSrcCourseTemplateDto dto)
    {
        try
        {
            var template = await _templateService.UpdateTemplateAsync(id, dto);
            return Ok(template);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTemplate(int id)
    {
        var result = await _templateService.DeleteTemplateAsync(id);
        if (!result)
        {
            return NotFound();
        }

        return NoContent();
    }

    [HttpPost("generate-schedule")]
    public async Task<ActionResult> GenerateSchedule([FromBody] GenerateScheduleRequest request)
    {
        try
        {
            var schedule = await _templateService.GenerateScheduleFromTemplateAsync(
                request.MebGroupId,
                request.StartDate);

            return Ok(schedule);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("import-excel")]
    public async Task<ActionResult> ImportFromExcel([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Excel dosyası yüklenmelidir." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _templateService.ImportFromExcelAsync(stream);
            return Ok(new { success = result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

public class GenerateScheduleRequest
{
    public int MebGroupId { get; set; }
    public DateTime StartDate { get; set; }
}


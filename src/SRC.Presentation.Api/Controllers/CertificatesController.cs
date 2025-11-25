using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/certificates")]
[Authorize]
public class CertificatesController : ControllerBase
{
    private readonly ICertificateService _certificateService;

    public CertificatesController(ICertificateService certificateService)
    {
        _certificateService = certificateService;
    }

    [HttpPost("generate")]
    public async Task<ActionResult> GenerateCertificate([FromBody] GenerateCertificateRequest request)
    {
        try
        {
            var certificate = await _certificateService.GenerateCertificateAsync(
                request.StudentId,
                request.MebGroupId,
                request.WrittenExamId,
                request.PracticalExamId);

            return Ok(certificate);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetCertificate(int id)
    {
        var certificate = await _certificateService.GetCertificateAsync(id);
        if (certificate == null)
        {
            return NotFound();
        }

        return Ok(certificate);
    }

    [HttpGet("student/{studentId}")]
    public async Task<ActionResult> GetCertificatesByStudent(int studentId)
    {
        var certificates = await _certificateService.GetCertificatesByStudentAsync(studentId);
        return Ok(certificates);
    }

    [HttpGet("group/{mebGroupId}")]
    public async Task<ActionResult> GetCertificatesByMebGroup(int mebGroupId)
    {
        var certificates = await _certificateService.GetCertificatesByMebGroupAsync(mebGroupId);
        return Ok(certificates);
    }

    [HttpGet("{id}/report")]
    public async Task<ActionResult> GetCertificateReport(int id)
    {
        try
        {
            var report = await _certificateService.GenerateCertificateReportAsync(id);
            return Ok(report);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}

public class GenerateCertificateRequest
{
    public int StudentId { get; set; }
    public int MebGroupId { get; set; }
    public int WrittenExamId { get; set; }
    public int PracticalExamId { get; set; }
}


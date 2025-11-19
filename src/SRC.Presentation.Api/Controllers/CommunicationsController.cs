using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommunicationsController : ControllerBase
{
    private readonly ICommunicationService _communicationService;
    private readonly SrcDbContext _context;

    public CommunicationsController(ICommunicationService communicationService, SrcDbContext context)
    {
        _communicationService = communicationService;
        _context = context;
    }

    [HttpPost("sms")]
    public async Task<IActionResult> SendSms([FromBody] SendSmsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Recipient))
        {
            return BadRequest(new { message = "Telefon numarası gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { message = "SMS mesaj içeriği gereklidir." });
        }

        await _communicationService.SendSmsAsync(request.Recipient, request.Message);
        return Ok(new { message = "SMS gönderildi." });
    }

    [HttpPost("sms/bulk")]
    public async Task<IActionResult> SendBulkSms([FromBody] SendBulkSmsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { message = "SMS mesaj içeriği gereklidir." });
        }

        var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (request.Recipients != null)
        {
            foreach (var entry in request.Recipients)
            {
                var trimmed = entry?.Trim();
                if (!string.IsNullOrEmpty(trimmed))
                {
                    recipients.Add(trimmed);
                }
            }
        }

        if (request.SendToAll)
        {
            var phones = await _context.Students
                .AsNoTracking()
                .Select(s => s.Phone)
                .Where(phone => phone != null && phone != "")
                .ToListAsync();

            foreach (var phone in phones)
            {
                if (!string.IsNullOrWhiteSpace(phone))
                {
                    recipients.Add(phone.Trim());
                }
            }
        }

        if (recipients.Count == 0)
        {
            return BadRequest(new { message = "Gönderilecek telefon numarası bulunamadı." });
        }

        foreach (var recipient in recipients)
        {
            await _communicationService.SendSmsAsync(recipient, request.Message);
        }

        return Ok(new { message = "SMS gönderildi.", recipientCount = recipients.Count });
    }

    [HttpPost("email")]
    public async Task<IActionResult> SendEmail([FromBody] SendEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Recipient))
        {
            return BadRequest(new { message = "E-posta adresi gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            return BadRequest(new { message = "E-posta konusu gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return BadRequest(new { message = "E-posta içeriği gereklidir." });
        }

        await _communicationService.SendEmailAsync(request.Recipient, request.Subject, request.Body);
        return Ok(new { message = "E-posta gönderildi." });
    }

    [HttpPost("email/bulk")]
    public async Task<IActionResult> SendBulkEmail([FromBody] SendBulkEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject))
        {
            return BadRequest(new { message = "E-posta konusu gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.Body))
        {
            return BadRequest(new { message = "E-posta içeriği gereklidir." });
        }

        var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (request.Recipients != null)
        {
            foreach (var entry in request.Recipients)
            {
                var trimmed = entry?.Trim();
                if (!string.IsNullOrEmpty(trimmed))
                {
                    recipients.Add(trimmed);
                }
            }
        }

        if (request.SendToAll)
        {
            var emails = await _context.Students
                .AsNoTracking()
                .Select(s => s.Email)
                .Where(email => email != null && email != "")
                .ToListAsync();

            foreach (var email in emails)
            {
                if (!string.IsNullOrWhiteSpace(email))
                {
                    recipients.Add(email.Trim());
                }
            }
        }

        if (recipients.Count == 0)
        {
            return BadRequest(new { message = "Gönderilecek e-posta adresi bulunamadı." });
        }

        foreach (var recipient in recipients)
        {
            await _communicationService.SendEmailAsync(recipient, request.Subject, request.Body);
        }

        return Ok(new { message = "E-postalar gönderildi.", recipientCount = recipients.Count });
    }
}

public class SendSmsRequest
{
    public string Recipient { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class SendBulkSmsRequest
{
    public bool SendToAll { get; set; }
    public List<string>? Recipients { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class SendEmailRequest
{
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}

public class SendBulkEmailRequest
{
    public bool SendToAll { get; set; }
    public List<string>? Recipients { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
}



using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult> GetNotifications(
        [FromQuery] string? category,
        [FromQuery] string? severity,
        [FromQuery] int limit = 20)
    {
        var items = await _notificationService.GetNotificationsAsync(category, severity, limit);
        return Ok(items);
    }

    [HttpGet("summary")]
    public async Task<ActionResult> GetSummary()
    {
        var summary = await _notificationService.GetSummaryAsync();
        return Ok(summary);
    }
}


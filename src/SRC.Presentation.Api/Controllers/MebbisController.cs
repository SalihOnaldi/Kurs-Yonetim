using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.Interfaces.Mebbis;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/mebbis")]
[Authorize]
public class MebbisController : ControllerBase
{
    private readonly IMebbisClient _client;
    private readonly SrcDbContext _context;

    public MebbisController(IMebbisClient client, SrcDbContext context)
    {
        _client = client;
        _context = context;
    }

    [HttpPost("courses/{courseId:int}/push")]
    public async Task<ActionResult> PushCourse(int courseId, CancellationToken cancellationToken)
    {
        var result = await _client.SendCourseAsync(courseId, cancellationToken);
        await AddLogAsync("course", courseId, "push", result, cancellationToken);
        return Ok(result);
    }

    [HttpPost("enrollments/{enrollmentId:int}/push")]
    public async Task<ActionResult> PushEnrollment(int enrollmentId, CancellationToken cancellationToken)
    {
        var result = await _client.SendEnrollmentAsync(enrollmentId, cancellationToken);
        await AddLogAsync("enrollment", enrollmentId, "push", result, cancellationToken);
        return Ok(result);
    }

    [HttpPost("documents/{documentId:int}/approve")]
    public async Task<ActionResult> ApproveDocument(int documentId, CancellationToken cancellationToken)
    {
        var result = await _client.ApproveDocumentAsync(documentId, cancellationToken);
        await AddLogAsync("document", documentId, "approve", result, cancellationToken);
        return Ok(result);
    }

    [HttpGet("logs")]
    public async Task<ActionResult<IEnumerable<MebbisSyncLog>>> GetLogs(
        [FromQuery] string? entityType,
        [FromQuery] int take = 100,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 500);

        var query = _context.MebbisSyncLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(entityType))
        {
            query = query.Where(log => log.EntityType == entityType);
        }

        var list = await query
            .OrderByDescending(log => log.CreatedAt)
            .Take(take)
            .ToListAsync(cancellationToken);
        return Ok(list);
    }

    private async Task AddLogAsync(string entityType, int entityId, string action, MebbisClientResult result, CancellationToken cancellationToken)
    {
        var log = new MebbisSyncLog
        {
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            Status = result.Success ? "success" : "failed",
            Payload = result.Payload,
            Response = result.Message,
            Error = result.Success ? null : result.Message,
            CreatedAt = DateTime.UtcNow
        };

        _context.MebbisSyncLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);
    }
}



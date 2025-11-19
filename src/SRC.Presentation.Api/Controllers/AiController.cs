using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly IAiService _aiService;
    private readonly IMemoryCache _cache;

    public AiController(IAiService aiService, IMemoryCache cache)
    {
        _aiService = aiService;
        _cache = cache;
    }

    [HttpPost("ask")]
    public async Task<ActionResult<AiAnswerDto>> Ask([FromBody] AiAskRequest request, CancellationToken cancellationToken)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Question))
        {
            return BadRequest(new { message = "Bir soru sağlamanız gerekir." });
        }

        var response = await _aiService.AskAsync(request, cancellationToken);

        if (!string.IsNullOrWhiteSpace(request.Question))
        {
            var normalized = request.Question.Trim().ToLowerInvariant();
            var cacheKey = $"ai:ask:{normalized}";
            _cache.Set(cacheKey, response, new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = System.TimeSpan.FromMinutes(2),
                SlidingExpiration = System.TimeSpan.FromMinutes(1)
            });
        }

        return Ok(response);
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<AiQueryDto>>> History([FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        take = take <= 0 ? 20 : take;
        var cacheKey = $"ai:history:{take}";

        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<AiQueryDto>? cached))
        {
            return Ok(cached);
        }

        var items = await _aiService.GetRecentQueriesAsync(take, cancellationToken);

        _cache.Set(cacheKey, items, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = System.TimeSpan.FromMinutes(1),
            SlidingExpiration = System.TimeSpan.FromSeconds(30)
        });

        return Ok(items);
    }

    [HttpGet("weekly-digest")]
    public async Task<ActionResult<WeeklyDigestDto>> WeeklyDigest(CancellationToken cancellationToken = default)
    {
        const string cacheKey = "ai:weekly-digest";

        if (_cache.TryGetValue(cacheKey, out WeeklyDigestDto? cached))
        {
            return Ok(cached);
        }

        var digest = await _aiService.GetWeeklyDigestAsync(cancellationToken);

        _cache.Set(cacheKey, digest, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = System.TimeSpan.FromMinutes(5),
            SlidingExpiration = System.TimeSpan.FromMinutes(2)
        });

        return Ok(digest);
    }
}



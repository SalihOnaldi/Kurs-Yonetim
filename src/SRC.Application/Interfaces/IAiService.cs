using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces;

public interface IAiService
{
    Task<AiAnswerDto> AskAsync(AiAskRequest request, CancellationToken cancellationToken = default);
    Task<WeeklyDigestDto> GetWeeklyDigestAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AiQueryDto>> GetRecentQueriesAsync(int take = 20, CancellationToken cancellationToken = default);
}

public class AiAskRequest
{
    public string Question { get; set; } = string.Empty;
    public string? Context { get; set; }
}

public class AiAnswerDto
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? Source { get; set; }
}

public class AiQueryDto
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class WeeklyDigestDto
{
    public DateTime GeneratedAt { get; set; }
    public IReadOnlyList<WeeklyDigestSectionDto> Sections { get; set; } = Array.Empty<WeeklyDigestSectionDto>();
}

public class WeeklyDigestSectionDto
{
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Icon { get; set; } = "🧠";
    public IReadOnlyList<string> Highlights { get; set; } = Array.Empty<string>();
}



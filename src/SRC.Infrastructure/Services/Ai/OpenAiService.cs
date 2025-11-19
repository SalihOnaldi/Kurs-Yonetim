using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using Microsoft.Extensions.Caching.Memory;

namespace SRC.Infrastructure.Services.Ai;

public class OpenAiService : IAiService
{
    private readonly SrcDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OpenAiService> _logger;
    private readonly IMemoryCache _cache;

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public OpenAiService(
        SrcDbContext context,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<OpenAiService> logger,
        IMemoryCache cache)
    {
        _context = context;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _cache = cache;
    }

    public async Task<AiAnswerDto> AskAsync(AiAskRequest request, CancellationToken cancellationToken = default)
    {
        if (request is null) throw new ArgumentNullException(nameof(request));
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            throw new ArgumentException("Soru alanı boş olamaz.", nameof(request.Question));
        }

        var trimmedQuestion = request.Question.Trim();
        var provider = (_configuration["AI_PROVIDER"] ?? "mock").Trim().ToLowerInvariant();

        string answer;
        string? source = null;

        if (provider == "openai")
        {
            answer = await ExecuteOpenAiRequestAsync(trimmedQuestion, request.Context, cancellationToken)
                .ConfigureAwait(false);
            if (string.IsNullOrWhiteSpace(answer))
            {
                provider = "mock";
                answer = await BuildMockAnswerAsync(trimmedQuestion, cancellationToken).ConfigureAwait(false);
            }
            else
            {
                source = "openai";
            }
        }
        else
        {
            provider = "mock";
            answer = await BuildMockAnswerAsync(trimmedQuestion, cancellationToken).ConfigureAwait(false);
        }

        var entity = new AiQuery
        {
            Question = trimmedQuestion,
            Answer = answer,
            Provider = provider,
            Metadata = string.IsNullOrWhiteSpace(request.Context) ? null : request.Context.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _context.AiQueries.Add(entity);
        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        return new AiAnswerDto
        {
            Id = entity.Id,
            Question = entity.Question,
            Answer = entity.Answer,
            Provider = entity.Provider,
            CreatedAt = entity.CreatedAt,
            Source = source
        };
    }

    public async Task<WeeklyDigestDto> GetWeeklyDigestAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var withinWeek = now.AddDays(7);
        var lastWeek = now.AddDays(-7);

        var upcomingGroups = await _context.MebGroups
            .AsNoTracking()
            .Where(group => group.StartDate >= now && group.StartDate <= withinWeek)
            .OrderBy(group => group.StartDate)
            .Select(group => new
            {
                group.Year,
                group.Month,
                group.GroupNo,
                group.Branch,
                group.StartDate,
                group.EndDate,
                ActiveCourseCount = group.Courses.Count(course => course.MebApprovalStatus != "rejected")
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var pendingTransfers = await _context.MebbisTransferJobs
            .AsNoTracking()
            .Where(job => job.Status == "failed" || job.Status == "pending")
            .OrderByDescending(job => job.CreatedAt)
            .Take(5)
            .Select(job => new
            {
                job.Id,
                job.Mode,
                job.Status,
                job.CreatedAt,
                Course = new
                {
                    job.Course.SrcType,
                    job.Course.MebGroup.Year,
                    job.Course.MebGroup.Month,
                    job.Course.MebGroup.GroupNo,
                    job.Course.MebGroup.Branch
                }
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var overduePayments = await _context.Payments
            .AsNoTracking()
            .Where(payment => payment.Status == "pending" && payment.DueDate <= withinWeek)
            .OrderBy(payment => payment.DueDate)
            .Take(5)
            .Select(payment => new
            {
                payment.Id,
                payment.Amount,
                payment.DueDate,
                payment.PaymentType,
                payment.Student.FirstName,
                payment.Student.LastName,
                payment.Student.TcKimlikNo
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var attendanceAlerts = await _context.ScheduleSlots
            .AsNoTracking()
            .Where(slot => slot.StartTime >= lastWeek && slot.StartTime <= now)
            .Select(slot => new
            {
                slot.Id,
                slot.Subject,
                slot.StartTime,
                slot.Course.SrcType,
                slot.Course.MebGroup.Year,
                slot.Course.MebGroup.Month,
                slot.Course.MebGroup.GroupNo,
                slot.Course.MebGroup.Branch,
                Present = slot.Attendances.Count(att => att.IsPresent),
                Total = slot.Attendances.Count()
            })
            .Where(slot => slot.Total > 0 && slot.Present < slot.Total * 0.75)
            .OrderBy(slot => slot.StartTime)
            .Take(5)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var totalStudentCount = await _context.Students.LongCountAsync(cancellationToken).ConfigureAwait(false);
        var activeCourseCount = await _context.Courses
            .AsNoTracking()
            .CountAsync(course => course.MebApprovalStatus == "approved" || course.MebApprovalStatus == "pending", cancellationToken)
            .ConfigureAwait(false);

        var sections = new List<WeeklyDigestSectionDto>
        {
            new()
            {
                Title = "Genel Durum Özeti",
                Icon = "📊",
                Description = "Sistemdeki temel metriklerin hızlı özeti.",
                Highlights = new[]
                {
                    $"Toplam kursiyer sayısı: {totalStudentCount:N0}",
                    $"Aktif/pending kurs sayısı: {activeCourseCount:N0}",
                    $"Son 7 günde düşük yoklama tespit edilen ders sayısı: {attendanceAlerts.Count}",
                    $"Önümüzdeki hafta başlayacak sınıf sayısı: {upcomingGroups.Count}"
                }
            }
        };

        if (upcomingGroups.Count > 0)
        {
            sections.Add(new WeeklyDigestSectionDto
            {
                Title = "Yaklaşan Kurs Başlangıçları",
                Icon = "📅",
                Description = "Önümüzdeki 7 gün içerisinde başlayacak sınıflar.",
                Highlights = upcomingGroups.Select(group =>
                    $"{group.StartDate:dd.MM.yyyy} • {group.Year}-{group.Month:00} GRUP {group.GroupNo}{(string.IsNullOrWhiteSpace(group.Branch) ? "" : $" ({group.Branch})")} • {group.ActiveCourseCount} kurs").ToList()
            });
        }

        if (pendingTransfers.Count > 0)
        {
            sections.Add(new WeeklyDigestSectionDto
            {
                Title = "MEBBİS Aktarım Takibi",
                Icon = "🛰️",
                Description = "Kontrol edilmesi önerilen MEBBİS aktarım işleri.",
                Highlights = pendingTransfers.Select(job =>
                    $"#{job.Id} • {job.Mode.ToUpperInvariant()} • {job.Status.ToUpperInvariant()} • SRC{job.Course.SrcType} {job.Course.Year}-{job.Course.Month:00} GRUP {job.Course.GroupNo}{(string.IsNullOrWhiteSpace(job.Course.Branch) ? "" : $" ({job.Course.Branch})")} • {job.CreatedAt:dd.MM HH:mm}").ToList()
            });
        }

        if (overduePayments.Count > 0)
        {
            sections.Add(new WeeklyDigestSectionDto
            {
                Title = "Yaklaşan / Geciken Ödemeler",
                Icon = "💳",
                Description = "Önümüzdeki 7 gün içerisinde tahsil edilmesi gereken ödemeler.",
                Highlights = overduePayments.Select(payment =>
                    $"{payment.DueDate:dd.MM.yyyy} • {payment.FirstName} {payment.LastName} • {payment.Amount:C2} ({payment.PaymentType})").ToList()
            });
        }

        if (attendanceAlerts.Count > 0)
        {
            sections.Add(new WeeklyDigestSectionDto
            {
                Title = "Yoklama Uyarıları",
                Icon = "⚠️",
                Description = "Son 7 günde yoklama oranı düşük kalan dersler.",
                Highlights = attendanceAlerts.Select(slot =>
                {
                    var ratio = slot.Total == 0 ? 0 : (double)slot.Present / slot.Total;
                    return $"{slot.StartTime:dd.MM.yyyy HH:mm} • {slot.Subject ?? "Ders"} • SRC{slot.SrcType} {slot.Year}-{slot.Month:00} GRUP {slot.GroupNo}{(string.IsNullOrWhiteSpace(slot.Branch) ? "" : $" ({slot.Branch})")} • Katılım {slot.Present}/{slot.Total} ({ratio:P0})";
                }).ToList()
            });
        }

        var digest = new WeeklyDigestDto
        {
            GeneratedAt = now,
            Sections = sections
        };

        _cache.Set("ai:weekly-digest", digest, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
            SlidingExpiration = TimeSpan.FromMinutes(2)
        });

        return digest;
    }

    public async Task<IReadOnlyList<AiQueryDto>> GetRecentQueriesAsync(int take = 20, CancellationToken cancellationToken = default)
    {
        if (take <= 0) take = 20;
        take = Math.Clamp(take, 1, 100);
        var cacheKey = $"ai:history:{take}";
        if (_cache.TryGetValue(cacheKey, out IReadOnlyList<AiQueryDto>? cached) && cached is not null)
        {
            return cached;
        }

        var items = await _context.AiQueries
            .AsNoTracking()
            .OrderByDescending(query => query.CreatedAt)
            .Take(take)
            .Select(query => new AiQueryDto
            {
                Id = query.Id,
                Question = query.Question,
                Answer = query.Answer,
                Provider = query.Provider,
                CreatedAt = query.CreatedAt
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        _cache.Set(cacheKey, items, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1),
            SlidingExpiration = TimeSpan.FromSeconds(30)
        });

        return items;
    }

    private async Task<string> ExecuteOpenAiRequestAsync(string question, string? context, CancellationToken cancellationToken)
    {
        try
        {
            var apiKey = _configuration["OPENAI_API_KEY"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                _logger.LogWarning("OPENAI_API_KEY is not configured. Falling back to mock responses.");
                return string.Empty;
            }

            var client = _httpClientFactory.CreateClient("openai");
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            var systemPrompt = _configuration["AI_SYSTEM_PROMPT"] ??
                "You are an assistant that helps manage SRC courses, schedules, and compliance tasks in Turkish. Provide concise, actionable guidance.";

            var payload = new
            {
                model = _configuration["OPENAI_MODEL"] ?? "gpt-3.5-turbo",
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = BuildUserPrompt(question, context) }
                },
                temperature = 0.2
            };

            using var content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");
            using var response = await client.PostAsync("v1/chat/completions", content, cancellationToken).ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogWarning("OpenAI response failed with {Status}. Body: {Body}", response.StatusCode, body);
                return string.Empty;
            }

            using var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
            using var json = await JsonDocument.ParseAsync(responseStream, cancellationToken: cancellationToken).ConfigureAwait(false);
            var choices = json.RootElement.GetProperty("choices");
            if (choices.GetArrayLength() == 0)
            {
                return string.Empty;
            }

            var contentValue = choices[0].GetProperty("message").GetProperty("content").GetString();
            return contentValue?.Trim() ?? string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to call OpenAI service. Falling back to mock provider.");
            return string.Empty;
        }
    }

    private async Task<string> BuildMockAnswerAsync(string question, CancellationToken cancellationToken)
    {
        var digest = await GetWeeklyDigestAsync(cancellationToken).ConfigureAwait(false);
        var highlights = digest.Sections.SelectMany(section => section.Highlights).Take(4).ToList();

        var sb = new StringBuilder();
        sb.AppendLine("Bu soruyu mevcut sistem verilerini inceleyerek değerlendirdim.");
        sb.AppendLine();
        sb.AppendLine($"• Soru: \"{question}\"");
        if (highlights.Count > 0)
        {
            sb.AppendLine("• Öne çıkan bulgular:");
            foreach (var highlight in highlights)
            {
                sb.AppendLine($"  - {highlight}");
            }
        }
        else
        {
            sb.AppendLine("• Şu anda paylaşılabilecek ek bir bulgu bulunmuyor, veriler güncel görünüyor.");
        }
        sb.AppendLine();
        sb.AppendLine("Daha ayrıntılı bir değerlendirme için ders programı, yoklama veya MEBBİS aktarım ekranlarını kontrol edebilirsiniz.");
        return sb.ToString();
    }

    private static string BuildUserPrompt(string question, string? context)
    {
        if (string.IsNullOrWhiteSpace(context))
        {
            return question;
        }

        var builder = new StringBuilder();
        builder.AppendLine("Kullanıcı sorusu aşağıdadır.");
        builder.AppendLine();
        builder.AppendLine($"Soru: {question}");
        builder.AppendLine();
        builder.AppendLine("Ek bağlam:");
        builder.AppendLine(context);
        return builder.ToString();
    }
}



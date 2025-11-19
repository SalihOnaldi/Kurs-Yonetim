using System;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces.Mebbis;

namespace SRC.Infrastructure.Services.Mebbis;

public class FakeMebbisClient : IMebbisClient
{
    private readonly ILogger<FakeMebbisClient> _logger;
    private static readonly TimeSpan SimulatedDelay = TimeSpan.FromMilliseconds(300);

    public FakeMebbisClient(ILogger<FakeMebbisClient> logger)
    {
        _logger = logger;
    }

    public async Task<MebbisClientResult> SendCourseAsync(int courseId, CancellationToken cancellationToken = default)
    {
        await SimulateAsync("course", courseId, cancellationToken);
        return BuildResult("Kurs aktarımı başarıyla tamamlandı.", new { courseId });
    }

    public async Task<MebbisClientResult> SendEnrollmentAsync(int enrollmentId, CancellationToken cancellationToken = default)
    {
        await SimulateAsync("enrollment", enrollmentId, cancellationToken);
        return BuildResult("Öğrenci aktarımı başarıyla tamamlandı.", new { enrollmentId });
    }

    public async Task<MebbisClientResult> ApproveDocumentAsync(int documentId, CancellationToken cancellationToken = default)
    {
        await SimulateAsync("document", documentId, cancellationToken);
        return BuildResult("Belge onayı başarıyla gerçekleştirildi.", new { documentId });
    }

    private async Task SimulateAsync(string entity, int id, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Simulating MEBBIS call for {Entity} #{Id}", entity, id);
        await Task.Delay(SimulatedDelay, cancellationToken);
    }

    private static MebbisClientResult BuildResult(string message, object payload)
    {
        return new MebbisClientResult
        {
            Success = true,
            Message = message,
            ExternalId = $"SIM-{Guid.NewGuid():N}",
            Payload = JsonSerializer.Serialize(payload)
        };
    }
}



using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces;

namespace SRC.Infrastructure.Services.Attendance;

public class MockFaceService : IFaceService
{
    private readonly ILogger<MockFaceService> _logger;

    public MockFaceService(ILogger<MockFaceService> logger)
    {
        _logger = logger;
    }

    public Task<bool> VerifyAsync(string? faceProfileId, Stream imageStream, CancellationToken cancellationToken = default)
    {
        _ = imageStream ?? throw new ArgumentNullException(nameof(imageStream));
        _logger.LogInformation("Mock face verification executed for profile {ProfileId}", faceProfileId ?? "<new>");
        return Task.FromResult(true);
    }

    public Task<string> EnrollAsync(Stream imageStream, CancellationToken cancellationToken = default)
    {
        _ = imageStream ?? throw new ArgumentNullException(nameof(imageStream));
        var profileId = $"mock_{Guid.NewGuid():N}";
        _logger.LogInformation("Mock face enrollment generated profile id {ProfileId}", profileId);
        return Task.FromResult(profileId);
    }
}



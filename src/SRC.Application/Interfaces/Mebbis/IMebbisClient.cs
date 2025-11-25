using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces.Mebbis;

public interface IMebbisClient
{
    Task<MebbisClientResult> SendCourseAsync(int mebGroupId, CancellationToken cancellationToken = default);
    Task<MebbisClientResult> SendEnrollmentAsync(int enrollmentId, CancellationToken cancellationToken = default);
    Task<MebbisClientResult> ApproveDocumentAsync(int documentId, CancellationToken cancellationToken = default);
}

public class MebbisClientResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public string? Payload { get; set; }
}



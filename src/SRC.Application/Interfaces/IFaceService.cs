using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces;

public interface IFaceService
{
    Task<bool> VerifyAsync(string? faceProfileId, Stream imageStream, CancellationToken cancellationToken = default);
    Task<string> EnrollAsync(Stream imageStream, CancellationToken cancellationToken = default);
}



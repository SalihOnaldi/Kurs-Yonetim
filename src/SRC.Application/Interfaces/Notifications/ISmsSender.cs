using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces.Notifications;

public interface ISmsSender
{
    Task SendAsync(string to, string message, CancellationToken cancellationToken = default);
}



using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces.Notifications;

public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}



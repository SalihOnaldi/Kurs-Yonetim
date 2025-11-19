using System.Threading;
using System.Threading.Tasks;

namespace SRC.Application.Interfaces;

public interface ICommunicationService
{
    Task SendSmsAsync(string to, string message, CancellationToken cancellationToken = default);
    Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}



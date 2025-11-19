using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces;

namespace SRC.Infrastructure.Services;

public class CommunicationService : ICommunicationService
{
    private readonly ILogger<CommunicationService> _logger;

    public CommunicationService(ILogger<CommunicationService> logger)
    {
        _logger = logger;
    }

    public Task SendSmsAsync(string to, string message, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("SMS target number is empty. Message discarded.");
            return Task.CompletedTask;
        }

        _logger.LogInformation("Sending SMS to {Recipient}: {Message}", to, message);
        return Task.CompletedTask;
    }

    public Task SendEmailAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(to))
        {
            _logger.LogWarning("Email target address is empty. Subject: {Subject}", subject);
            return Task.CompletedTask;
        }

        _logger.LogInformation("Sending Email to {Recipient}. Subject: {Subject}. Body length: {Length}", to, subject, body?.Length ?? 0);
        return Task.CompletedTask;
    }
}



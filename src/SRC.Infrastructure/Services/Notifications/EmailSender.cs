using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Notifications;

namespace SRC.Infrastructure.Services.Notifications;

public class EmailSender : IEmailSender
{
    private readonly ICommunicationService _communicationService;
    private readonly ILogger<EmailSender> _logger;

    public EmailSender(ICommunicationService communicationService, ILogger<EmailSender> logger)
    {
        _communicationService = communicationService;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        try
        {
            await _communicationService.SendEmailAsync(to, subject, body, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Email gönderimi başarısız oldu. Alıcı: {Recipient}", to);
            throw;
        }
    }
}

public class SmsSender : ISmsSender
{
    private readonly ICommunicationService _communicationService;
    private readonly ILogger<SmsSender> _logger;

    public SmsSender(ICommunicationService communicationService, ILogger<SmsSender> logger)
    {
        _communicationService = communicationService;
        _logger = logger;
    }

    public async Task SendAsync(string to, string message, CancellationToken cancellationToken = default)
    {
        try
        {
            await _communicationService.SendSmsAsync(to, message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMS gönderimi başarısız oldu. Alıcı: {Recipient}", to);
            throw;
        }
    }
}



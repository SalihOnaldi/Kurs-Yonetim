using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SRC.Application.Interfaces;
using SRC.Application.Options;

namespace SRC.Infrastructure.Services;

public class LicenseEventPublisher : ILicenseEventPublisher
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly LicenseWebhookOptions _options;
    private readonly ILogger<LicenseEventPublisher> _logger;

    public LicenseEventPublisher(
        IHttpClientFactory httpClientFactory,
        IOptions<LicenseWebhookOptions> options,
        ILogger<LicenseEventPublisher> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task PublishAsync(string eventType, object payload, CancellationToken cancellationToken = default)
    {
        if (!_options.Enabled)
        {
            return;
        }

        var envelope = new
        {
            source = _options.Source,
            eventType,
            timestamp = DateTime.UtcNow,
            payload
        };

        var tasks = new List<Task>();

        if (!string.IsNullOrWhiteSpace(_options.WebhookUrl))
        {
            tasks.Add(SendJsonAsync(_options.WebhookUrl!, envelope, cancellationToken));
        }

        if (!string.IsNullOrWhiteSpace(_options.SlackWebhookUrl))
        {
            tasks.Add(SendSlackAsync(_options.SlackWebhookUrl!, eventType, payload, cancellationToken));
        }

        if (tasks.Count == 0)
        {
            return;
        }

        try
        {
            await Task.WhenAll(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "License event publish failed for {EventType}", eventType);
        }
    }

    private async Task SendJsonAsync(string url, object envelope, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(nameof(LicenseEventPublisher));
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 3, 30));

        var json = JsonSerializer.Serialize(envelope);
        using var content = new StringContent(json, Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(url, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Webhook request to {Url} failed with status {Status}", url, response.StatusCode);
        }
    }

    private async Task SendSlackAsync(string url, string eventType, object payload, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient(nameof(LicenseEventPublisher));
        client.Timeout = TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 3, 30));

        var text = $"*{eventType}* event received at {DateTime.UtcNow:HH:mm:ss} UTC.\n```{JsonSerializer.Serialize(payload)}```";
        var body = JsonSerializer.Serialize(new { text });
        using var content = new StringContent(body, Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(url, content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Slack webhook failed for event {EventType} with status {Status}", eventType, response.StatusCode);
        }
    }
}



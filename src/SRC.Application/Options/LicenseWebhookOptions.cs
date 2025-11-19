namespace SRC.Application.Options;

public class LicenseWebhookOptions
{
    public bool Enabled { get; set; } = false;
    public string? WebhookUrl { get; set; }
    public string? SlackWebhookUrl { get; set; }
    public int TimeoutSeconds { get; set; } = 10;
    public string Source { get; set; } = "hq";
}



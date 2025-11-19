namespace SRC.Application.Options;

public class LicenseSummaryEmailOptions
{
    public bool Enabled { get; set; } = false;
    public string[] Recipients { get; set; } = Array.Empty<string>();
    public string Subject { get; set; } = "SRC Lisans Özeti";
    public string CronExpression { get; set; } = "0 8 * * *"; // every day at 08:00
}



namespace SRC.Application.Options;

public class DocumentReminderOptions
{
    /// <summary>
    /// Zorunlu belge tipleri listesi
    /// </summary>
    public string[] RequiredDocumentTypes { get; set; } = new[]
    {
        "kimlik",
        "foto",
        "diploma",
        "adli_sicil",
        "ogrenim_belgesi",
        "surucu_belgesi"
    };

    /// <summary>
    /// Eksik belge hatırlatması için kontrol periyodu (gün)
    /// </summary>
    public int ReminderCheckIntervalDays { get; set; } = 7;

    /// <summary>
    /// Hatırlatma gönderim kanalı (email, sms, both)
    /// </summary>
    public string DefaultChannel { get; set; } = "both";
}


namespace SRC.Application.Options;

public class LicenseReminderOptions
{
    /// <summary>
    /// Gün cinsinden hatırlatma eşikleri. Örn: [30, 7, 1]
    /// </summary>
    public int[] ThresholdDays { get; set; } = new[] { 30, 7, 1 };

    /// <summary>
    /// İletişim bilgisi olmayan lisanslar için kullanılacak varsayılan e-posta.
    /// </summary>
    public string DefaultEmail { get; set; } = "hq@example.com";

    /// <summary>
    /// Varsayılan SMS numarası (opsiyonel)
    /// </summary>
    public string? DefaultPhone { get; set; }

    /// <summary>
    /// SMS gönderimi aktif mi?
    /// </summary>
    public bool EnableSms { get; set; } = false;
}



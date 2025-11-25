namespace SRC.Domain.Entities;

/// <summary>
/// SRC türlerine göre ders programı şablonları
/// </summary>
public class SrcCourseTemplate : TenantEntity
{
    public int Id { get; set; }
    public int SrcType { get; set; } // 1-5 (SRC1-SRC5)
    public string? MixedTypes { get; set; } // "SRC1,SRC3" gibi karma sınıf için
    public string SubjectCode { get; set; } = string.Empty; // A, B, C, D, E, F gibi ders kodları
    public string SubjectName { get; set; } = string.Empty; // Ders adı
    public int RequiredHours { get; set; } // Gerekli ders saati
    public int Order { get; set; } // Ders sırası
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Toplam ders saati (SRC1+SRC3 gibi karma sınıflar için)
    /// </summary>
    public int TotalRequiredHours { get; set; }
}


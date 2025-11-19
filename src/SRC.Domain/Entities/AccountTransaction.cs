namespace SRC.Domain.Entities;

/// <summary>
/// Cari hesap işlem kayıtları (gelir/gider)
/// </summary>
public class AccountTransaction : TenantEntity
{
    public int Id { get; set; }
    public DateTime TransactionDate { get; set; }
    public string Type { get; set; } = default!; // "income" (gelir) veya "expense" (gider)
    public string Category { get; set; } = default!; // "course_fee", "rent", "salary", "utility", "other" vb.
    public string Description { get; set; } = default!;
    public decimal Amount { get; set; }
    public string? Reference { get; set; } // Referans numarası, fatura no vb.
    public string? Notes { get; set; }
    public string? CreatedBy { get; set; } // İşlemi yapan kullanıcı
}


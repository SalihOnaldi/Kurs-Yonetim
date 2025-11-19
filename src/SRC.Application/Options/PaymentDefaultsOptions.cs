namespace SRC.Application.Options;

public class PaymentDefaultsOptions
{
    public bool AutoCreateOnStudentCreate { get; set; } = true;
    public decimal Amount { get; set; } = 0m;
    public string PaymentType { get; set; } = "course_fee";
    public int DueDays { get; set; } = 7;
    public decimal? PenaltyAmount { get; set; }
    public string? Description { get; set; } = "Varsayılan kurs ücreti";
}



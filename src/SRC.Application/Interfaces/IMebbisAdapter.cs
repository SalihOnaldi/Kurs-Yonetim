namespace SRC.Application.Interfaces;

public class MebbisTransferRequest
{
    public int EnrollmentId { get; set; }
    public string StudentTcKimlikNo { get; set; } = string.Empty;
    public string StudentName { get; set; } = string.Empty;
    public string StudentSurname { get; set; } = string.Empty;
    public DateTime? BirthDate { get; set; }
    public int SrcType { get; set; }
    public DateTime EnrollmentDate { get; set; }
}

public class MebbisTransferResponse
{
    public bool Success { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}

public interface IMebbisAdapter
{
    Task<MebbisTransferResponse> TransferStudentAsync(MebbisTransferRequest request, bool isDryRun = true);
    Task<bool> SolveCaptchaAsync();
}


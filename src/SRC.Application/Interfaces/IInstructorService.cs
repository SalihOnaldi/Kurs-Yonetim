using SRC.Application.DTOs.Instructor;

namespace SRC.Application.Interfaces;

public interface IInstructorService
{
    Task<IReadOnlyList<InstructorSummaryDto>> GetInstructorsAsync(string? search = null, bool includeInactive = false);
    Task<InstructorSummaryDto> CreateInstructorAsync(CreateInstructorRequest request);
}

public class CreateInstructorRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "Egitmen"; // Egitmen, EgitimYoneticisi
}


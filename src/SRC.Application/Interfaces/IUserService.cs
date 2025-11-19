using SRC.Application.DTOs.Auth;

namespace SRC.Application.Interfaces;

public interface IUserService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<UserDto?> GetUserByIdAsync(int id);
    Task<IReadOnlyList<UserDto>> GetUsersByRolesAsync(params string[] roles);
    Task<IReadOnlyList<UserDto>> GetUsersAsync(string? role = null, bool onlyActive = true);
}


using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Instructor;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;

namespace SRC.Infrastructure.Services;

public class InstructorService : IInstructorService
{
    private static readonly string[] AllowedRoles = { "Egitmen", "EgitimYoneticisi" };
    private readonly SrcDbContext _context;

    public InstructorService(SrcDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<InstructorSummaryDto>> GetInstructorsAsync(string? search = null, bool includeInactive = false)
    {
        var query = _context.Users
            .Where(u => AllowedRoles.Contains(u.Role));

        if (!includeInactive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(term) ||
                u.Username.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term));
        }

        var users = await query
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Username)
            .ToListAsync();

        return users.Select(ToDto).ToList();
    }

    public async Task<InstructorSummaryDto> CreateInstructorAsync(CreateInstructorRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new ArgumentException("Kullanıcı adı, şifre ve ad soyad zorunludur.");
        }

        var role = AllowedRoles.Contains(request.Role) ? request.Role : "Egitmen";

        var existingUser = await _context.Users.AnyAsync(u => u.Username == request.Username);
        if (existingUser)
        {
            throw new InvalidOperationException("Bu kullanıcı adı zaten kullanılıyor.");
        }

        var user = new User
        {
            Username = request.Username.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Email = request.Email?.Trim() ?? string.Empty,
            FullName = request.FullName.Trim(),
            Role = role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return ToDto(user);
    }

    private static InstructorSummaryDto ToDto(User user) => new()
    {
        Id = user.Id,
        FullName = user.FullName,
        Username = user.Username,
        Email = user.Email,
        Role = user.Role
    };
}


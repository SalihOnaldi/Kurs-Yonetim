using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Auth;
using SRC.Application.Interfaces;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using Microsoft.Extensions.Configuration;

namespace SRC.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly SrcDbContext _context;
    private readonly IConfiguration _configuration;

    public UserService(SrcDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users
            .Include(u => u.UserTenants)
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return null;
        }

        // PlatformOwner için tüm tenant'ları al, diğerleri için sadece kendi tenant'larını
        List<string> tenantIds;
        if (user.Role == "PlatformOwner")
        {
            tenantIds = await _context.Tenants
                .Where(t => t.IsActive)
                .Select(t => t.Id)
                .OrderBy(t => t)
                .ToListAsync();
        }
        else
        {
            tenantIds = user.UserTenants.Select(ut => ut.TenantId).Distinct().OrderBy(t => t).ToList();
        }

        var defaultTenantId = tenantIds.FirstOrDefault();

        var token = GenerateJwtToken(user, tenantIds);
        var refreshToken = Guid.NewGuid().ToString(); // In production, store this in DB

        return new LoginResponse
        {
            AccessToken = token,
            RefreshToken = refreshToken,
            TenantId = defaultTenantId,
            Tenants = tenantIds,
            User = new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                FullName = user.FullName,
                Role = user.Role,
                Tenants = tenantIds
            }
        };
    }

    public async Task<UserDto?> GetUserByIdAsync(int id)
    {
        var user = await _context.Users
            .Include(u => u.UserTenants)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return null;

        var tenantIds = user.UserTenants.Select(ut => ut.TenantId).Distinct().OrderBy(t => t).ToList();

        return new UserDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            FullName = user.FullName,
            Role = user.Role,
            Tenants = tenantIds
        };
    }

    public async Task<IReadOnlyList<UserDto>> GetUsersByRolesAsync(params string[] roles)
    {
        if (roles == null || roles.Length == 0)
        {
            return Array.Empty<UserDto>();
        }

        var normalizedRoles = roles.Select(r => r.Trim()).Where(r => !string.IsNullOrWhiteSpace(r)).ToList();
        if (normalizedRoles.Count == 0)
        {
            return Array.Empty<UserDto>();
        }

        var users = await _context.Users
            .Include(u => u.UserTenants)
            .Where(u => normalizedRoles.Contains(u.Role))
            .OrderBy(u => u.FullName)
            .ToListAsync();

        return users.Select(u => new UserDto
        {
            Id = u.Id,
            Username = u.Username,
            Email = u.Email,
            FullName = u.FullName,
            Role = u.Role,
            Tenants = u.UserTenants.Select(ut => ut.TenantId).Distinct().OrderBy(t => t).ToList()
        }).ToList();
    }

    public async Task<IReadOnlyList<UserDto>> GetUsersAsync(string? role = null, bool onlyActive = true)
    {
        var query = _context.Users
            .Include(u => u.UserTenants)
            .AsQueryable();

        if (onlyActive)
        {
            query = query.Where(u => u.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(u => u.Role == role);
        }

        var users = await query
            .OrderBy(u => u.FullName)
            .ThenBy(u => u.Username)
            .ToListAsync();

        return users.Select(u => new UserDto
        {
            Id = u.Id,
            Username = u.Username,
            Email = u.Email,
            FullName = u.FullName,
            Role = u.Role,
            Tenants = u.UserTenants.Select(ut => ut.TenantId).Distinct().OrderBy(t => t).ToList()
        }).ToList();
    }

    private string GenerateJwtToken(User user, IReadOnlyCollection<string> tenantIds)
    {
        var secret = _configuration["JWT_SECRET"] ?? "replace-with-32char-secret-key-min";
        var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
        var key = System.Text.Encoding.UTF8.GetBytes(secret);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.Email, user.Email)
        };

        if (tenantIds.Count == 1)
        {
            claims.Add(new Claim("tenantId", tenantIds.First()));
        }
        else if (tenantIds.Count > 1)
        {
            claims.Add(new Claim("tenants", string.Join(",", tenantIds)));
        }

        var tokenDescriptor = new Microsoft.IdentityModel.Tokens.SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(24),
            SigningCredentials = new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(key),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}


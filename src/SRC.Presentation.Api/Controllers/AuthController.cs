using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SRC.Application.DTOs.Auth;
using SRC.Application.Interfaces;
using SRC.Infrastructure.Data;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly SrcDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(IUserService userService, SrcDbContext context, IConfiguration configuration)
    {
        _userService = userService;
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        // Önce normal kullanıcı girişini dene
        var response = await _userService.LoginAsync(request);
        if (response != null)
        {
            return Ok(response);
        }

        // Eğer kullanıcı bulunamadıysa, tenant (lisans) girişini dene
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Username == request.Username && t.IsActive);

        if (tenant == null || string.IsNullOrWhiteSpace(tenant.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Şifre kontrolü
        if (!BCrypt.Net.BCrypt.Verify(request.Password, tenant.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Lisans süresi kontrolü
        if (tenant.ExpireDate.HasValue && tenant.ExpireDate.Value < DateTime.UtcNow)
        {
            return Unauthorized(new { message = "Lisans süresi dolmuş. Lütfen lisansınızı yenileyin." });
        }

        // Tenant için otomatik bir BranchAdmin kullanıcısı oluştur veya bul
        var tenantUser = await _context.Users
            .Include(u => u.UserTenants)
            .FirstOrDefaultAsync(u => u.Username == $"tenant_{tenant.Id}" && u.Role == "BranchAdmin");

        if (tenantUser == null)
        {
            // Otomatik kullanıcı oluştur (tenant şifresi ile)
            tenantUser = new SRC.Domain.Entities.User
            {
                Username = $"tenant_{tenant.Id}",
                PasswordHash = tenant.PasswordHash, // Tenant şifresini kullan
                Email = $"{tenant.Id}@tenant.local",
                FullName = tenant.Name,
                Role = "BranchAdmin",
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Users.Add(tenantUser);
            await _context.SaveChangesAsync();

            // UserTenant ilişkisi
            _context.UserTenants.Add(new SRC.Domain.Entities.UserTenant
            {
                UserId = tenantUser.Id,
                TenantId = tenant.Id
            });
            await _context.SaveChangesAsync();
        }
        else
        {
            // Mevcut kullanıcının şifresini tenant şifresi ile güncelle (eğer değiştiyse)
            if (tenantUser.PasswordHash != tenant.PasswordHash)
            {
                tenantUser.PasswordHash = tenant.PasswordHash;
                await _context.SaveChangesAsync();
            }
        }

        // UserService ile login yap (tenantUser kullanıcı adı ve tenant şifresi ile)
        var loginResponse = await _userService.LoginAsync(new LoginRequest
        {
            Username = tenantUser.Username,
            Password = request.Password
        });

        if (loginResponse != null)
        {
            return Ok(loginResponse);
        }

        // Eğer UserService.LoginAsync başarısız olursa, direkt token oluştur
        var token = GenerateJwtToken(tenantUser, tenant.Id);

        return Ok(new LoginResponse
        {
            AccessToken = token,
            RefreshToken = Guid.NewGuid().ToString(),
            TenantId = tenant.Id,
            Tenants = new List<string> { tenant.Id },
            User = new UserDto
            {
                Id = tenantUser.Id,
                Username = tenantUser.Username,
                Email = tenantUser.Email,
                FullName = tenantUser.FullName,
                Role = tenantUser.Role,
                Tenants = new List<string> { tenant.Id }
            }
        });
    }

    private string GenerateJwtToken(SRC.Domain.Entities.User user, string tenantId)
    {
        var secret = _configuration["JWT_SECRET"] ?? "replace-with-32char-secret-key-min";
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(secret);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(ClaimTypes.Email, user.Email ?? ""),
            new Claim("tenantId", tenantId)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddHours(24),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> GetMe()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var user = await _userService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return NotFound();
        }

        return Ok(user);
    }
}


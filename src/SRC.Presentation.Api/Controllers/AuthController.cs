using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SRC.Application.DTOs.Auth;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Notifications;
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
    private readonly IEmailSender _emailSender;
    private readonly ISmsSender _smsSender;

    public AuthController(
        IUserService userService, 
        SrcDbContext context, 
        IConfiguration configuration,
        IEmailSender emailSender,
        ISmsSender smsSender)
    {
        _userService = userService;
        _context = context;
        _configuration = configuration;
        _emailSender = emailSender;
        _smsSender = smsSender;
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

    [HttpPost("forgot-password")]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username))
        {
            return BadRequest(new { message = "Kullanıcı adı gereklidir." });
        }

        if (string.IsNullOrWhiteSpace(request.Channel) || (request.Channel != "email" && request.Channel != "sms"))
        {
            return BadRequest(new { message = "Geçerli bir kanal seçiniz (email veya sms)." });
        }

        // Kullanıcıyı bul
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user == null)
        {
            // Tenant kontrolü
            var tenant = await _context.Tenants
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(t => t.Username == request.Username && t.IsActive);

            if (tenant == null)
            {
                // Güvenlik nedeniyle kullanıcı bulunamadı mesajı göster
                return Ok(new { message = "Şifre sıfırlama kodu gönderildi." });
            }

            // Tenant için şifre sıfırlama token'ı oluştur
            var tenantToken = GenerateResetToken();
            var tenantResetToken = new SRC.Domain.Entities.PasswordResetToken
            {
                Username = tenant.Username,
                Token = tenantToken,
                Email = tenant.ContactEmail,
                Phone = tenant.ContactPhone,
                Channel = request.Channel,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(1),
                IsUsed = false
            };

            _context.PasswordResetTokens.Add(tenantResetToken);
            await _context.SaveChangesAsync();

            // Token gönder
            if (request.Channel == "email" && !string.IsNullOrWhiteSpace(tenant.ContactEmail))
            {
                var emailBody = $@"
Merhaba,

Şifre sıfırlama kodunuz: {tenantToken}

Bu kod 1 saat geçerlidir.

Eğer bu işlemi siz yapmadıysanız, lütfen bu e-postayı görmezden gelin.

İyi günler.
";
                await _emailSender.SendAsync(tenant.ContactEmail, "Şifre Sıfırlama Kodu", emailBody);
            }
            else if (request.Channel == "sms" && !string.IsNullOrWhiteSpace(tenant.ContactPhone))
            {
                var smsBody = $"SRC Kurs Yönetim Sistemi - Şifre sıfırlama kodunuz: {tenantToken}. Bu kod 1 saat geçerlidir.";
                await _smsSender.SendAsync(tenant.ContactPhone, smsBody);
            }
            else
            {
                return BadRequest(new { message = "Seçilen kanal için iletişim bilgisi bulunamadı." });
            }

            return Ok(new { message = "Şifre sıfırlama kodu gönderildi." });
        }

        // Kullanıcı için şifre sıfırlama token'ı oluştur
        var token = GenerateResetToken();
        var resetToken = new SRC.Domain.Entities.PasswordResetToken
        {
            Username = user.Username,
            Token = token,
            Email = user.Email,
            Channel = request.Channel,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            IsUsed = false
        };

        _context.PasswordResetTokens.Add(resetToken);
        await _context.SaveChangesAsync();

        // Token gönder
        if (request.Channel == "email" && !string.IsNullOrWhiteSpace(user.Email))
        {
            var emailBody = $@"
Merhaba {user.FullName},

Şifre sıfırlama kodunuz: {token}

Bu kod 1 saat geçerlidir.

Eğer bu işlemi siz yapmadıysanız, lütfen bu e-postayı görmezden gelin.

İyi günler.
";
            await _emailSender.SendAsync(user.Email, "Şifre Sıfırlama Kodu", emailBody);
        }
        else if (request.Channel == "sms")
        {
            // SMS için telefon numarası gerekli ama User entity'sinde yok
            // Bu durumda e-posta kullanılmalı
            return BadRequest(new { message = "SMS gönderimi için telefon numarası gereklidir. Lütfen e-posta kanalını kullanın." });
        }
        else
        {
            return BadRequest(new { message = "E-posta adresi bulunamadı." });
        }

        return Ok(new { message = "Şifre sıfırlama kodu gönderildi." });
    }

    [HttpPost("reset-password")]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Kullanıcı adı, token ve yeni şifre gereklidir." });
        }

        if (request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Şifre en az 6 karakter olmalıdır." });
        }

        // Token'ı bul ve kontrol et
        var resetToken = await _context.PasswordResetTokens
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Username == request.Username && t.Token == request.Token && !t.IsUsed);

        if (resetToken == null)
        {
            return BadRequest(new { message = "Geçersiz veya kullanılmış token." });
        }

        if (resetToken.ExpiresAt < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Token süresi dolmuş." });
        }

        // Kullanıcıyı bul ve şifresini güncelle
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user != null)
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;
            resetToken.IsUsed = true;
            resetToken.UsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Şifre başarıyla sıfırlandı." });
        }

        // Tenant kontrolü
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Username == request.Username && t.IsActive);

        if (tenant != null)
        {
            tenant.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            resetToken.IsUsed = true;
            resetToken.UsedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Tenant kullanıcısının şifresini de güncelle
            var tenantUser = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Username == $"tenant_{tenant.Id}" && u.Role == "BranchAdmin");

            if (tenantUser != null)
            {
                tenantUser.PasswordHash = tenant.PasswordHash;
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Şifre başarıyla sıfırlandı." });
        }

        return BadRequest(new { message = "Kullanıcı bulunamadı." });
    }

    private static string GenerateResetToken()
    {
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }
}

public class ForgotPasswordRequest
{
    public string Username { get; set; } = string.Empty;
    public string Channel { get; set; } = "email"; // email, sms
}

public class ResetPasswordRequest
{
    public string Username { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}


using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.Tenancy;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TenantsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public TenantsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<IEnumerable<TenantSummaryDto>>> GetMyTenants()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var tenantIdsQuery = _context.UserTenants
            .Where(ut => ut.UserId == userId)
            .Select(ut => ut.TenantId);

        var tenants = await _context.Tenants
            .Where(t => tenantIdsQuery.Contains(t.Id) && t.IsActive)
            .OrderBy(t => t.Name)
            .Select(t => new TenantSummaryDto
            {
                Id = t.Id,
                Name = t.Name,
                City = t.City,
                IsActive = t.IsActive
            })
            .ToListAsync();

        return Ok(tenants);
    }

}



using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SRC.Application.Interfaces;

namespace SRC.Presentation.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] string? role = null, [FromQuery] bool onlyActive = true)
    {
        var users = await _userService.GetUsersAsync(role, onlyActive);
        return Ok(users);
    }

    [HttpGet("instructors")]
    public async Task<ActionResult> GetInstructors()
    {
        var instructors = await _userService.GetUsersByRolesAsync("Egitmen", "EgitimYoneticisi");
        return Ok(instructors);
    }
}


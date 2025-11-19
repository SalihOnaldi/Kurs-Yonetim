using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SRC.Application.Interfaces.Tenancy;

namespace SRC.Presentation.Api.Middleware;

public class TenantMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantMiddleware> _logger;

    public TenantMiddleware(RequestDelegate next, ILogger<TenantMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ITenantProvider tenantProvider)
    {
        if (ShouldSkipTenantResolution(context))
        {
            await _next(context);
            return;
        }

        if (!context.Request.Headers.TryGetValue("X-TenantId", out var tenantIdValues) ||
            string.IsNullOrWhiteSpace(tenantIdValues))
        {
            await WriteProblemAsync(context, StatusCodes.Status400BadRequest, "TenantId missing",
                "X-TenantId header is required.");
            return;
        }

        var tenantId = tenantIdValues.ToString().Trim();
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var allowedTenants = GetUserTenants(user);
            if (allowedTenants.Length > 0 &&
                !allowedTenants.Contains(tenantId, StringComparer.OrdinalIgnoreCase))
            {
                _logger.LogWarning("User {User} attempted to access tenant {TenantId} without permission.",
                    user.Identity?.Name, tenantId);

                await WriteProblemAsync(context, StatusCodes.Status403Forbidden, "Tenant access denied",
                    "You are not allowed to access this tenant.");
                return;
            }
        }

        tenantProvider.SetTenant(tenantId);
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-TenantId"] = tenantProvider.TenantId;
            return Task.CompletedTask;
        });

        await _next(context);
    }

    private static string[] GetUserTenants(ClaimsPrincipal user)
    {
        var tenantId = user.FindFirst("tenantId")?.Value;
        var tenants = user.FindFirst("tenants")?.Value;

        if (!string.IsNullOrWhiteSpace(tenants))
        {
            return tenants.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        }

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            return new[] { tenantId };
        }

        return Array.Empty<string>();
    }

    private static Task WriteProblemAsync(HttpContext context, int statusCode, string title, string detail)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Title = title,
            Detail = detail,
            Status = statusCode
        });
    }

    private static bool ShouldSkipTenantResolution(HttpContext context)
    {
        if (HttpMethods.IsOptions(context.Request.Method))
        {
            return true;
        }

        var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
        if (path.StartsWith("/swagger") ||
            path.StartsWith("/hangfire") ||
            path.StartsWith("/health") ||
            path.StartsWith("/api/auth/login") ||
            path.StartsWith("/api/auth/refresh"))
        {
            return true;
        }

        return false;
    }
}


using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SRC.Infrastructure.Data;
using SRC.Presentation.Api.Tests.Infrastructure;
using Xunit;

namespace SRC.Presentation.Api.Tests.Smoke;

public class SmokeTests : IClassFixture<TestingWebApplicationFactory>
{
    private readonly TestingWebApplicationFactory _factory;

    public SmokeTests(TestingWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task DashboardSummary_ReturnsAggregates()
    {
        var client = CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/dashboard/summary");

        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(content);
        var root = document.RootElement;

        Assert.True(root.TryGetProperty("activeCourseCount", out var _));
        Assert.True(root.TryGetProperty("totalStudentCount", out var _));
    }

    [Fact]
    public async Task StudentsSearch_ReturnsAtLeastOneResult()
    {
        var client = CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/students?search=Test");

        response.EnsureSuccessStatusCode();

        var students = await response.Content.ReadFromJsonAsync<List<JsonElement>>();

        Assert.NotNull(students);
        Assert.NotEmpty(students!);
    }

    [Fact]
    public async Task ReportsGenerateJson_ReturnsLessonScheduleData()
    {
        var client = CreateAuthenticatedClient();

        var courseId = await GetExistingCourseIdAsync();

        var request = new
        {
            reportType = "lesson_schedule",
            format = "json",
            parameters = new Dictionary<string, string>
            {
                ["courseId"] = courseId
            }
        };

        var response = await client.PostAsJsonAsync("/api/reports/generate", request);

        response.EnsureSuccessStatusCode();

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = document.RootElement;

        Assert.Equal("lesson_schedule", root.GetProperty("reportType").GetString());
        Assert.True(root.GetProperty("meta").GetProperty("totalSlots").GetInt32() >= 0);
    }

    [Fact]
    public async Task CourseGroups_ListEndpoint_ReturnsSuccess()
    {
        var client = CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/courses/groups");

        response.EnsureSuccessStatusCode();

        var groups = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(groups);
    }

    private HttpClient CreateAuthenticatedClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Test");
        return client;
    }

    private async Task<string> GetExistingCourseIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SrcDbContext>();
        var course = await dbContext.Courses.AsNoTracking().FirstAsync();
        return course.Id.ToString();
    }
}


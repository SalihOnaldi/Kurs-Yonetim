using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SRC.Infrastructure.Data;
using SRC.Infrastructure.Services;
using SRC.Infrastructure.Services.Ai;
using SRC.Infrastructure.Services.Attendance;
using SRC.Infrastructure.Services.Mebbis;
using SRC.Infrastructure.Services.Tenancy;
using SRC.Infrastructure.Jobs;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Mebbis;
using SRC.Application.Interfaces.Notifications;
using SRC.Application.Interfaces.Tenancy;
using SRC.Infrastructure.Services.Notifications;
using SRC.Presentation.Api.Middleware;
using System.Text;
using Hangfire;
using Hangfire.SqlServer;
using Hangfire.Dashboard;
using Hangfire.Common;
using Serilog;
using System.Threading;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;
using SRC.Application.Options;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Hangfire.Server;

var builder = WebApplication.CreateBuilder(args);
var isTestingEnvironment = builder.Environment.IsEnvironment("Testing");

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "SRC Course Management API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.AddResponseCaching(options =>
{
    options.UseCaseSensitivePaths = false;
    options.MaximumBodySize = 1024 * 1024; // 1 MB
});

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.AddMemoryCache();

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<SrcDbContext>(options =>
    options.UseSqlServer(connectionString));

// JWT Authentication
var jwtSecret = builder.Configuration["JWT_SECRET"] ?? "replace-with-32char-secret-key-min";
var key = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

if (!isTestingEnvironment)
{
    // Hangfire
    builder.Services.AddHangfire(config =>
    {
        config.UseSqlServerStorage(connectionString, new SqlServerStorageOptions
        {
            QueuePollInterval = TimeSpan.FromSeconds(15),
            JobExpirationCheckInterval = TimeSpan.FromHours(1),
            CountersAggregateInterval = TimeSpan.FromMinutes(5),
            PrepareSchemaIfNecessary = true,
            DashboardJobListLimit = 25000,
            TransactionTimeout = TimeSpan.FromMinutes(1)
        });
    });

    builder.Services.AddHangfireServer(options =>
    {
        options.Queues = new[] { "critical", "default" };
        options.WorkerCount = Math.Max(Environment.ProcessorCount, 2);
    });

    builder.Services.AddHangfireServer(options =>
    {
        options.ServerName = "maintenance";
        options.Queues = new[] { "maintenance" };
        options.WorkerCount = Math.Max(1, Environment.ProcessorCount / 2);
    });
}

// Application Services
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IStudentService, StudentService>();
builder.Services.AddScoped<IFileStorageService, FileStorageService>();
builder.Services.AddScoped<IOcrService, OcrService>();
builder.Services.AddScoped<IMebbisAdapter, MebbisAdapter>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<ICommunicationService, CommunicationService>();
builder.Services.AddScoped<IInstructorService, InstructorService>();
builder.Services.AddScoped<IAiService, OpenAiService>();
builder.Services.AddHttpClient("openai", client =>
{
    client.BaseAddress = new Uri("https://api.openai.com/");
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IEmailSender, EmailSender>();
builder.Services.AddScoped<ISmsSender, SmsSender>();
builder.Services.AddScoped<IFaceService, MockFaceService>();
builder.Services.AddScoped<IMebbisClient, FakeMebbisClient>();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddScoped<IAuditLogger, AuditLogger>();
builder.Services.AddScoped<ILicenseEventPublisher, LicenseEventPublisher>();
builder.Services.AddScoped<ILicensePermissionService, LicensePermissionService>();
builder.Services.AddScoped<SRC.Application.Interfaces.ICertificateService, CertificateService>();
builder.Services.AddScoped<SRC.Application.Interfaces.ISrcCourseTemplateService, SrcCourseTemplateService>();

builder.Services.Configure<PaymentDefaultsOptions>(builder.Configuration.GetSection("PaymentDefaults"));
builder.Services.Configure<LicenseReminderOptions>(builder.Configuration.GetSection("LicenseReminder"));
builder.Services.Configure<LicenseWebhookOptions>(builder.Configuration.GetSection("LicenseWebhook"));
builder.Services.Configure<LicenseSummaryEmailOptions>(builder.Configuration.GetSection("LicenseSummaryEmail"));
builder.Services.Configure<LicensePermissionOptions>(builder.Configuration.GetSection("LicensePermissions"));
builder.Services.Configure<SRC.Application.Options.DocumentReminderOptions>(builder.Configuration.GetSection("DocumentReminder"));

// Background Jobs
builder.Services.AddScoped<OcrBackgroundJob>();
builder.Services.AddScoped<DocumentExpiryScanJob>();
builder.Services.AddScoped<MissingDocumentReminderJob>();
builder.Services.AddScoped<ReminderDispatchJob>();
builder.Services.AddScoped<LicenseExpiryReminderJob>();
builder.Services.AddScoped<LicenseSummaryEmailJob>();

// Hangfire recurring job registrations
if (!isTestingEnvironment)
{
    builder.Services.AddSingleton<IHostedService, HangfireWorkerBootstrap>();
}

// CORS
var allowedOrigins = builder.Configuration.GetSection("CORS:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseResponseCompression();
app.UseResponseCaching();
app.UseCors("AllowFrontend");
app.UseMiddleware<SRC.Presentation.Api.Middleware.RateLimitMiddleware>();
// OPTIONS request'leri için CORS preflight'ı handle et
app.Use(async (context, next) =>
{
    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 200;
        await context.Response.CompleteAsync();
        return;
    }
    await next();
});
app.UseAuthentication();
app.UseMiddleware<TenantMiddleware>();
app.UseAuthorization();

// Global exception handler (sadece controller'da yakalanmayan exception'lar için)
app.UseExceptionHandler(appBuilder =>
{
    appBuilder.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        
        var exceptionHandlerPathFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        var exception = exceptionHandlerPathFeature?.Error;
        
        if (exception != null)
        {
            Log.Error(exception, "Unhandled exception: {Message} | Path: {Path}", exception.Message, context.Request.Path);
            
            var errorResponse = new
            {
                message = $"Beklenmeyen hata: {exception.Message}",
                type = exception.GetType().Name,
                path = context.Request.Path
            };
            
            await context.Response.WriteAsJsonAsync(errorResponse);
        }
    });
});

app.MapControllers();

// Hangfire Dashboard
if (!app.Environment.IsEnvironment("Testing"))
{
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireAuthorizationFilter() }
    });
}

// Seed data
if (!app.Environment.IsEnvironment("Testing"))
{
    try
    {
        using (var scope = app.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<SrcDbContext>();
            
            // SQL Server hazır olana kadar bekle (max 60 saniye)
            var maxRetries = 12;
            var retryCount = 0;
            var migrationSuccess = false;
            
            while (retryCount < maxRetries && !migrationSuccess)
            {
                try
                {
                    dbContext.Database.Migrate();
                    migrationSuccess = true;
                    Log.Information("Database migrations applied successfully");
                }
                catch (Exception ex)
                {
                    retryCount++;
                    if (retryCount < maxRetries)
                    {
                        Log.Warning("Migration attempt {RetryCount}/{MaxRetries} failed, retrying... Error: {Error}", 
                            retryCount, maxRetries, ex.Message);
                        Thread.Sleep(5000); // 5 saniye bekle
                    }
                    else
                    {
                        Log.Error(ex, "Failed to apply migrations after {MaxRetries} attempts", maxRetries);
                    }
                }
            }
            
            // Seed data otomatik çalışması devre dışı bırakıldı
            // Seed data'yı manuel olarak eklemek için: POST /api/hq/data/seed endpoint'ini kullanın
            // if (migrationSuccess)
            // {
            //     SeedData.Initialize(dbContext);
            // }
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error during database initialization");
        // Uygulama yine de başlasın
    }
}

if (!app.Environment.IsEnvironment("Testing"))
{
    RecurringJob.AddOrUpdate<DocumentExpiryScanJob>(
        "document-expiry-scan",
        job => job.ExecuteAsync(CancellationToken.None),
        "0 6 * * *"); // every day at 06:00

    RecurringJob.AddOrUpdate<ReminderDispatchJob>(
        "reminder-dispatch",
        job => job.ExecuteAsync(CancellationToken.None),
        "*/30 * * * *"); // every 30 minutes
}

app.Run();

// Hangfire authorization filter
public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        // In production, implement proper authorization
        return true;
    }
}

public partial class Program;

public sealed class HangfireWorkerBootstrap : IHostedService
{
    private readonly IRecurringJobManager _recurringJobManager;
    private readonly LicenseSummaryEmailOptions _summaryOptions;

    public HangfireWorkerBootstrap(
        IRecurringJobManager recurringJobManager,
        IOptions<LicenseSummaryEmailOptions> summaryOptions)
    {
        _recurringJobManager = recurringJobManager;
        _summaryOptions = summaryOptions.Value;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        var maintenanceOptions = new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Local
        };

        var criticalOptions = new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Local
        };

        _recurringJobManager.AddOrUpdate<DocumentExpiryScanJob>(
            "document-expiry-scan",
            job => job.ExecuteAsync(CancellationToken.None),
            Cron.Daily(2),
            maintenanceOptions);

        _recurringJobManager.AddOrUpdate<ReminderDispatchJob>(
            "reminder-dispatch",
            job => job.ExecuteAsync(CancellationToken.None),
            "*/10 * * * *",
            criticalOptions);

        _recurringJobManager.AddOrUpdate<LicenseExpiryReminderJob>(
            "license-expiry-reminders",
            job => job.ExecuteAsync(CancellationToken.None),
            Cron.Daily(3),
            maintenanceOptions);

        _recurringJobManager.AddOrUpdate<MissingDocumentReminderJob>(
            "missing-document-reminders",
            job => job.ExecuteAsync(CancellationToken.None),
            Cron.Daily(8), // Her gün saat 08:00'de çalışsın
            maintenanceOptions);

        if (_summaryOptions.Enabled)
        {
            _recurringJobManager.AddOrUpdate<LicenseSummaryEmailJob>(
                "license-summary-email",
                job => job.ExecuteAsync(CancellationToken.None),
                _summaryOptions.CronExpression,
                maintenanceOptions);
        }
 
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}


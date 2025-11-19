using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using SRC.Application.Interfaces.Tenancy;
using SRC.Infrastructure.Services.Tenancy;

namespace SRC.Infrastructure.Data;

public class SrcDbContextFactory : IDesignTimeDbContextFactory<SrcDbContext>
{
    public SrcDbContext CreateDbContext(string[] args)
    {
        var configuration = BuildConfiguration();

        var optionsBuilder = new DbContextOptionsBuilder<SrcDbContext>();
        var connectionString = configuration.GetConnectionString("DefaultConnection") ??
                               configuration["ConnectionStrings__DefaultConnection"] ??
                               "Server=(localdb)\\MSSQLLocalDB;Database=SrcCourseManagement;Trusted_Connection=True;";

        optionsBuilder.UseSqlServer(connectionString);

        var tenantProvider = new TenantProvider();
        tenantProvider.SetTenant("SYSTEM");

        return new SrcDbContext(optionsBuilder.Options, tenantProvider);
    }

    private static IConfiguration BuildConfiguration()
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development";

        // Migration komutu farklı dizinlerden çalışabilir, appsettings.json'ı bul
        var basePath = Directory.GetCurrentDirectory();
        
        // Eğer appsettings.json bulunamazsa, birkaç seviye yukarı bak
        if (!File.Exists(Path.Combine(basePath, "appsettings.json")))
        {
            // src\SRC.Presentation.Api dizininde olabilir
            var apiPath = Path.Combine(basePath, "src", "SRC.Presentation.Api");
            if (Directory.Exists(apiPath) && File.Exists(Path.Combine(apiPath, "appsettings.json")))
            {
                basePath = apiPath;
            }
            // Veya bir seviye yukarı
            else
            {
                var parentPath = Path.GetDirectoryName(basePath);
                if (parentPath != null)
                {
                    var parentApiPath = Path.Combine(parentPath, "src", "SRC.Presentation.Api");
                    if (Directory.Exists(parentApiPath) && File.Exists(Path.Combine(parentApiPath, "appsettings.json")))
                    {
                        basePath = parentApiPath;
                    }
                }
            }
        }

        var builder = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .AddEnvironmentVariables();

        // Connection string environment variable'dan da alınabilir
        var envConnectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrEmpty(envConnectionString))
        {
            // Environment variable'dan gelen connection string'i kullan
            // (Bu zaten AddEnvironmentVariables() ile alınır, ama manuel override için)
        }

        return builder.Build();
    }
}



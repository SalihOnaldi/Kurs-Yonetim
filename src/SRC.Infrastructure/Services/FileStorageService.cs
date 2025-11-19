using Minio;
using SRC.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace SRC.Infrastructure.Services;

public class FileStorageService : IFileStorageService
{
    private readonly MinioClient? _minioClient;
    private readonly string _bucketName;

    public FileStorageService(IConfiguration configuration)
    {
        var endpoint = configuration["S3_ENDPOINT"] ?? "http://localhost:9000";
        var accessKey = configuration["S3_ACCESS_KEY"] ?? "minioadmin";
        var secretKey = configuration["S3_SECRET_KEY"] ?? "minioadmin";
        _bucketName = configuration["S3_BUCKET"] ?? "files";

        try
        {
            var uri = new Uri(endpoint);
            var host = uri.Host;
            var port = uri.IsDefaultPort ? (uri.Scheme == "https" ? 443 : 80) : uri.Port;
            var secure = uri.Scheme == "https";

            var clientBuilder = new MinioClient()
                .WithEndpoint(host, port)
                .WithCredentials(accessKey, secretKey);

            if (secure)
            {
                clientBuilder = clientBuilder.WithSSL();
            }

            _minioClient = clientBuilder.Build();

            _ = Task.Run(async () =>
            {
                try
                {
                    await InitializeBucketAsync();
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Failed to initialize MinIO bucket. File storage may not be available.");
                }
            });
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to initialize MinIO client. File storage will not be available.");
            _minioClient = null;
        }
    }

    private async Task InitializeBucketAsync()
    {
        if (_minioClient == null) return;

        try
        {
            var exists = await _minioClient.BucketExistsAsync(new BucketExistsArgs().WithBucket(_bucketName));
            if (!exists)
            {
                await _minioClient.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucketName));
            }
        }
        catch
        {
            // ignore bucket errors
        }
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
    {
        if (_minioClient == null)
        {
            throw new InvalidOperationException("MinIO client is not initialized. Please check your configuration.");
        }

        var objectName = $"{Guid.NewGuid()}/{fileName}";

        if (fileStream.CanSeek)
        {
            fileStream.Position = 0;
        }

        var putArgs = new PutObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(objectName)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.CanSeek ? fileStream.Length : -1)
            .WithContentType(contentType);

        await _minioClient.PutObjectAsync(putArgs);

        return objectName;
    }

    public async Task<Stream> DownloadFileAsync(string fileUrl)
    {
        if (_minioClient == null)
        {
            throw new InvalidOperationException("MinIO client is not initialized. Please check your configuration.");
        }

        var memoryStream = new MemoryStream();

        var getArgs = new GetObjectArgs()
            .WithBucket(_bucketName)
            .WithObject(fileUrl)
            .WithCallbackStream(stream => stream.CopyTo(memoryStream));

        await _minioClient.GetObjectAsync(getArgs);

        memoryStream.Position = 0;
        return memoryStream;
    }

    public async Task<bool> DeleteFileAsync(string fileUrl)
    {
        if (_minioClient == null)
        {
            return false;
        }

        try
        {
            var removeArgs = new RemoveObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(fileUrl);

            await _minioClient.RemoveObjectAsync(removeArgs);
            return true;
        }
        catch
        {
            return false;
        }
    }
}

using SRC.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace SRC.Infrastructure.Services;

public class MebbisAdapter : IMebbisAdapter
{
    private readonly IConfiguration _configuration;

    public MebbisAdapter(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task<MebbisTransferResponse> TransferStudentAsync(MebbisTransferRequest request, bool isDryRun = true)
    {
        // Mock implementation - in production, integrate with MEBBIS API
        await Task.Delay(1000); // Simulate network call

        var adapterType = _configuration["MEBBIS_ADAPTER"] ?? "mock";

        if (adapterType == "mock")
        {
            // Simulate success/failure randomly
            var random = new Random();
            if (random.NextDouble() > 0.1) // 90% success rate
            {
                return new MebbisTransferResponse
                {
                    Success = true
                };
            }
            else
            {
                return new MebbisTransferResponse
                {
                    Success = false,
                    ErrorCode = "MEBBIS_001",
                    ErrorMessage = "Öğrenci kaydı bulunamadı"
                };
            }
        }

        // TODO: Implement real MEBBIS integration
        return new MebbisTransferResponse
        {
            Success = false,
            ErrorCode = "NOT_IMPLEMENTED",
            ErrorMessage = "MEBBIS adapter henüz implement edilmedi"
        };
    }

    public async Task<bool> SolveCaptchaAsync()
    {
        // Mock captcha solving
        await Task.Delay(500);
        return true;
    }
}


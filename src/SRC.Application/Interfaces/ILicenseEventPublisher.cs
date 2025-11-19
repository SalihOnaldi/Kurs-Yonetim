namespace SRC.Application.Interfaces;

public interface ILicenseEventPublisher
{
    Task PublishAsync(string eventType, object payload, CancellationToken cancellationToken = default);
}



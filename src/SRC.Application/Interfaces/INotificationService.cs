using SRC.Application.DTOs.Notification;

namespace SRC.Application.Interfaces;

public interface INotificationService
{
    Task<List<NotificationDto>> GetNotificationsAsync(string? category, string? severity, int limit = 20);
    Task<NotificationSummaryDto> GetSummaryAsync();
}


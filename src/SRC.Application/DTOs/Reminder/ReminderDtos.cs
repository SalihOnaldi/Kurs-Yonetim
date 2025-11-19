using System;

namespace SRC.Application.DTOs.ReminderDtos;

public class ReminderDto
{
    public int Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Channel { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; }
    public ReminderStudentDto? Student { get; set; }
    public ReminderDocumentDto? Document { get; set; }
}

public class ReminderStudentDto
{
    public int Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class ReminderDocumentDto
{
    public int Id { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public DateTime? DocDate { get; set; }
}

public class CreateReminderRequest
{
    public int StudentId { get; set; }
    public int? StudentDocumentId { get; set; }
    public string Channel { get; set; } = "both";
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
}

public class UpdateReminderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class UpcomingDocumentDto
{
    public int DocumentId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public DateTime? DocDate { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public bool HasPendingReminder { get; set; }
}




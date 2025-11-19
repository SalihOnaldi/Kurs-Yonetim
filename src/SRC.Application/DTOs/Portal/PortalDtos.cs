using System;
using System.Collections.Generic;

namespace SRC.Application.DTOs.Portal;

public class PortalLoginRequest
{
    public string TcKimlikNo { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class PortalLoginResponse
{
    public int StudentId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
}

public class PortalSummaryResponse
{
    public string StudentName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public int TotalCourses { get; set; }
    public int ActiveCourses { get; set; }
    public int UpcomingLessons { get; set; }
    public int PendingDocuments { get; set; }
    public int PendingPayments { get; set; }
    public decimal PendingPaymentAmount { get; set; }
    public IReadOnlyList<PortalUpcomingLessonDto> Lessons { get; set; } = Array.Empty<PortalUpcomingLessonDto>();
}

public class PortalUpcomingLessonDto
{
    public int ScheduleSlotId { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Subject { get; set; }
    public string CourseLabel { get; set; } = string.Empty;
}

public class PortalRecentAttendanceDto
{
    public int AttendanceId { get; set; }
    public bool IsPresent { get; set; }
    public string? Excuse { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Subject { get; set; }
    public string CourseLabel { get; set; } = string.Empty;
    public DateTime? MarkedAt { get; set; }
}

public class PortalDocumentDto
{
    public int DocumentId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public DateTime? DocDate { get; set; }
    public bool IsRequired { get; set; }
    public string ValidationStatus { get; set; } = string.Empty;
    public string? ValidationNotes { get; set; }
}



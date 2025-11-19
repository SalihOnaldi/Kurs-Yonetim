using System.Collections.Generic;

namespace SRC.Application.DTOs.Student;

public class StudentDetailDto
{
    public StudentDto Profile { get; set; } = new();
    public List<StudentDocumentDto> Documents { get; set; } = new();
    public List<StudentEnrollmentSummaryDto> Enrollments { get; set; } = new();
    public List<StudentPaymentSummaryDto> Payments { get; set; } = new();
    public decimal OutstandingBalance { get; set; }
}

public class StudentEnrollmentSummaryDto
{
    public int EnrollmentId { get; set; }
    public int CourseId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime EnrollmentDate { get; set; }
    public int SrcType { get; set; }
    public MebGroupSummaryDto Group { get; set; } = new();
    public bool IsActive { get; set; }
    public int? ExamAttemptCount { get; set; }
}

public class StudentPaymentSummaryDto
{
    public int PaymentId { get; set; }
    public decimal Amount { get; set; }
    public decimal? PenaltyAmount { get; set; }
    public string PaymentType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public DateTime? PaidDate { get; set; }
    public string? ReceiptNo { get; set; }
    public string? Description { get; set; }
    public int? EnrollmentId { get; set; }
    public EnrollmentCourseSummaryDto? Enrollment { get; set; }
}

public class MebGroupSummaryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public int GroupNo { get; set; }
    public string? Branch { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
}

public class EnrollmentCourseSummaryDto
{
    public int CourseId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public MebGroupSummaryDto Group { get; set; } = new();
    public int SrcType { get; set; }
}


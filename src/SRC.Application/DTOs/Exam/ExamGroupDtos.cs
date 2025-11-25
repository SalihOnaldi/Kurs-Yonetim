using System;
using System.Collections.Generic;

namespace SRC.Application.DTOs.Exam;

public class GroupInfoDto
{
    public int Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public int GroupNo { get; set; }
    public string? Branch { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Name { get; set; } = string.Empty;
}

public class GroupExamResultItemDto
{
    public int ExamId { get; set; }
    public int MebGroupId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string ExamType { get; set; } = string.Empty;
    public DateTime ExamDate { get; set; }
    public int StudentId { get; set; }
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public decimal? Score { get; set; }
    public bool Pass { get; set; }
    public int? AttemptNo { get; set; }
    public string? Notes { get; set; }
}

public class GroupExamResultSummaryDto
{
    public int TotalStudents { get; set; }
    public int WrittenPassCount { get; set; }
    public int WrittenFailCount { get; set; }
    public int PracticalPassCount { get; set; }
    public int PracticalFailCount { get; set; }
    public int PracticalEligibleCount { get; set; }
    public int GraduatedCount { get; set; }
}

public class GroupExamResultsDto
{
    public GroupInfoDto Group { get; set; } = new();
    public IReadOnlyList<GroupExamResultItemDto> Written { get; set; } = Array.Empty<GroupExamResultItemDto>();
    public IReadOnlyList<GroupExamResultItemDto> Practical { get; set; } = Array.Empty<GroupExamResultItemDto>();
    public GroupExamResultSummaryDto Summary { get; set; } = new();
}

public class PracticalEligibilityDto
{
    public int StudentId { get; set; }
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public int MebGroupId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public bool WrittenPassed { get; set; }
    public DateTime? WrittenExamDate { get; set; }
    public decimal? WrittenScore { get; set; }
    public bool PracticalPassed { get; set; }
    public DateTime? PracticalExamDate { get; set; }
    public decimal? PracticalScore { get; set; }
}

public class GraduateExportItemDto
{
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
}


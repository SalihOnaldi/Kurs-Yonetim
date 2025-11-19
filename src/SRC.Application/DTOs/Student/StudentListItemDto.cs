using System;

namespace SRC.Application.DTOs.Student;

public class StudentListItemDto
{
    public int Id { get; set; }
    public string TcKimlikNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? BranchName { get; set; }
    public string? LastCourseName { get; set; }
    public bool HasActiveCourse { get; set; }
    public DateTime? LastEnrollmentDate { get; set; }
}

public class StudentListFilter
{
    public string? Search { get; set; }
    public string? Branch { get; set; }
    public bool? HasActiveCourse { get; set; }
}


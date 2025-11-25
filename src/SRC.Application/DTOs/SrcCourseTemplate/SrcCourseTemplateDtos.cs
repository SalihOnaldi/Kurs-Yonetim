namespace SRC.Application.DTOs.SrcCourseTemplate;

public class SrcCourseTemplateDto
{
    public int Id { get; set; }
    public int SrcType { get; set; }
    public string? MixedTypes { get; set; }
    public string SubjectCode { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public int RequiredHours { get; set; }
    public int Order { get; set; }
    public bool IsActive { get; set; }
    public int TotalRequiredHours { get; set; }
}

public class CreateSrcCourseTemplateDto
{
    public int SrcType { get; set; }
    public string? MixedTypes { get; set; }
    public string SubjectCode { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public int RequiredHours { get; set; }
    public int Order { get; set; }
    public int TotalRequiredHours { get; set; }
}

public class UpdateSrcCourseTemplateDto
{
    public string SubjectName { get; set; } = string.Empty;
    public int RequiredHours { get; set; }
    public int Order { get; set; }
    public bool IsActive { get; set; }
    public int TotalRequiredHours { get; set; }
}

public class ScheduleSlotDto
{
    public string SubjectCode { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public int RequiredHours { get; set; }
}


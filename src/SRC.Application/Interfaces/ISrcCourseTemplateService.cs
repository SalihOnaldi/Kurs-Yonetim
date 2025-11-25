using SRC.Application.DTOs.SrcCourseTemplate;

namespace SRC.Application.Interfaces;

public interface ISrcCourseTemplateService
{
    Task<List<SrcCourseTemplateDto>> GetTemplatesBySrcTypeAsync(int srcType, string? mixedTypes = null);
    Task<SrcCourseTemplateDto> CreateTemplateAsync(CreateSrcCourseTemplateDto dto);
    Task<SrcCourseTemplateDto> UpdateTemplateAsync(int id, UpdateSrcCourseTemplateDto dto);
    Task<bool> DeleteTemplateAsync(int id);
    Task<List<ScheduleSlotDto>> GenerateScheduleFromTemplateAsync(int mebGroupId, DateTime startDate);
    Task<bool> ImportFromExcelAsync(Stream excelStream);
}


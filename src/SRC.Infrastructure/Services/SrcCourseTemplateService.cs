using Microsoft.EntityFrameworkCore;
using SRC.Application.DTOs.SrcCourseTemplate;
using SRC.Application.Interfaces;
using SRC.Application.Interfaces.Tenancy;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;
using OfficeOpenXml;
using Microsoft.Extensions.Logging;

namespace SRC.Infrastructure.Services;

public class SrcCourseTemplateService : ISrcCourseTemplateService
{
    private readonly SrcDbContext _context;
    private readonly ITenantProvider _tenantProvider;
    private readonly ILogger<SrcCourseTemplateService> _logger;

    public SrcCourseTemplateService(
        SrcDbContext context,
        ITenantProvider tenantProvider,
        ILogger<SrcCourseTemplateService> logger)
    {
        _context = context;
        _tenantProvider = tenantProvider;
        _logger = logger;
    }

    public async Task<List<SrcCourseTemplateDto>> GetTemplatesBySrcTypeAsync(int srcType, string? mixedTypes = null)
    {
        var query = _context.SrcCourseTemplates
            .AsNoTracking()
            .Where(t => t.SrcType == srcType && t.IsActive);

        if (!string.IsNullOrWhiteSpace(mixedTypes))
        {
            query = query.Where(t => t.MixedTypes == mixedTypes || t.MixedTypes == null);
        }
        else
        {
            query = query.Where(t => t.MixedTypes == null);
        }

        return await query
            .OrderBy(t => t.Order)
            .Select(t => new SrcCourseTemplateDto
            {
                Id = t.Id,
                SrcType = t.SrcType,
                MixedTypes = t.MixedTypes,
                SubjectCode = t.SubjectCode,
                SubjectName = t.SubjectName,
                RequiredHours = t.RequiredHours,
                Order = t.Order,
                IsActive = t.IsActive,
                TotalRequiredHours = t.TotalRequiredHours
            })
            .ToListAsync();
    }

    public async Task<SrcCourseTemplateDto> CreateTemplateAsync(CreateSrcCourseTemplateDto dto)
    {
        var template = new SrcCourseTemplate
        {
            SrcType = dto.SrcType,
            MixedTypes = dto.MixedTypes,
            SubjectCode = dto.SubjectCode,
            SubjectName = dto.SubjectName,
            RequiredHours = dto.RequiredHours,
            Order = dto.Order,
            IsActive = true,
            TotalRequiredHours = dto.TotalRequiredHours
        };

        _context.SrcCourseTemplates.Add(template);
        await _context.SaveChangesAsync();

        return new SrcCourseTemplateDto
        {
            Id = template.Id,
            SrcType = template.SrcType,
            MixedTypes = template.MixedTypes,
            SubjectCode = template.SubjectCode,
            SubjectName = template.SubjectName,
            RequiredHours = template.RequiredHours,
            Order = template.Order,
            IsActive = template.IsActive,
            TotalRequiredHours = template.TotalRequiredHours
        };
    }

    public async Task<SrcCourseTemplateDto> UpdateTemplateAsync(int id, UpdateSrcCourseTemplateDto dto)
    {
        var template = await _context.SrcCourseTemplates.FindAsync(id);
        if (template == null)
        {
            throw new ArgumentException("Şablon bulunamadı.", nameof(id));
        }

        template.SubjectName = dto.SubjectName;
        template.RequiredHours = dto.RequiredHours;
        template.Order = dto.Order;
        template.IsActive = dto.IsActive;
        template.TotalRequiredHours = dto.TotalRequiredHours;

        await _context.SaveChangesAsync();

        return new SrcCourseTemplateDto
        {
            Id = template.Id,
            SrcType = template.SrcType,
            MixedTypes = template.MixedTypes,
            SubjectCode = template.SubjectCode,
            SubjectName = template.SubjectName,
            RequiredHours = template.RequiredHours,
            Order = template.Order,
            IsActive = template.IsActive,
            TotalRequiredHours = template.TotalRequiredHours
        };
    }

    public async Task<bool> DeleteTemplateAsync(int id)
    {
        var template = await _context.SrcCourseTemplates.FindAsync(id);
        if (template == null)
        {
            return false;
        }

        _context.SrcCourseTemplates.Remove(template);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<ScheduleSlotDto>> GenerateScheduleFromTemplateAsync(int mebGroupId, DateTime startDate)
    {
        var group = await _context.MebGroups
            .AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == mebGroupId);

        if (group == null)
        {
            throw new ArgumentException("Sınıf bulunamadı.", nameof(mebGroupId));
        }

        var templates = await GetTemplatesBySrcTypeAsync(group.SrcType, group.MixedTypes);
        if (templates.Count == 0)
        {
            return new List<ScheduleSlotDto>();
        }

        var scheduleSlots = new List<ScheduleSlotDto>();
        var currentDate = startDate.Date;
        var currentHour = 8; // Başlangıç saati: 08:00

        foreach (var template in templates.OrderBy(t => t.Order))
        {
            var hoursRemaining = template.RequiredHours;
            while (hoursRemaining > 0)
            {
                var hoursToSchedule = Math.Min(hoursRemaining, 4); // Maksimum 4 saatlik blok

                var startTime = currentDate.AddHours(currentHour);
                var endTime = startTime.AddHours(hoursToSchedule);

                scheduleSlots.Add(new ScheduleSlotDto
                {
                    SubjectCode = template.SubjectCode,
                    SubjectName = template.SubjectName,
                    StartTime = startTime,
                    EndTime = endTime,
                    RequiredHours = hoursToSchedule
                });

                hoursRemaining -= hoursToSchedule;
                currentHour += hoursToSchedule;

                // Gün sonu kontrolü (18:00'den sonra yeni güne geç)
                if (currentHour >= 18)
                {
                    currentDate = currentDate.AddDays(1);
                    currentHour = 8;
                }
            }
        }

        return scheduleSlots;
    }

    public async Task<bool> ImportFromExcelAsync(Stream excelStream)
    {
        // EPPlus 8+ için license ayarı gerekli değil (community edition)
        
        using var package = new ExcelPackage(excelStream);
        var worksheet = package.Workbook.Worksheets.FirstOrDefault();
        
        if (worksheet == null)
        {
            throw new InvalidOperationException("Excel dosyasında çalışma sayfası bulunamadı.");
        }

        var rowCount = worksheet.Dimension?.Rows ?? 0;
        if (rowCount < 2) // Başlık + en az 1 veri satırı
        {
            throw new InvalidOperationException("Excel dosyasında veri bulunamadı.");
        }

        var templates = new List<SrcCourseTemplate>();
        var tenantId = _tenantProvider.TenantId;

        // Excel formatı: SrcType | MixedTypes | SubjectCode | SubjectName | RequiredHours | Order | IsActive | TotalRequiredHours
        for (int row = 2; row <= rowCount; row++)
        {
            try
            {
                var srcType = Convert.ToInt32(worksheet.Cells[row, 1].Value ?? 0);
                if (srcType < 1 || srcType > 5)
                {
                    continue; // Geçersiz SRC tipi, satırı atla
                }

                var mixedTypes = worksheet.Cells[row, 2].Value?.ToString()?.Trim();
                var subjectCode = worksheet.Cells[row, 3].Value?.ToString()?.Trim() ?? "";
                var subjectName = worksheet.Cells[row, 4].Value?.ToString()?.Trim() ?? "";
                var requiredHours = Convert.ToInt32(worksheet.Cells[row, 5].Value ?? 0);
                var order = Convert.ToInt32(worksheet.Cells[row, 6].Value ?? 0);
                var isActive = Convert.ToBoolean(worksheet.Cells[row, 7].Value ?? true);
                var totalRequiredHours = Convert.ToInt32(worksheet.Cells[row, 8].Value ?? requiredHours);

                if (string.IsNullOrWhiteSpace(subjectCode) || string.IsNullOrWhiteSpace(subjectName))
                {
                    continue; // Zorunlu alanlar eksik, satırı atla
                }

                // Aynı tenant, srcType ve subjectCode kombinasyonu var mı kontrol et
                var existing = await _context.SrcCourseTemplates
                    .FirstOrDefaultAsync(t =>
                        t.TenantId == tenantId &&
                        t.SrcType == srcType &&
                        t.SubjectCode == subjectCode &&
                        (mixedTypes == null ? t.MixedTypes == null : t.MixedTypes == mixedTypes));

                if (existing != null)
                {
                    // Mevcut kaydı güncelle
                    existing.SubjectName = subjectName;
                    existing.RequiredHours = requiredHours;
                    existing.Order = order;
                    existing.IsActive = isActive;
                    existing.TotalRequiredHours = totalRequiredHours;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    // Yeni kayıt oluştur
                    var template = new SrcCourseTemplate
                    {
                        SrcType = srcType,
                        MixedTypes = string.IsNullOrWhiteSpace(mixedTypes) ? null : mixedTypes,
                        SubjectCode = subjectCode,
                        SubjectName = subjectName,
                        RequiredHours = requiredHours,
                        Order = order,
                        IsActive = isActive,
                        TotalRequiredHours = totalRequiredHours,
                        CreatedAt = DateTime.UtcNow
                    };
                    templates.Add(template);
                }
            }
            catch (Exception ex)
            {
                // Hatalı satırı atla ve devam et
                _logger.LogWarning(ex, "Excel import satır {Row} işlenirken hata oluştu", row);
                continue;
            }
        }

        if (templates.Count > 0)
        {
            await _context.SrcCourseTemplates.AddRangeAsync(templates);
            await _context.SaveChangesAsync();
        }

        return true;
    }
}


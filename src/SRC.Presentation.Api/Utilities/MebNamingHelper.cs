using SRC.Domain.Entities;

namespace SRC.Presentation.Api.Utilities;

public static class MebNamingHelper
{
    private static readonly string[] MonthNames =
    {
        "",
        "Ocak",
        "Şubat",
        "Mart",
        "Nisan",
        "Mayıs",
        "Haziran",
        "Temmuz",
        "Ağustos",
        "Eylül",
        "Ekim",
        "Kasım",
        "Aralık"
    };

    public static string BuildGroupName(MebGroup group)
    {
        var monthName = GetMonthName(group.Month).ToUpperInvariant();
        var baseName = $"{group.Year}-{monthName}-GRUP {group.GroupNo:D2}";
        return string.IsNullOrWhiteSpace(group.Branch)
            ? baseName
            : $"{baseName}-{group.Branch.Trim()}";
    }

    public static string BuildCourseName(int srcType, MebGroup group)
    {
        var monthName = GetMonthName(group.Month);
        var baseName = $"SRC{srcType} {monthName} {group.Year}";
        return string.IsNullOrWhiteSpace(group.Branch)
            ? $"{baseName} - Grup {group.GroupNo:D2}"
            : $"{baseName} - Grup {group.GroupNo:D2} ({group.Branch.Trim()})";
    }

    public static string GetMonthName(int month)
    {
        if (month < 1 || month > 12)
        {
            return month.ToString();
        }

        return MonthNames[month];
    }
}


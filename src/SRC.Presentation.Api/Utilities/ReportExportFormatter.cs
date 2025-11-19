using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace SRC.Presentation.Api.Utilities;

public static class ReportExportFormatter
{
    static ReportExportFormatter()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public static IReadOnlyList<Dictionary<string, object?>> ExtractRecords(object? data)
    {
        var result = new List<Dictionary<string, object?>>();

        if (data == null)
        {
            return result;
        }

        if (data is string)
        {
            result.Add(new Dictionary<string, object?> { ["value"] = data });
            return result;
        }

        if (data is IEnumerable enumerable)
        {
            foreach (var item in enumerable)
            {
                result.Add(FlattenObject(item, null));
            }
            return result;
        }

        result.Add(FlattenObject(data, null));
        return result;
    }

    public static string ToCsv(IReadOnlyList<Dictionary<string, object?>> records)
    {
        var sb = new StringBuilder();

        if (records.Count == 0)
        {
            sb.AppendLine("No data");
            return sb.ToString();
        }

        var headers = records
            .SelectMany(dict => dict.Keys)
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        sb.AppendLine(string.Join(",", headers.Select(EscapeCsv)));

        foreach (var record in records)
        {
            var values = headers
                .Select(header => record.TryGetValue(header, out var value) ? ConvertValue(value) : string.Empty)
                .Select(EscapeCsv);

            sb.AppendLine(string.Join(",", values));
        }

        return sb.ToString();
    }

    public static string ToHtml(string title, IReadOnlyList<Dictionary<string, object?>> records, object? meta)
    {
        var sb = new StringBuilder();
        var metaJson = meta != null
            ? JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true })
            : "{}";

        sb.AppendLine("<!DOCTYPE html>");
        sb.AppendLine("<html lang=\"tr\">");
        sb.AppendLine("<head>");
        sb.AppendLine("<meta charset=\"utf-8\" />");
        sb.AppendLine($"<title>{System.Net.WebUtility.HtmlEncode(title)}</title>");
        sb.AppendLine("<style>");
        sb.AppendLine("body { font-family: Arial, sans-serif; margin: 24px; }");
        sb.AppendLine("h1 { color: #1f2937; }");
        sb.AppendLine("table { border-collapse: collapse; width: 100%; margin-top: 16px; }");
        sb.AppendLine("th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }");
        sb.AppendLine("th { background-color: #f3f4f6; font-weight: 600; }");
        sb.AppendLine("tbody tr:nth-child(even) { background-color: #f9fafb; }");
        sb.AppendLine("pre { background-color: #f9fafb; border: 1px solid #d1d5db; padding: 12px; font-size: 12px; }");
        sb.AppendLine("</style>");
        sb.AppendLine("</head>");
        sb.AppendLine("<body>");
        sb.AppendLine($"<h1>{System.Net.WebUtility.HtmlEncode(title)}</h1>");
        sb.AppendLine("<h2>Meta</h2>");
        sb.AppendLine($"<pre>{System.Net.WebUtility.HtmlEncode(metaJson)}</pre>");

        if (records.Count == 0)
        {
            sb.AppendLine("<p>Seçili kriterlere uygun kayıt bulunamadı.</p>");
        }
        else
        {
            var headers = records
                .SelectMany(dict => dict.Keys)
                .Distinct()
                .OrderBy(k => k)
                .ToList();

            sb.AppendLine("<table>");
            sb.AppendLine("<thead><tr>");
            foreach (var header in headers)
            {
                sb.AppendLine($"<th>{System.Net.WebUtility.HtmlEncode(header)}</th>");
            }
            sb.AppendLine("</tr></thead>");
            sb.AppendLine("<tbody>");
            foreach (var record in records)
            {
                sb.AppendLine("<tr>");
                foreach (var header in headers)
                {
                    record.TryGetValue(header, out var value);
                    sb.AppendLine($"<td>{System.Net.WebUtility.HtmlEncode(ConvertValue(value))}</td>");
                }
                sb.AppendLine("</tr>");
            }
            sb.AppendLine("</tbody>");
            sb.AppendLine("</table>");
        }

        sb.AppendLine("</body>");
        sb.AppendLine("</html>");

        return sb.ToString();
    }

    public static byte[] ToPdf(string title, IReadOnlyList<Dictionary<string, object?>> records, object? meta)
    {
        var metaJson = meta != null
            ? JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true })
            : "{}";

        var headers = records
            .SelectMany(dict => dict.Keys)
            .Distinct()
            .OrderBy(k => k)
            .ToList();

        var hasData = records.Count > 0 && headers.Count > 0;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(30);
                page.Size(PageSizes.A4);
                page.PageColor(Colors.White);

                page.Header().Text(title).SemiBold().FontSize(20).FontColor(Colors.Blue.Medium);

                page.Content().Column(column =>
                {
                    column.Item().Text("Meta Bilgileri").SemiBold().FontSize(12).FontColor(Colors.Grey.Darken2);
                    column.Item().Text(metaJson).FontSize(9);

                    if (!hasData)
                    {
                        column.Item().PaddingTop(16).Text("Kayıt bulunamadı.").Italic().FontSize(11);
                        return;
                    }

                    column.Item().PaddingTop(16).Element(element =>
                    {
                        element.Table(table =>
                        {
                            table.ColumnsDefinition(columns =>
                            {
                                foreach (var _ in headers)
                                {
                                    columns.RelativeColumn();
                                }
                            });

                            table.Header(header =>
                            {
                                foreach (var headerName in headers)
                                {
                                    header.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text(headerName).SemiBold().FontSize(10);
                                }
                            });

                            foreach (var record in records)
                            {
                                foreach (var headerName in headers)
                                {
                                    record.TryGetValue(headerName, out var value);
                                    table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten3).Padding(4)
                                        .Text(ConvertValue(value)).FontSize(9);
                                }
                            }
                        });
                    });
                });

                page.Footer().AlignRight().Text(txt =>
                {
                    txt.Span("Oluşturulma: ").FontSize(9).FontColor(Colors.Grey.Medium);
                    txt.Span(DateTime.UtcNow.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture))
                        .FontSize(9).FontColor(Colors.Grey.Darken1);
                });
            });
        });

        return document.GeneratePdf();
    }

    private static Dictionary<string, object?> FlattenObject(object? value, string? prefix)
    {
        var result = new Dictionary<string, object?>();

        if (value == null)
        {
            return result;
        }

        if (value is string or DateTime or DateTimeOffset or Guid)
        {
            result[NormalizeKey(prefix ?? "value")] = value;
            return result;
        }

        if (value is IEnumerable enumerable && value is not IDictionary)
        {
            var list = new List<object?>();
            foreach (var item in enumerable)
            {
                list.Add(item);
            }

            result[NormalizeKey(prefix ?? "values")] = list.Count == 0 ? null : JsonSerializer.Serialize(list);
            return result;
        }

        var type = value.GetType();
        if (type.IsPrimitive || type.IsEnum || type == typeof(decimal))
        {
            result[NormalizeKey(prefix ?? type.Name)] = value;
            return result;
        }

        foreach (var property in type.GetProperties())
        {
            var propertyValue = property.GetValue(value);
            var key = NormalizeKey(string.IsNullOrEmpty(prefix) ? property.Name : $"{prefix}.{property.Name}");

            if (propertyValue == null || propertyValue is string or Guid)
            {
                result[key] = propertyValue;
                continue;
            }

            if (propertyValue is DateTime dateTime)
            {
                result[key] = dateTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
                continue;
            }

            if (propertyValue is DateOnly dateOnly)
            {
                result[key] = dateOnly.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                continue;
            }

            if (propertyValue is TimeOnly timeOnly)
            {
                result[key] = timeOnly.ToString("HH:mm", CultureInfo.InvariantCulture);
                continue;
            }

            if (propertyValue is IEnumerable enumerableProperty && propertyValue is not IDictionary)
            {
                var flattenedList = new List<Dictionary<string, object?>>();
                foreach (var item in enumerableProperty)
                {
                    flattenedList.Add(FlattenObject(item, null));
                }
                result[key] = flattenedList.Count == 0 ? null : JsonSerializer.Serialize(flattenedList);
                continue;
            }

            // Nested object
            var nested = FlattenObject(propertyValue, key);
            foreach (var nestedItem in nested)
            {
                result[nestedItem.Key] = nestedItem.Value;
            }
        }

        if (result.Count == 0)
        {
            result[NormalizeKey(prefix ?? "value")] = value.ToString();
        }

        return result;
    }

    private static string NormalizeKey(string key)
    {
        return key.Replace(" ", "_");
    }

    private static string EscapeCsv(string input)
    {
        if (input.Contains('"') || input.Contains(',') || input.Contains('\n') || input.Contains('\r'))
        {
            return $"\"{input.Replace("\"", "\"\"")}\"";
        }

        return input;
    }

    private static string ConvertValue(object? value)
    {
        if (value == null)
        {
            return string.Empty;
        }

        return value switch
        {
            DateTime dateTime => dateTime.ToString("dd.MM.yyyy HH:mm", CultureInfo.InvariantCulture),
            DateOnly dateOnly => dateOnly.ToString("dd.MM.yyyy", CultureInfo.InvariantCulture),
            TimeOnly timeOnly => timeOnly.ToString("HH:mm", CultureInfo.InvariantCulture),
            bool boolean => boolean ? "Evet" : "Hayır",
            Enum enumValue => enumValue.ToString(),
            IEnumerable enumerable when value is not string => JsonSerializer.Serialize(enumerable),
            _ => Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty
        };
    }
}


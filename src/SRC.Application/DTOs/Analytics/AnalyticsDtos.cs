using System;
using System.Collections.Generic;

namespace SRC.Application.DTOs.Analytics;

public class AnalyticsSummaryDto
{
    public int TotalStudents { get; set; }
    public int ActiveCourses { get; set; }
    public decimal AverageOccupancy { get; set; }
    public int DocumentsExpiringSoon { get; set; }
    public int LowAttendanceCourses { get; set; }
}

public class MonthlyRevenuePointDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Amount { get; set; }
}

public class OccupancyTrendPointDto
{
    public DateTime Date { get; set; }
    public double Occupancy { get; set; }
}



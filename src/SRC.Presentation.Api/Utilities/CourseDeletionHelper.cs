using Microsoft.EntityFrameworkCore;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Utilities;

internal static class CourseDeletionHelper
{
    public static async Task CleanupCourseAsync(SrcDbContext context, Course course)
    {
        // Ensure navigation collections are loaded
        await context.Entry(course).Collection(c => c.Enrollments).LoadAsync();
        await context.Entry(course).Collection(c => c.ScheduleSlots).LoadAsync();
        await context.Entry(course).Collection(c => c.Exams).LoadAsync();
        await context.Entry(course).Collection(c => c.MebbisTransferJobs).LoadAsync();

        foreach (var enrollment in course.Enrollments)
        {
            await context.Entry(enrollment).Collection(e => e.MebbisTransferItems).LoadAsync();
        }

        foreach (var job in course.MebbisTransferJobs)
        {
            await context.Entry(job).Collection(j => j.TransferItems).LoadAsync();
        }

        // Collect transfer items (linked both by enrollment and job)
        var transferItems = new Dictionary<int, MebbisTransferItem>();
        foreach (var item in course.MebbisTransferJobs.SelectMany(j => j.TransferItems))
        {
            transferItems[item.Id] = item;
        }

        foreach (var item in course.Enrollments.SelectMany(e => e.MebbisTransferItems))
        {
            transferItems[item.Id] = item;
        }

        if (transferItems.Count > 0)
        {
            context.MebbisTransferItems.RemoveRange(transferItems.Values);
        }

        if (course.Enrollments.Count > 0)
        {
            var enrollmentIds = course.Enrollments.Select(e => e.Id).ToList();

            var relatedPayments = await context.Payments
                .Where(p => p.EnrollmentId.HasValue && enrollmentIds.Contains(p.EnrollmentId.Value))
                .ToListAsync();

            foreach (var payment in relatedPayments)
            {
                payment.EnrollmentId = null;
            }

            context.Enrollments.RemoveRange(course.Enrollments);
        }

        if (course.ScheduleSlots.Count > 0)
        {
            context.ScheduleSlots.RemoveRange(course.ScheduleSlots);
        }

        if (course.Exams.Count > 0)
        {
            foreach (var exam in course.Exams)
            {
                await context.Entry(exam).Collection(e => e.ExamResults).LoadAsync();
            }

            context.Exams.RemoveRange(course.Exams);
        }

        if (course.MebbisTransferJobs.Count > 0)
        {
            context.MebbisTransferJobs.RemoveRange(course.MebbisTransferJobs);
        }
    }
}


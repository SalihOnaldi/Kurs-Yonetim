using System;
using System.Linq;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SRC.Domain.Entities;
using SRC.Infrastructure.Data;

namespace SRC.Presentation.Api.Tests.Infrastructure;

public class TestingWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<SrcDbContext>));
            services.RemoveAll(typeof(SrcDbContext));

            services.AddDbContext<SrcDbContext>(options =>
            {
                options.UseInMemoryDatabase("SrcCourseManagementTests");
            });

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "Test";
                options.DefaultChallengeScheme = "Test";
                options.DefaultScheme = "Test";
            }).AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", _ => { });

            var serviceProvider = services.BuildServiceProvider();

            using var scope = serviceProvider.CreateScope();
            var scopedServices = scope.ServiceProvider;
            var db = scopedServices.GetRequiredService<SrcDbContext>();

            db.Database.EnsureDeleted();
            db.Database.EnsureCreated();

            SeedTestData(db);
        });
    }

    private static void SeedTestData(SrcDbContext context)
    {
        if (context.Students.Any())
        {
            return;
        }

        var now = DateTime.UtcNow;

        var group = new MebGroup
        {
            Year = now.Year,
            Month = now.Month,
            GroupNo = 1,
            Branch = "MERKEZ",
            StartDate = now.AddDays(-3),
            EndDate = now.AddDays(20),
            Capacity = 40,
            Status = "active"
        };

        var course = new Course
        {
            SrcType = 1,
            IsMixed = false,
            PlannedHours = 40,
            MebApprovalStatus = "approved",
            MebGroup = group
        };

        var student = new Student
        {
            TcKimlikNo = "12345678901",
            FirstName = "Test",
            LastName = "Student",
            Phone = "5551234567",
            Email = "test.student@example.com"
        };

        var enrollment = new Enrollment
        {
            Student = student,
            Course = course,
            EnrollmentDate = now.AddDays(-1),
            Status = "active",
            Fee = 1500m,
            PaidAmount = 0m
        };

        var scheduleSlot = new ScheduleSlot
        {
            Course = course,
            StartTime = now.AddHours(1),
            EndTime = now.AddHours(3),
            Subject = "Teorik Eğitim"
        };

        var exam = new Exam
        {
            Course = course,
            ExamType = "yazili",
            ExamDate = now.AddDays(3),
            Status = "scheduled",
            MebSessionCode = "SESSION-001"
        };

        var examResult = new ExamResult
        {
            Exam = exam,
            Student = student,
            Score = 85m,
            Pass = true,
            AttemptNo = 1,
            Notes = "Başarılı"
        };

        var payment = new Payment
        {
            Student = student,
            Enrollment = enrollment,
            Amount = 1500m,
            DueDate = now.AddDays(-5),
            PaymentType = "course_fee",
            PenaltyAmount = 100m,
            Status = "pending",
            Description = "Test ödeme kaydı"
        };

        context.MebGroups.Add(group);
        context.Courses.Add(course);
        context.Students.Add(student);
        context.Enrollments.Add(enrollment);
        context.ScheduleSlots.Add(scheduleSlot);
        context.Exams.Add(exam);
        context.ExamResults.Add(examResult);
        context.Payments.Add(payment);

        context.SaveChanges();
    }
}


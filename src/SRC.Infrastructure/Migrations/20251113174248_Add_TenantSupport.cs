using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRC.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_TenantSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Students_TcKimlikNo",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_ScheduledAt",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_Status",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_MebGroups_Year_Month_GroupNo_Branch",
                table: "MebGroups");

            migrationBuilder.DropIndex(
                name: "IX_MebbisSyncLogs_CreatedAt",
                table: "MebbisSyncLogs");

            migrationBuilder.DropIndex(
                name: "IX_AiQueries_CreatedAt",
                table: "AiQueries");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Students",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "StudentDocuments",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "ScheduleSlots",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "Reminders",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "Channel",
                table: "Reminders",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Reminders",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Payments",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Payments",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "MebGroups",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "MebbisTransferJobs",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "MebbisTransferJobs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "MebbisTransferItems",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "MebbisTransferItems",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "MebbisSyncLogs",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "MebbisSyncLogs",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Exams",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "ExamResults",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Enrollments",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Enrollments",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Enrollments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MebApprovalStatus",
                table: "Courses",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Courses",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "Attendances",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Attendances",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "AiQueries",
                type: "nvarchar(450)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "AiQueries",
                type: "datetime2",
                nullable: true);

            const string defaultTenant = "MAVI-BEYAZ-AKADEMI";

            migrationBuilder.Sql($"UPDATE Students SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE StudentDocuments SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE ScheduleSlots SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Reminders SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Payments SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE MebGroups SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE MebbisTransferJobs SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE MebbisTransferItems SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE MebbisSyncLogs SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Exams SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE ExamResults SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Enrollments SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Courses SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE Attendances SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");
            migrationBuilder.Sql($"UPDATE AiQueries SET TenantId = '{defaultTenant}' WHERE TenantId = '' OR TenantId IS NULL;");

            migrationBuilder.CreateTable(
                name: "Tenants",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserTenants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<string>(type: "nvarchar(450)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTenants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTenants_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalTable: "Tenants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserTenants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Students_TenantId_CreatedAt",
                table: "Students",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Students_TenantId_TcKimlikNo",
                table: "Students",
                columns: new[] { "TenantId", "TcKimlikNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_TenantId_ScheduledAt",
                table: "Reminders",
                columns: new[] { "TenantId", "ScheduledAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_TenantId_Status",
                table: "Reminders",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_TenantId_Type_Channel",
                table: "Reminders",
                columns: new[] { "TenantId", "Type", "Channel" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_TenantId_Status_DueDate",
                table: "Payments",
                columns: new[] { "TenantId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_MebGroups_TenantId_Year_Month_GroupNo_Branch",
                table: "MebGroups",
                columns: new[] { "TenantId", "Year", "Month", "GroupNo", "Branch" },
                unique: true,
                filter: "[Branch] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MebbisSyncLogs_TenantId_CreatedAt",
                table: "MebbisSyncLogs",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Exams_TenantId_ExamDate",
                table: "Exams",
                columns: new[] { "TenantId", "ExamDate" });

            migrationBuilder.CreateIndex(
                name: "IX_ExamResults_TenantId_ExamId_StudentId",
                table: "ExamResults",
                columns: new[] { "TenantId", "ExamId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_TenantId_CourseId",
                table: "Enrollments",
                columns: new[] { "TenantId", "CourseId" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_TenantId_CreatedAt",
                table: "Courses",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_TenantId_MebApprovalStatus",
                table: "Courses",
                columns: new[] { "TenantId", "MebApprovalStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_Courses_TenantId_MebGroupId",
                table: "Courses",
                columns: new[] { "TenantId", "MebGroupId" });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_TenantId_ScheduleSlotId_CreatedAt",
                table: "Attendances",
                columns: new[] { "TenantId", "ScheduleSlotId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AiQueries_TenantId_CreatedAt",
                table: "AiQueries",
                columns: new[] { "TenantId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserTenants_TenantId",
                table: "UserTenants",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenants_UserId_TenantId",
                table: "UserTenants",
                columns: new[] { "UserId", "TenantId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserTenants");

            migrationBuilder.DropTable(
                name: "Tenants");

            migrationBuilder.DropIndex(
                name: "IX_Students_TenantId_CreatedAt",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Students_TenantId_TcKimlikNo",
                table: "Students");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_TenantId_ScheduledAt",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_TenantId_Status",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_Reminders_TenantId_Type_Channel",
                table: "Reminders");

            migrationBuilder.DropIndex(
                name: "IX_Payments_TenantId_Status_DueDate",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_MebGroups_TenantId_Year_Month_GroupNo_Branch",
                table: "MebGroups");

            migrationBuilder.DropIndex(
                name: "IX_MebbisSyncLogs_TenantId_CreatedAt",
                table: "MebbisSyncLogs");

            migrationBuilder.DropIndex(
                name: "IX_Exams_TenantId_ExamDate",
                table: "Exams");

            migrationBuilder.DropIndex(
                name: "IX_ExamResults_TenantId_ExamId_StudentId",
                table: "ExamResults");

            migrationBuilder.DropIndex(
                name: "IX_Enrollments_TenantId_CourseId",
                table: "Enrollments");

            migrationBuilder.DropIndex(
                name: "IX_Courses_TenantId_CreatedAt",
                table: "Courses");

            migrationBuilder.DropIndex(
                name: "IX_Courses_TenantId_MebApprovalStatus",
                table: "Courses");

            migrationBuilder.DropIndex(
                name: "IX_Courses_TenantId_MebGroupId",
                table: "Courses");

            migrationBuilder.DropIndex(
                name: "IX_Attendances_TenantId_ScheduleSlotId_CreatedAt",
                table: "Attendances");

            migrationBuilder.DropIndex(
                name: "IX_AiQueries_TenantId_CreatedAt",
                table: "AiQueries");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ScheduleSlots");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Reminders");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "MebbisTransferJobs");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "MebbisTransferJobs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "MebbisTransferItems");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "MebbisTransferItems");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "MebbisSyncLogs");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "MebbisSyncLogs");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Exams");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "ExamResults");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Enrollments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Enrollments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Enrollments");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Attendances");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "AiQueries");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "AiQueries");

            migrationBuilder.AlterColumn<string>(
                name: "Type",
                table: "Reminders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "Channel",
                table: "Reminders",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Payments",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.AlterColumn<string>(
                name: "MebApprovalStatus",
                table: "Courses",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");

            migrationBuilder.CreateIndex(
                name: "IX_Students_TcKimlikNo",
                table: "Students",
                column: "TcKimlikNo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_ScheduledAt",
                table: "Reminders",
                column: "ScheduledAt");

            migrationBuilder.CreateIndex(
                name: "IX_Reminders_Status",
                table: "Reminders",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_MebGroups_Year_Month_GroupNo_Branch",
                table: "MebGroups",
                columns: new[] { "Year", "Month", "GroupNo", "Branch" },
                unique: true,
                filter: "[Branch] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_MebbisSyncLogs_CreatedAt",
                table: "MebbisSyncLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AiQueries_CreatedAt",
                table: "AiQueries",
                column: "CreatedAt");
        }
    }
}

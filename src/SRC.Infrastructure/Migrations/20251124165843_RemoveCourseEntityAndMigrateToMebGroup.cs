using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRC.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCourseEntityAndMigrateToMebGroup : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Constraint'leri silmeden önce var olup olmadığını kontrol et
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Certificates_Courses_CourseId')
                    ALTER TABLE [Certificates] DROP CONSTRAINT [FK_Certificates_Courses_CourseId];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Certificates_Courses_CourseId1')
                    ALTER TABLE [Certificates] DROP CONSTRAINT [FK_Certificates_Courses_CourseId1];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Enrollments_Courses_CourseId')
                    ALTER TABLE [Enrollments] DROP CONSTRAINT [FK_Enrollments_Courses_CourseId];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Exams_Courses_CourseId')
                    ALTER TABLE [Exams] DROP CONSTRAINT [FK_Exams_Courses_CourseId];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_MebbisTransferJobs_Courses_CourseId')
                    ALTER TABLE [MebbisTransferJobs] DROP CONSTRAINT [FK_MebbisTransferJobs_Courses_CourseId];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ScheduleSlots_Courses_CourseId')
                    ALTER TABLE [ScheduleSlots] DROP CONSTRAINT [FK_ScheduleSlots_Courses_CourseId];
            ");

            // Index'i silmeden önce var olup olmadığını kontrol et
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Certificates_CourseId1' AND object_id = OBJECT_ID('Certificates'))
                    DROP INDEX [IX_Certificates_CourseId1] ON [Certificates];
            ");

            // Column'u silmeden önce var olup olmadığını kontrol et
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId1' AND object_id = OBJECT_ID('Certificates'))
                    ALTER TABLE [Certificates] DROP COLUMN [CourseId1];
            ");

            // Courses tablosunu silmeden önce var olup olmadığını kontrol et
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Courses')
                    DROP TABLE [Courses];
            ");

            // Column ve Index rename işlemleri - sadece varsa yap
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId' AND object_id = OBJECT_ID('ScheduleSlots'))
                BEGIN
                    EXEC sp_rename 'ScheduleSlots.CourseId', 'MebGroupId', 'COLUMN';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ScheduleSlots_CourseId' AND object_id = OBJECT_ID('ScheduleSlots'))
                BEGIN
                    EXEC sp_rename 'ScheduleSlots.IX_ScheduleSlots_CourseId', 'IX_ScheduleSlots_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId' AND object_id = OBJECT_ID('MebbisTransferJobs'))
                BEGIN
                    EXEC sp_rename 'MebbisTransferJobs.CourseId', 'MebGroupId', 'COLUMN';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MebbisTransferJobs_CourseId' AND object_id = OBJECT_ID('MebbisTransferJobs'))
                BEGIN
                    EXEC sp_rename 'MebbisTransferJobs.IX_MebbisTransferJobs_CourseId', 'IX_MebbisTransferJobs_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId' AND object_id = OBJECT_ID('Exams'))
                BEGIN
                    EXEC sp_rename 'Exams.CourseId', 'MebGroupId', 'COLUMN';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Exams_CourseId' AND object_id = OBJECT_ID('Exams'))
                BEGIN
                    EXEC sp_rename 'Exams.IX_Exams_CourseId', 'IX_Exams_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId' AND object_id = OBJECT_ID('Enrollments'))
                BEGIN
                    EXEC sp_rename 'Enrollments.CourseId', 'MebGroupId', 'COLUMN';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Enrollments_TenantId_CourseId' AND object_id = OBJECT_ID('Enrollments'))
                BEGIN
                    EXEC sp_rename 'Enrollments.IX_Enrollments_TenantId_CourseId', 'IX_Enrollments_TenantId_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Enrollments_CourseId' AND object_id = OBJECT_ID('Enrollments'))
                BEGIN
                    EXEC sp_rename 'Enrollments.IX_Enrollments_CourseId', 'IX_Enrollments_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'CourseId' AND object_id = OBJECT_ID('Certificates'))
                BEGIN
                    EXEC sp_rename 'Certificates.CourseId', 'MebGroupId', 'COLUMN';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Certificates_TenantId_CourseId' AND object_id = OBJECT_ID('Certificates'))
                BEGIN
                    EXEC sp_rename 'Certificates.IX_Certificates_TenantId_CourseId', 'IX_Certificates_TenantId_MebGroupId', 'INDEX';
                END
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Certificates_CourseId' AND object_id = OBJECT_ID('Certificates'))
                BEGIN
                    EXEC sp_rename 'Certificates.IX_Certificates_CourseId', 'IX_Certificates_MebGroupId', 'INDEX';
                END
            ");

            // MebGroups tablosuna kolonlar ekle - sadece yoksa
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'ApprovalAt' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [ApprovalAt] datetime2 NULL;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'ApprovalNotes' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [ApprovalNotes] nvarchar(max) NULL;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'IsMixed' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [IsMixed] bit NOT NULL DEFAULT 0;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'MebApprovalStatus' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [MebApprovalStatus] nvarchar(450) NOT NULL DEFAULT '';
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'MixedTypes' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [MixedTypes] nvarchar(max) NULL;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'PlannedHours' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [PlannedHours] int NOT NULL DEFAULT 0;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE name = 'SrcType' AND object_id = OBJECT_ID('MebGroups'))
                    ALTER TABLE [MebGroups] ADD [SrcType] int NOT NULL DEFAULT 0;
            ");

            // Index oluştur - sadece yoksa
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MebGroups_TenantId_MebApprovalStatus' AND object_id = OBJECT_ID('MebGroups'))
                    CREATE INDEX [IX_MebGroups_TenantId_MebApprovalStatus] ON [MebGroups] ([TenantId], [MebApprovalStatus]);
            ");

            // Foreign key'leri ekle - sadece yoksa
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Certificates_MebGroups_MebGroupId')
                    ALTER TABLE [Certificates] ADD CONSTRAINT [FK_Certificates_MebGroups_MebGroupId] 
                    FOREIGN KEY ([MebGroupId]) REFERENCES [MebGroups] ([Id]) ON DELETE NO ACTION;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Enrollments_MebGroups_MebGroupId')
                    ALTER TABLE [Enrollments] ADD CONSTRAINT [FK_Enrollments_MebGroups_MebGroupId] 
                    FOREIGN KEY ([MebGroupId]) REFERENCES [MebGroups] ([Id]) ON DELETE NO ACTION;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Exams_MebGroups_MebGroupId')
                    ALTER TABLE [Exams] ADD CONSTRAINT [FK_Exams_MebGroups_MebGroupId] 
                    FOREIGN KEY ([MebGroupId]) REFERENCES [MebGroups] ([Id]) ON DELETE CASCADE;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_MebbisTransferJobs_MebGroups_MebGroupId')
                    ALTER TABLE [MebbisTransferJobs] ADD CONSTRAINT [FK_MebbisTransferJobs_MebGroups_MebGroupId] 
                    FOREIGN KEY ([MebGroupId]) REFERENCES [MebGroups] ([Id]) ON DELETE CASCADE;
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ScheduleSlots_MebGroups_MebGroupId')
                    ALTER TABLE [ScheduleSlots] ADD CONSTRAINT [FK_ScheduleSlots_MebGroups_MebGroupId] 
                    FOREIGN KEY ([MebGroupId]) REFERENCES [MebGroups] ([Id]) ON DELETE CASCADE;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Certificates_MebGroups_MebGroupId",
                table: "Certificates");

            migrationBuilder.DropForeignKey(
                name: "FK_Enrollments_MebGroups_MebGroupId",
                table: "Enrollments");

            migrationBuilder.DropForeignKey(
                name: "FK_Exams_MebGroups_MebGroupId",
                table: "Exams");

            migrationBuilder.DropForeignKey(
                name: "FK_MebbisTransferJobs_MebGroups_MebGroupId",
                table: "MebbisTransferJobs");

            migrationBuilder.DropForeignKey(
                name: "FK_ScheduleSlots_MebGroups_MebGroupId",
                table: "ScheduleSlots");

            migrationBuilder.DropIndex(
                name: "IX_MebGroups_TenantId_MebApprovalStatus",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "ApprovalAt",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "ApprovalNotes",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "IsMixed",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "MebApprovalStatus",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "MixedTypes",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "PlannedHours",
                table: "MebGroups");

            migrationBuilder.DropColumn(
                name: "SrcType",
                table: "MebGroups");

            migrationBuilder.RenameColumn(
                name: "MebGroupId",
                table: "ScheduleSlots",
                newName: "CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_ScheduleSlots_MebGroupId",
                table: "ScheduleSlots",
                newName: "IX_ScheduleSlots_CourseId");

            migrationBuilder.RenameColumn(
                name: "MebGroupId",
                table: "MebbisTransferJobs",
                newName: "CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_MebbisTransferJobs_MebGroupId",
                table: "MebbisTransferJobs",
                newName: "IX_MebbisTransferJobs_CourseId");

            migrationBuilder.RenameColumn(
                name: "MebGroupId",
                table: "Exams",
                newName: "CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_Exams_MebGroupId",
                table: "Exams",
                newName: "IX_Exams_CourseId");

            migrationBuilder.RenameColumn(
                name: "MebGroupId",
                table: "Enrollments",
                newName: "CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_Enrollments_TenantId_MebGroupId",
                table: "Enrollments",
                newName: "IX_Enrollments_TenantId_CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_Enrollments_MebGroupId",
                table: "Enrollments",
                newName: "IX_Enrollments_CourseId");

            migrationBuilder.RenameColumn(
                name: "MebGroupId",
                table: "Certificates",
                newName: "CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_Certificates_TenantId_MebGroupId",
                table: "Certificates",
                newName: "IX_Certificates_TenantId_CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_Certificates_MebGroupId",
                table: "Certificates",
                newName: "IX_Certificates_CourseId");

            migrationBuilder.AddColumn<int>(
                name: "CourseId1",
                table: "Certificates",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Courses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MebGroupId = table.Column<int>(type: "int", nullable: false),
                    ApprovalAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsMixed = table.Column<bool>(type: "bit", nullable: false),
                    MebApprovalStatus = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    MixedTypes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PlannedHours = table.Column<int>(type: "int", nullable: false),
                    SrcType = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Courses_MebGroups_MebGroupId",
                        column: x => x.MebGroupId,
                        principalTable: "MebGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_CourseId1",
                table: "Certificates",
                column: "CourseId1");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_MebGroupId",
                table: "Courses",
                column: "MebGroupId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Certificates_Courses_CourseId",
                table: "Certificates",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Certificates_Courses_CourseId1",
                table: "Certificates",
                column: "CourseId1",
                principalTable: "Courses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Enrollments_Courses_CourseId",
                table: "Enrollments",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Exams_Courses_CourseId",
                table: "Exams",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_MebbisTransferJobs_Courses_CourseId",
                table: "MebbisTransferJobs",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ScheduleSlots_Courses_CourseId",
                table: "ScheduleSlots",
                column: "CourseId",
                principalTable: "Courses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

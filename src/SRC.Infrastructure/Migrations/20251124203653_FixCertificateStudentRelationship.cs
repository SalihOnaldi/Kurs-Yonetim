using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRC.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixCertificateStudentRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // StudentId1 kolonunu ve ilişkisini kaldır (varsa)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Certificates_Students_StudentId1')
                    ALTER TABLE [Certificates] DROP CONSTRAINT [FK_Certificates_Students_StudentId1];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Certificates_StudentId1' AND object_id = OBJECT_ID('Certificates'))
                    DROP INDEX [IX_Certificates_StudentId1] ON [Certificates];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.columns WHERE name = 'StudentId1' AND object_id = OBJECT_ID('Certificates'))
                    ALTER TABLE [Certificates] DROP COLUMN [StudentId1];
            ");
            
            // Payment-Enrollment foreign key'i güncelle (varsa)
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Payments_Enrollments_EnrollmentId')
                    ALTER TABLE [Payments] DROP CONSTRAINT [FK_Payments_Enrollments_EnrollmentId];
            ");

            migrationBuilder.CreateTable(
                name: "PasswordResetTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Channel = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsUsed = table.Column<bool>(type: "bit", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResetTokens", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_ExpiresAt",
                table: "PasswordResetTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResetTokens_Username_Token_IsUsed",
                table: "PasswordResetTokens",
                columns: new[] { "Username", "Token", "IsUsed" });

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Enrollments_EnrollmentId",
                table: "Payments",
                column: "EnrollmentId",
                principalTable: "Enrollments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Payments_Enrollments_EnrollmentId",
                table: "Payments");

            migrationBuilder.DropTable(
                name: "PasswordResetTokens");

            migrationBuilder.AddColumn<int>(
                name: "StudentId1",
                table: "Certificates",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_StudentId1",
                table: "Certificates",
                column: "StudentId1");

            migrationBuilder.AddForeignKey(
                name: "FK_Certificates_Students_StudentId1",
                table: "Certificates",
                column: "StudentId1",
                principalTable: "Students",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Payments_Enrollments_EnrollmentId",
                table: "Payments",
                column: "EnrollmentId",
                principalTable: "Enrollments",
                principalColumn: "Id");
        }
    }
}

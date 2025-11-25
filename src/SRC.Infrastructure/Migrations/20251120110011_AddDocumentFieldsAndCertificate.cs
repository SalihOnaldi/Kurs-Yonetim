using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRC.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentFieldsAndCertificate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CriminalRecordDate",
                table: "StudentDocuments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CriminalRecordIssuingInstitution",
                table: "StudentDocuments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CriminalRecordNumber",
                table: "StudentDocuments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EducationDocDate",
                table: "StudentDocuments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EducationDocIssuingInstitution",
                table: "StudentDocuments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EducationDocNumber",
                table: "StudentDocuments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Certificates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudentId = table.Column<int>(type: "int", nullable: false),
                    CourseId = table.Column<int>(type: "int", nullable: false),
                    WrittenExamId = table.Column<int>(type: "int", nullable: false),
                    PracticalExamId = table.Column<int>(type: "int", nullable: false),
                    CertificateNumber = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    IssueDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RevokeReason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TenantId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Certificates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Certificates_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Certificates_Exams_PracticalExamId",
                        column: x => x.PracticalExamId,
                        principalTable: "Exams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Certificates_Exams_WrittenExamId",
                        column: x => x.WrittenExamId,
                        principalTable: "Exams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Certificates_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SrcCourseTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SrcType = table.Column<int>(type: "int", nullable: false),
                    MixedTypes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    SubjectCode = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    SubjectName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RequiredHours = table.Column<int>(type: "int", nullable: false),
                    Order = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    TotalRequiredHours = table.Column<int>(type: "int", nullable: false),
                    TenantId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SrcCourseTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_CourseId",
                table: "Certificates",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_PracticalExamId",
                table: "Certificates",
                column: "PracticalExamId");

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_StudentId",
                table: "Certificates",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TenantId_CertificateNumber",
                table: "Certificates",
                columns: new[] { "TenantId", "CertificateNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TenantId_CourseId",
                table: "Certificates",
                columns: new[] { "TenantId", "CourseId" });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_TenantId_StudentId",
                table: "Certificates",
                columns: new[] { "TenantId", "StudentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_WrittenExamId",
                table: "Certificates",
                column: "WrittenExamId");

            migrationBuilder.CreateIndex(
                name: "IX_SrcCourseTemplates_TenantId_SrcType_Order",
                table: "SrcCourseTemplates",
                columns: new[] { "TenantId", "SrcType", "Order" });

            migrationBuilder.CreateIndex(
                name: "IX_SrcCourseTemplates_TenantId_SrcType_SubjectCode",
                table: "SrcCourseTemplates",
                columns: new[] { "TenantId", "SrcType", "SubjectCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Certificates");

            migrationBuilder.DropTable(
                name: "SrcCourseTemplates");

            migrationBuilder.DropColumn(
                name: "CriminalRecordDate",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "CriminalRecordIssuingInstitution",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "CriminalRecordNumber",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "EducationDocDate",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "EducationDocIssuingInstitution",
                table: "StudentDocuments");

            migrationBuilder.DropColumn(
                name: "EducationDocNumber",
                table: "StudentDocuments");
        }
    }
}

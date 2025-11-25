using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SRC.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSelectedSrcCoursesToStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SelectedSrcCourses",
                table: "Students",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SelectedSrcCourses",
                table: "Students");
        }
    }
}

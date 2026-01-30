using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentFieldsToCustomer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DocumentType",
                table: "Customers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentNumber",
                table: "Customers",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DocumentType",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "DocumentNumber",
                table: "Customers");
        }
    }
}

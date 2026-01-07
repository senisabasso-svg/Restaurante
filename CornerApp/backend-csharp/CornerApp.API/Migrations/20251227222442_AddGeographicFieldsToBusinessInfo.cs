using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddGeographicFieldsToBusinessInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CityName",
                table: "BusinessInfo",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MaxLatitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MaxLongitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MinLatitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "MinLongitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CityName",
                table: "BusinessInfo");

            migrationBuilder.DropColumn(
                name: "MaxLatitude",
                table: "BusinessInfo");

            migrationBuilder.DropColumn(
                name: "MaxLongitude",
                table: "BusinessInfo");

            migrationBuilder.DropColumn(
                name: "MinLatitude",
                table: "BusinessInfo");

            migrationBuilder.DropColumn(
                name: "MinLongitude",
                table: "BusinessInfo");
        }
    }
}

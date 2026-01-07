using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddStoreCoordinatesToBusinessInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "StoreLatitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "StoreLongitude",
                table: "BusinessInfo",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StoreLatitude",
                table: "BusinessInfo");

            migrationBuilder.DropColumn(
                name: "StoreLongitude",
                table: "BusinessInfo");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDeliveryCostsAndTimes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BaseDeliveryCost",
                table: "DeliveryZoneConfigs");

            migrationBuilder.DropColumn(
                name: "BaseDeliveryTimeMinutes",
                table: "DeliveryZoneConfigs");

            migrationBuilder.DropColumn(
                name: "CostPerKm",
                table: "DeliveryZoneConfigs");

            migrationBuilder.DropColumn(
                name: "ShowDeliveryCost",
                table: "DeliveryZoneConfigs");

            migrationBuilder.DropColumn(
                name: "TimePerKmMinutes",
                table: "DeliveryZoneConfigs");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "BaseDeliveryCost",
                table: "DeliveryZoneConfigs",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "BaseDeliveryTimeMinutes",
                table: "DeliveryZoneConfigs",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPerKm",
                table: "DeliveryZoneConfigs",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "ShowDeliveryCost",
                table: "DeliveryZoneConfigs",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "TimePerKmMinutes",
                table: "DeliveryZoneConfigs",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}

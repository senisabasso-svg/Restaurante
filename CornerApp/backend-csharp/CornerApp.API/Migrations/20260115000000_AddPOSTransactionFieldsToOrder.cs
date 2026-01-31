using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPOSTransactionFieldsToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "POSTransactionId",
                table: "Orders",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "POSTransactionIdString",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "POSTransactionDateTime",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "POSResponse",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "POSTransactionId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSTransactionIdString",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSTransactionDateTime",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSResponse",
                table: "Orders");
        }
    }
}

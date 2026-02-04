using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPOSReverseFieldsToOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "POSReverseResponse",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "POSReverseTransactionId",
                table: "Orders",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "POSReverseTransactionIdString",
                table: "Orders",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "POSReversedAt",
                table: "Orders",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "POSReverseResponse",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSReverseTransactionId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSReverseTransactionIdString",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "POSReversedAt",
                table: "Orders");
        }
    }
}

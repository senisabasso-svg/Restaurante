using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSpaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Spaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Spaces", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_Name",
                table: "Spaces",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Spaces_IsActive",
                table: "Spaces",
                column: "IsActive");

            // Agregar columna SpaceId a Tables
            migrationBuilder.AddColumn<int>(
                name: "SpaceId",
                table: "Tables",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tables_SpaceId",
                table: "Tables",
                column: "SpaceId");

            migrationBuilder.AddForeignKey(
                name: "FK_Tables_Spaces_SpaceId",
                table: "Tables",
                column: "SpaceId",
                principalTable: "Spaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Tables_Spaces_SpaceId",
                table: "Tables");

            migrationBuilder.DropIndex(
                name: "IX_Tables_SpaceId",
                table: "Tables");

            migrationBuilder.DropColumn(
                name: "SpaceId",
                table: "Tables");

            migrationBuilder.DropTable(
                name: "Spaces");
        }
    }
}


using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryToOrderItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Solo agregar las columnas de categoría a OrderItems
            // Las demás columnas y tablas ya existen en migraciones anteriores
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "OrderItems",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CategoryName",
                table: "OrderItems",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Solo eliminar las columnas de categoría que agregamos
            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "CategoryName",
                table: "OrderItems");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class MakeDeliveryPersonEmailNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DeliveryPersons_Email",
                table: "DeliveryPersons");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "DeliveryPersons",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            // Convertir strings vacíos a NULL después de hacer la columna nullable
            migrationBuilder.Sql(@"
                UPDATE DeliveryPersons 
                SET Email = NULL 
                WHERE Email = '' OR Email IS NULL
            ");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryPersons_Email",
                table: "DeliveryPersons",
                column: "Email",
                unique: true,
                filter: "[Email] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DeliveryPersons_Email",
                table: "DeliveryPersons");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "DeliveryPersons",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryPersons_Email",
                table: "DeliveryPersons",
                column: "Email",
                unique: true);
        }
    }
}

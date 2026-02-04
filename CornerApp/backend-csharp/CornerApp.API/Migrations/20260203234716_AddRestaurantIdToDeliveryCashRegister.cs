using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CornerApp.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantIdToDeliveryCashRegister : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DeliveryCashRegisters_DeliveryPersonId_IsOpen",
                table: "DeliveryCashRegisters");

            // Agregar columna como nullable primero
            migrationBuilder.AddColumn<int>(
                name: "RestaurantId",
                table: "DeliveryCashRegisters",
                type: "int",
                nullable: true);

            // Actualizar registros existentes: obtener RestaurantId del DeliveryPerson asociado
            migrationBuilder.Sql(@"
                UPDATE dcr
                SET dcr.RestaurantId = dp.RestaurantId
                FROM DeliveryCashRegisters dcr
                INNER JOIN DeliveryPersons dp ON dcr.DeliveryPersonId = dp.Id
                WHERE dcr.RestaurantId IS NULL;
            ");

            // Si hay registros sin RestaurantId válido, asignar al restaurante por defecto (ID 1)
            migrationBuilder.Sql(@"
                UPDATE DeliveryCashRegisters
                SET RestaurantId = 1
                WHERE RestaurantId IS NULL OR RestaurantId = 0;
            ");

            // Asegurar que existe el restaurante por defecto
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM Restaurants WHERE Id = 1)
                BEGIN
                    SET IDENTITY_INSERT Restaurants ON;
                    INSERT INTO Restaurants (Id, Name, Description, IsActive, CreatedAt, Identifier)
                    VALUES (1, 'Restaurante Principal', 'Restaurante principal del sistema', 1, GETUTCDATE(), 'default');
                    SET IDENTITY_INSERT Restaurants OFF;
                END
            ");

            // Hacer la columna NOT NULL
            migrationBuilder.AlterColumn<int>(
                name: "RestaurantId",
                table: "DeliveryCashRegisters",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryCashRegisters_RestaurantId",
                table: "DeliveryCashRegisters",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryCashRegisters_RestaurantId_DeliveryPersonId_IsOpen",
                table: "DeliveryCashRegisters",
                columns: new[] { "RestaurantId", "DeliveryPersonId", "IsOpen" });

            migrationBuilder.AddForeignKey(
                name: "FK_DeliveryCashRegisters_Restaurants_RestaurantId",
                table: "DeliveryCashRegisters",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DeliveryCashRegisters_Restaurants_RestaurantId",
                table: "DeliveryCashRegisters");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryCashRegisters_RestaurantId",
                table: "DeliveryCashRegisters");

            migrationBuilder.DropIndex(
                name: "IX_DeliveryCashRegisters_RestaurantId_DeliveryPersonId_IsOpen",
                table: "DeliveryCashRegisters");

            migrationBuilder.DropColumn(
                name: "RestaurantId",
                table: "DeliveryCashRegisters");

            migrationBuilder.CreateIndex(
                name: "IX_DeliveryCashRegisters_DeliveryPersonId_IsOpen",
                table: "DeliveryCashRegisters",
                columns: new[] { "DeliveryPersonId", "IsOpen" });
        }
    }
}

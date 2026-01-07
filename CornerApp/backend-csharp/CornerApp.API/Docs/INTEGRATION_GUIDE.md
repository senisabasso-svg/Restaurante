# Guía de Integración con Base de Datos

## ✅ Entity Framework Core Configurado

Tu backend ahora usa **Entity Framework Core** con **SQLite** (desarrollo) y está listo para **SQL Server** (producción).

## 🚀 Inicio Rápido

1. **Restaura paquetes**:
   ```bash
   cd backend-csharp/CornerApp.API
   dotnet restore
   ```

2. **Ejecuta la aplicación**:
   ```bash
   dotnet run
   ```

   Las migraciones se aplican automáticamente al iniciar. La base de datos SQLite se creará en `cornerapp.db`.

## 📊 Estructura de Base de Datos

### Tabla: Products
- `Id` (int, PK)
- `Name` (string, max 200)
- `Category` (string, max 50)
- `Description` (string, max 500)
- `Price` (decimal)
- `Image` (string, max 500)

### Tabla: Orders
- `Id` (int, PK)
- `CustomerName` (string, required, max 200)
- `CustomerPhone` (string, max 50)
- `CustomerAddress` (string, max 500)
- `CustomerEmail` (string, max 200)
- `Total` (decimal)
- `PaymentMethod` (string, max 50)
- `Status` (string, max 50) - pending, confirmed, preparing, delivering, completed, cancelled
- `EstimatedDeliveryMinutes` (int)
- `CreatedAt` (DateTime)
- `UpdatedAt` (DateTime?)
- `MercadoPagoPreferenceId` (string, nullable, max 200)
- `MercadoPagoPaymentId` (string, nullable, max 200)

### Tabla: OrderItems
- `Id` (int, PK)
- `OrderId` (int, FK)
- `ProductId` (int)
- `ProductName` (string, max 200)
- `UnitPrice` (decimal)
- `Quantity` (int)

## 🔄 Migraciones

### Crear nueva migración
```bash
dotnet ef migrations add NombreDeLaMigracion
```

### Aplicar migraciones manualmente
```bash
dotnet ef database update
```

### Ver migraciones pendientes
```bash
dotnet ef migrations list
```

## 🔧 Cambiar a SQL Server

1. **Actualiza `appsettings.json`**:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=TU_SERVIDOR;Database=CornerAppDb;User Id=usuario;Password=password;TrustServerCertificate=true;"
   }
   ```

2. **En `Program.cs`**, cambia:
   ```csharp
   // Comentar SQLite
   // builder.Services.AddDbContext<ApplicationDbContext>(options =>
   //     options.UseSqlite(connectionString));

   // Descomentar SQL Server
   builder.Services.AddDbContext<ApplicationDbContext>(options =>
       options.UseSqlServer(connectionString));
   ```

3. **Aplica migraciones**:
   ```bash
   dotnet ef database update
   ```

## 📝 Endpoints Disponibles

### Productos
- `GET /api/products` - Obtener todos los productos
- `GET /api/products/{id}` - Obtener producto por ID

### Pedidos
- `POST /api/orders` - Crear nuevo pedido
- `GET /api/orders` - Obtener todos los pedidos
- `GET /api/orders/{id}` - Obtener pedido por ID
- `PATCH /api/orders/{id}/status` - Actualizar estado del pedido
- `PATCH /api/orders/{id}/payment` - Actualizar información de pago

## 🧪 Probar la Base de Datos

### Con Swagger
1. Ejecuta: `dotnet run`
2. Abre: http://localhost:5000/swagger
3. Prueba los endpoints

### Verificar datos guardados

**SQLite**:
- El archivo `cornerapp.db` estará en la raíz del proyecto
- Usa DB Browser for SQLite para ver los datos

**SQL Server**:
- Usa SQL Server Management Studio
- Conecta y consulta las tablas

## 💡 Datos Iniciales

Los productos se crean automáticamente la primera vez que llamas a `GET /api/products` si la tabla está vacía.

## 🐛 Troubleshooting

### Error: "No se puede crear la base de datos"
- Verifica permisos de escritura en la carpeta del proyecto
- Para SQL Server, verifica que el servidor esté corriendo

### Error: "Migrations pendientes"
- Ejecuta: `dotnet ef database update`

### Error: "Tabla ya existe"
- Si cambias de SQLite a SQL Server, elimina el archivo `cornerapp.db` primero

## 📚 Recursos

- [Documentación EF Core](https://learn.microsoft.com/en-us/ef/core/)
- [SQLite en .NET](https://learn.microsoft.com/en-us/dotnet/standard/data/sqlite/)
- [SQL Server en .NET](https://learn.microsoft.com/en-us/ef/core/providers/sql-server/)


# Configuración de SQL Server con Management Studio

## 🔧 Configuración Inicial

### Opción 1: SQL Server en servidor "ROG" (Configurado)

Ya está configurado en `appsettings.json`:
```json
"DefaultConnection": "Server=ROG;Database=CornerAppDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=true"
```

El servidor **ROG** debe estar ejecutándose y accesible.

### Opción 2: SQL Server con Instancia Específica

Si tu servidor ROG usa una instancia específica (como SQLEXPRESS):

```json
"DefaultConnection": "Server=ROG\\SQLEXPRESS;Database=CornerAppDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=true"
```

### Opción 3: SQL Server con Autenticación SQL

Si necesitas usar usuario/contraseña en lugar de Windows Authentication:

```json
"DefaultConnection": "Server=ROG;Database=CornerAppDb;User Id=usuario;Password=contraseña;TrustServerCertificate=true"
```

## 📊 Conectar con SQL Server Management Studio (SSMS)

### 1. Descargar SSMS
Si no lo tienes, descárgalo desde:
https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms

### 2. Conectar al servidor ROG
1. Abre **SQL Server Management Studio**
2. En **Server name**, escribe:
   ```
   ROG
   ```
   O si usa una instancia específica:
   ```
   ROG\SQLEXPRESS
   ```
   O con puerto:
   ```
   ROG,1433
   ```
3. Autenticación: **Windows Authentication** (o SQL Server Authentication si está configurado)
4. Click **Connect**

### 3. Ver la Base de Datos
1. Una vez conectado, expande **Databases**
2. La base de datos **CornerAppDb** se creará automáticamente al ejecutar la app
3. Si no aparece, ejecuta primero:
   ```bash
   dotnet ef database update
   ```

## 🚀 Pasos para Crear la Base de Datos

### Método 1: Automático (Recomendado)
1. Ejecuta el backend:
   ```bash
   cd backend-csharp\CornerApp.API
   dotnet run
   ```
2. Las migraciones se aplican automáticamente
3. Abre SSMS y verás la base de datos `CornerAppDb`

### Método 2: Manual
1. Crea las migraciones:
   ```bash
   cd backend-csharp\CornerApp.API
   dotnet ef migrations add InitialCreate
   ```
2. Aplica las migraciones:
   ```bash
   dotnet ef database update
   ```

## 📋 Tablas que se Crearán

- **Categories** - Categorías de productos
- **Products** - Productos del menú
- **Customers** - Clientes registrados
- **Orders** - Pedidos realizados
- **OrderItems** - Items de cada pedido

## 🔍 Verificar la Base de Datos

En SSMS, ejecuta:
```sql
USE CornerAppDb;
GO

-- Ver todas las tablas
SELECT * FROM INFORMATION_SCHEMA.TABLES;

-- Ver productos
SELECT * FROM Products;

-- Ver categorías
SELECT * FROM Categories;

-- Ver pedidos
SELECT * FROM Orders;

-- Ver clientes
SELECT * FROM Customers;
```

## 🛠️ Configuración Avanzada

### Cambiar el Nombre de la Base de Datos

Edita `appsettings.json`:
```json
"DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=MiBaseDeDatos;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=true"
```

### Usar SQL Server en un Servidor Remoto

```json
"DefaultConnection": "Server=192.168.1.100,1433;Database=CornerAppDb;User Id=usuario;Password=contraseña;TrustServerCertificate=true"
```

### Configuración con Entity Framework

El código ya está configurado en `Program.cs`:
```csharp
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

## 🐛 Solución de Problemas

### Error: "Cannot open database"
- Verifica que SQL Server esté corriendo
- Verifica la cadena de conexión
- Asegúrate de tener permisos para crear bases de datos

### Error: "Login failed for user"
- Verifica las credenciales
- Para LocalDB, usa Windows Authentication

### Error: "MultipleActiveResultSets" requerido
- Ya está incluido en la connection string por defecto

### Servidor ROG no responde
1. Verifica que el servicio SQL Server esté corriendo:
   - Abre **Services** (services.msc)
   - Busca **SQL Server (MSSQLSERVER)** o tu instancia
   - Asegúrate de que esté **Running**
   
2. Verifica el nombre del servidor:
   - En SSMS, intenta conectarte manualmente
   - Puede ser "ROG\\SQLEXPRESS" si es Express
   - O "ROG,1433" si usa puerto específico
   
3. Verifica el firewall:
   - Asegúrate de que el puerto 1433 esté abierto (si usa TCP/IP)

## 📝 Scripts SQL Útiles

### Crear Base de Datos Manualmente
```sql
CREATE DATABASE CornerAppDb;
GO
```

### Ver Tamaño de la Base de Datos
```sql
USE CornerAppDb;
GO
EXEC sp_spaceused;
```

### Backup de la Base de Datos
En SSMS:
1. Click derecho en `CornerAppDb`
2. **Tasks** → **Back Up...**
3. Configura y ejecuta

## ✅ Checklist

- [ ] SQL Server o LocalDB instalado
- [ ] SSMS instalado y conectado
- [ ] Connection string configurada en `appsettings.json`
- [ ] `Program.cs` configurado para usar SQL Server
- [ ] Migraciones creadas (`dotnet ef migrations add InitialCreate`)
- [ ] Base de datos creada (automático o manual)
- [ ] Tablas visibles en SSMS

## 🎯 Ventajas de SQL Server vs SQLite

- ✅ Mejor para producción
- ✅ Manejo concurrente de usuarios
- ✅ Herramientas avanzadas (SSMS)
- ✅ Facilita mantenimiento y backup
- ✅ Escalable y robusto

## 📚 Recursos

- [SQL Server Downloads](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
- [SSMS Download](https://learn.microsoft.com/en-us/sql/ssms/download-sql-server-management-studio-ssms)
- [Connection Strings](https://www.connectionstrings.com/sql-server/)


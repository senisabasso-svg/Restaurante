# 🚀 Comandos para Levantar CornerApp en Local

## 📋 Requisitos
- SQL Server instalado y ejecutándose (o usar Docker)
- .NET 8.0 SDK (o superior)
- Node.js y npm

---

## 🎯 Inicio Rápido (2 Terminales)

### Terminal 1: Backend

```powershell
# Navegar al directorio del backend
cd backend-csharp\CornerApp.API

# Restaurar dependencias (solo la primera vez)
dotnet restore

# Ejecutar el backend
dotnet run
```

**El backend estará disponible en:**
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/swagger`
- Health: `http://localhost:5000/health`

---

### Terminal 2: Frontend

```powershell
# Navegar al directorio del frontend
cd frontend

# Instalar dependencias (solo la primera vez)
npm install

# Ejecutar el frontend
npm run dev
```

**El frontend estará disponible en:**
- `http://localhost:3000`

---

## ⚠️ Solución de Problemas

### Error de conexión a SQL Server

Si ves errores como "Cannot open database" o "Login failed", verifica:

1. **Que SQL Server esté ejecutándose:**
   ```powershell
   Get-Service -Name "MSSQLSERVER" | Select-Object Status, Name
   ```

2. **Verificar el nombre del servidor en la configuración:**
   - Archivo: `backend-csharp\CornerApp.API\appsettings.Development.json`
   - Línea 10: `"Server=ROG;Database=CornerAppDb;..."`
   - Cambia `ROG` por el nombre de tu servidor SQL Server

3. **Si no tienes SQL Server, usa Docker:**
   ```powershell
   cd backend-csharp
   docker compose up -d
   ```

### Error de migraciones

Si necesitas aplicar las migraciones de la base de datos:

```powershell
cd backend-csharp\CornerApp.API
dotnet ef database update
```

**Nota:** Si tienes problemas con `dotnet ef`, instala la herramienta:
```powershell
dotnet tool install --global dotnet-ef
```

### El frontend no se conecta al backend

1. Verifica que el backend esté corriendo en `http://localhost:5000`
2. Abre `http://localhost:5000/swagger` para confirmar
3. Revisa la consola del navegador para ver errores de CORS

---

## 📝 Resumen de Comandos

**Backend:**
```powershell
cd backend-csharp\CornerApp.API
dotnet run
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

---

## ✅ Verificar que Todo Funciona

1. **Backend Health Check:**
   - Abre: `http://localhost:5000/health`
   - Debe responder con estado "Healthy"

2. **Swagger UI:**
   - Abre: `http://localhost:5000/swagger`
   - Debe mostrar la documentación de la API

3. **Frontend:**
   - Abre: `http://localhost:3000`
   - Debe cargar el panel de administración

---

## 🐳 Alternativa con Docker (Más Fácil)

Si tienes Docker Desktop instalado:

```powershell
# Terminal 1: Backend con Docker
cd backend-csharp
docker compose up -d

# Terminal 2: Frontend
cd frontend
npm run dev
```

Esto levanta automáticamente:
- SQL Server
- Redis
- RabbitMQ
- API Backend

---

¡Listo! 🎉


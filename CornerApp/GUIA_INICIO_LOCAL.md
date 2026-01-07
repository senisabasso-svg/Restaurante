# 🚀 Guía para Ejecutar CornerApp en Local

Esta guía te ayudará a ejecutar la aplicación CornerApp en tu máquina local.

## 📋 Requisitos Previos

### Opción A: Con Docker (Recomendado - Más Fácil)
- **Docker Desktop** instalado y ejecutándose
- **.NET 8.0 SDK** (solo si quieres ejecutar el backend sin Docker)

### Opción B: Sin Docker
- **.NET 8.0 SDK** instalado
- **SQL Server** instalado y ejecutándose (o SQL Server Express)
- **Node.js** (v18 o superior) y **npm**

---

## 🐳 Opción 1: Ejecutar con Docker (Recomendado)

Esta opción es la más fácil porque Docker se encarga de levantar SQL Server automáticamente.

### Paso 1: Levantar el Backend con Docker

Abre una terminal PowerShell en la raíz del proyecto y ejecuta:

```powershell
cd backend-csharp
docker-compose up -d
```

Esto levantará:
- SQL Server (puerto 1433)
- Redis (puerto 6379)
- RabbitMQ (puerto 5672, UI en 15672)
- API Backend (puerto 5000)

**Verificar que todo está funcionando:**
```powershell
docker-compose ps
```

**Ver logs del backend:**
```powershell
docker-compose logs -f api
```

La API estará disponible en: `http://localhost:5000`
Swagger UI: `http://localhost:5000/swagger`

### Paso 2: Ejecutar el Frontend

Abre una **nueva terminal** y ejecuta:

```powershell
cd frontend
npm install
npm run dev
```

El frontend estará disponible en: `http://localhost:3000`

### Paso 3: (Opcional) Ejecutar la App Móvil

Si quieres ejecutar la app móvil con Expo:

```powershell
# En la raíz del proyecto
npm install
npm start
```

Luego escanea el QR con Expo Go o presiona:
- `a` para Android
- `i` para iOS
- `w` para Web

---

## 💻 Opción 2: Ejecutar sin Docker

### Paso 1: Configurar SQL Server

1. Asegúrate de tener SQL Server instalado y ejecutándose
2. Verifica la cadena de conexión en `backend-csharp/CornerApp.API/appsettings.Development.json`

La cadena de conexión actual es:
```json
"DefaultConnection": "Server=ROG;Database=CornerAppDb;Trusted_Connection=True;..."
```

**Si tu servidor SQL tiene otro nombre**, edita el archivo y cambia `Server=ROG` por el nombre de tu servidor.

### Paso 2: Ejecutar Migraciones de Base de Datos

```powershell
cd backend-csharp/CornerApp.API
dotnet ef database update
```

Si es la primera vez, esto creará la base de datos y todas las tablas.

### Paso 3: Ejecutar el Backend

**Opción A: Usando el script PowerShell (Recomendado)**
```powershell
cd backend-csharp
.\run-api.ps1
```

**Opción B: Manualmente**
```powershell
cd backend-csharp/CornerApp.API
dotnet restore
dotnet run
```

El backend estará disponible en: `http://localhost:5000`
Swagger UI: `http://localhost:5000/swagger`

### Paso 4: Ejecutar el Frontend

Abre una **nueva terminal** y ejecuta:

```powershell
cd frontend
npm install
npm run dev
```

El frontend estará disponible en: `http://localhost:3000`

### Paso 5: (Opcional) Ejecutar la App Móvil

```powershell
# En la raíz del proyecto
npm install
npm start
```

---

## ✅ Verificar que Todo Funciona

1. **Backend**: Abre `http://localhost:5000/swagger` - Deberías ver la documentación de la API
2. **Frontend**: Abre `http://localhost:3000` - Deberías ver el panel de administración
3. **Health Check**: Abre `http://localhost:5000/health` - Debería responder con estado "Healthy"

---

## 🛠️ Solución de Problemas

### El backend no inicia

**Error de conexión a SQL Server:**
- Verifica que SQL Server esté ejecutándose
- Verifica la cadena de conexión en `appsettings.Development.json`
- Si usas Docker, verifica que el contenedor de SQL Server esté corriendo: `docker-compose ps`

**Puerto 5000 ya en uso:**
- Detén otros procesos que usen el puerto 5000
- O cambia el puerto en `appsettings.Development.json` y `vite.config.ts`

### El frontend no se conecta al backend

- Verifica que el backend esté ejecutándose en `http://localhost:5000`
- Verifica la configuración del proxy en `frontend/vite.config.ts`
- Revisa la consola del navegador para ver errores de CORS

### Problemas con Docker

**Ver logs de todos los servicios:**
```powershell
docker-compose logs
```

**Reiniciar todos los servicios:**
```powershell
docker-compose down
docker-compose up -d
```

**Limpiar todo y empezar de nuevo:**
```powershell
docker-compose down -v  # Elimina volúmenes también
docker-compose up -d
```

---

## 📝 Notas Importantes

- El backend debe estar ejecutándose **antes** de iniciar el frontend
- Si cambias la configuración del backend, reinícialo
- Los logs del backend se guardan en `backend-csharp/CornerApp.API/logs/`
- La base de datos se crea automáticamente con las migraciones

---

## 🎯 Resumen Rápido (Docker)

```powershell
# Terminal 1: Backend
cd backend-csharp
docker-compose up -d

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

¡Listo! 🎉


# 🚀 Guía de Despliegue en Render (Gratuito)

Esta guía te ayudará a desplegar tu aplicación CornerApp completa (Frontend, Backend y Base de Datos) en Render de forma gratuita.

## 📋 Requisitos Previos

1. Cuenta en [Render.com](https://render.com) (gratuita)
2. Repositorio Git (GitHub, GitLab o Bitbucket) con tu código
3. Tiempo estimado: 30-45 minutos

## ⚠️ Limitaciones del Plan Gratuito

- Los servicios se "duermen" después de 15 minutos de inactividad
- El primer request después del sleep puede tardar ~30-50 segundos
- PostgreSQL gratuito tiene límite de 90 días (luego necesitas actualizar)
- 750 horas/mes de tiempo de ejecución (suficiente para 24/7 si solo tienes 1 servicio)

---

## 📦 Paso 1: Preparar la Base de Datos PostgreSQL

### 1.1 Crear Base de Datos en Render

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click en **"New +"** → **"PostgreSQL"**
3. Configura:
   - **Name**: `cornerapp-db` (o el nombre que prefieras)
   - **Database**: `cornerappdb`
   - **User**: `cornerapp_user` (o el que prefieras)
   - **Region**: Elige la más cercana a tus usuarios
   - **PostgreSQL Version**: `16` (recomendado)
   - **Plan**: **Free** (gratis)
4. Click en **"Create Database"**
5. ⚠️ **IMPORTANTE**: Guarda la **Connection String** que aparece. Se verá así:
   ```
   postgresql://cornerapp_user:password@dpg-xxxxx-a.oregon-postgres.render.com/cornerappdb
   ```

### 1.2 Convertir Connection String para SQL Server

Render usa PostgreSQL, pero tu backend está configurado para SQL Server. Tienes dos opciones:

#### Opción A: Usar PostgreSQL (Recomendado - Requiere cambios en el backend)

Necesitarás agregar el paquete Npgsql.EntityFrameworkCore.PostgreSQL:

```bash
cd backend-csharp/CornerApp.API
dotnet add package Npgsql.EntityFrameworkCore.PostgreSQL
```

Y modificar `Program.cs` para detectar PostgreSQL.

#### Opción B: Usar SQL Server en Render (Requiere plan de pago)

Render no ofrece SQL Server gratuito. Puedes usar:
- Azure SQL Database (tier gratuito)
- Railway.app (tiene SQL Server gratuito)
- O mantener PostgreSQL y adaptar el código

**Para esta guía, asumiremos que usarás PostgreSQL** (Opción A).

---

## 🔧 Paso 2: Configurar el Backend para PostgreSQL

### 2.1 Agregar soporte para PostgreSQL

1. Abre `Restaurante/CornerApp/backend-csharp/CornerApp.API/CornerApp.API.csproj`
2. Agrega la dependencia (si no está):
   ```xml
   <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.0.0" />
   ```

### 2.2 Verificar Program.cs

El código ya está actualizado para soportar PostgreSQL automáticamente. El `Program.cs` detecta el tipo de base de datos basándose en el connection string:

- Si contiene `postgresql://` o `Host=` → Usa PostgreSQL
- Si contiene `Data Source=` (sin `Server=`) → Usa SQLite
- En otros casos → Usa SQL Server

### 2.3 Actualizar Migraciones para PostgreSQL

Las migraciones de Entity Framework Core son compatibles entre SQL Server y PostgreSQL en la mayoría de casos. Si encuentras problemas específicos, puedes regenerar las migraciones:

```bash
cd backend-csharp/CornerApp.API
dotnet ef migrations add InitialPostgreSQLMigration
```

---

## 🐳 Paso 3: Desplegar el Backend en Render

### 3.1 Crear Web Service para Backend

1. En Render Dashboard, click **"New +"** → **"Web Service"**
2. Conecta tu repositorio Git
3. Configura el servicio:
   - **Name**: `cornerapp-backend`
   - **Region**: Misma que la base de datos
   - **Branch**: `main` (o la rama que uses)
   - **Root Directory**: `Restaurante/CornerApp/backend-csharp`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `CornerApp.API/Dockerfile`
   - **Docker Context**: `CornerApp.API` (o el directorio correcto)

### 3.2 Variables de Entorno del Backend

En la sección **"Environment Variables"**, agrega:

```
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
PORT=8080

# Connection String de PostgreSQL (de Render)
CONNECTION_STRING=postgresql://cornerapp_user:password@dpg-xxxxx-a.oregon-postgres.render.com/cornerappdb

# CORS - URL de tu frontend (la obtendrás después)
Cors__AllowedOrigins=["https://tu-frontend.onrender.com"]

# JWT
Jwt__Key=tu-clave-secreta-minimo-32-caracteres-para-seguridad
Jwt__Issuer=CornerApp
Jwt__Audience=CornerApp

# Otros (opcionales)
EnableSwagger=false
```

### 3.3 Configuración Avanzada

- **Health Check Path**: `/health`
- **Auto-Deploy**: `Yes` (se despliega automáticamente en cada push)

### 3.4 Crear el Servicio

Click en **"Create Web Service"**

⚠️ **Nota**: El primer despliegue puede tardar 5-10 minutos.

### 3.5 Obtener la URL del Backend

Una vez desplegado, Render te dará una URL como:
```
https://cornerapp-backend.onrender.com
```

**Guarda esta URL**, la necesitarás para el frontend.

---

## 🎨 Paso 4: Desplegar el Frontend en Render

### 4.1 Crear Web Service para Frontend

1. En Render Dashboard, click **"New +"** → **"Web Service"**
2. Conecta el mismo repositorio Git
3. Configura:
   - **Name**: `cornerapp-frontend`
   - **Region**: Misma que backend y DB
   - **Branch**: `main`
   - **Root Directory**: `Restaurante/CornerApp/frontend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile`

### 4.2 Variables de Entorno del Frontend

En **"Environment Variables"**, agrega:

```
# URL del backend (la que obtuviste en el paso 3.5)
VITE_API_URL=https://cornerapp-backend.onrender.com
NODE_ENV=production
```

### 4.3 Verificar el Cliente API del Frontend

El código ya está actualizado. El archivo `frontend/src/api/client.ts` usa:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
```

Esto significa que:
- En desarrollo: Usa rutas relativas (proxy de Vite)
- En producción: Usa la URL del backend configurada en `VITE_API_URL`

El `vite.config.ts` ya está configurado correctamente - el proxy solo se usa en desarrollo.

### 4.4 Crear el Servicio

Click en **"Create Web Service"**

### 4.5 Obtener la URL del Frontend

Una vez desplegado, obtendrás una URL como:
```
https://cornerapp-frontend.onrender.com
```

---

## 🔄 Paso 5: Actualizar Variables de Entorno

### 5.1 Actualizar CORS en Backend

1. Ve al servicio del backend en Render
2. Edita las variables de entorno
3. Actualiza `Cors__AllowedOrigins` con la URL real del frontend:
   ```
   Cors__AllowedOrigins=["https://cornerapp-frontend.onrender.com"]
   ```
4. Guarda y espera a que se redespliegue

### 5.2 Actualizar API URL en Frontend (si es necesario)

Si cambiaste la URL del backend, actualiza `VITE_API_URL` en el frontend.

---

## ✅ Paso 6: Verificar el Despliegue

### 6.1 Verificar Backend

1. Visita: `https://tu-backend.onrender.com/health`
2. Deberías ver una respuesta JSON con el estado

### 6.2 Verificar Frontend

1. Visita: `https://tu-frontend.onrender.com`
2. Deberías ver la aplicación funcionando

### 6.3 Verificar Conexión

1. Abre la consola del navegador (F12)
2. Intenta hacer login o cualquier acción
3. Verifica que las peticiones al backend funcionen

---

## 🔧 Paso 7: Aplicar Migraciones de Base de Datos

### 7.1 Opción A: Automático (si está configurado)

Si tu backend aplica migraciones automáticamente al iniciar, ya debería estar listo.

### 7.2 Opción B: Manual (SSH en Render)

1. En el servicio del backend, ve a **"Shell"**
2. Ejecuta:
   ```bash
   cd /app
   dotnet ef database update
   ```

### 7.3 Opción C: Script de Inicialización

Puedes crear un script que se ejecute al iniciar el contenedor para aplicar migraciones.

---

## 📝 Paso 8: Configuración Adicional

### 8.1 Dominio Personalizado (Opcional)

1. En cada servicio, ve a **"Settings"** → **"Custom Domain"**
2. Agrega tu dominio
3. Configura los registros DNS según las instrucciones

### 8.2 Monitoreo y Logs

- **Logs**: Disponibles en tiempo real en cada servicio
- **Metrics**: Render proporciona métricas básicas
- **Alerts**: Configura alertas para errores

### 8.3 Backup de Base de Datos

El plan gratuito de PostgreSQL en Render incluye backups automáticos diarios.

---

## 🐛 Solución de Problemas

### Problema: El backend no se conecta a la base de datos

**Solución**:
- Verifica que `CONNECTION_STRING` esté correctamente configurada
- Asegúrate de que la base de datos esté activa
- Revisa los logs del backend para ver errores específicos

### Problema: CORS errors en el frontend

**Solución**:
- Verifica que `Cors__AllowedOrigins` incluya la URL exacta del frontend
- Asegúrate de incluir `https://` (no `http://`)
- Reinicia el backend después de cambiar CORS

### Problema: El servicio está "sleeping"

**Solución**:
- Es normal en el plan gratuito después de 15 min de inactividad
- El primer request puede tardar 30-50 segundos
- Considera usar un servicio de "ping" para mantenerlo activo (hay servicios gratuitos)

### Problema: Error al construir la imagen Docker

**Solución**:
- Verifica que el `Dockerfile` esté en la ruta correcta
- Revisa los logs de build para ver el error específico
- Asegúrate de que todas las dependencias estén en los archivos correctos

### Problema: Migraciones no se aplican

**Solución**:
- Verifica que Entity Framework esté configurado correctamente
- Revisa los logs del backend al iniciar
- Aplica migraciones manualmente desde el Shell

---

## 📊 Resumen de URLs y Configuración

Una vez completado, tendrás:

- **Base de Datos**: PostgreSQL en Render (gratis)
- **Backend**: `https://cornerapp-backend.onrender.com`
- **Frontend**: `https://cornerapp-frontend.onrender.com`

### Variables de Entorno Importantes

**Backend**:
- `CONNECTION_STRING`: Connection string de PostgreSQL
- `Cors__AllowedOrigins`: URL del frontend
- `Jwt__Key`: Clave secreta para JWT

**Frontend**:
- `VITE_API_URL`: URL del backend

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando en Render. Recuerda:

- Los servicios gratuitos se duermen después de 15 min de inactividad
- El primer request después del sleep puede tardar
- PostgreSQL gratuito tiene límite de 90 días (luego necesitas actualizar)

## 📚 Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [Render PostgreSQL](https://render.com/docs/databases)
- [Render Web Services](https://render.com/docs/web-services)

---

## 🔄 Actualizaciones Futuras

Para actualizar tu aplicación:

1. Haz push a tu repositorio Git
2. Render detectará los cambios automáticamente
3. Se redesplegará automáticamente (si tienes Auto-Deploy activado)

¡Feliz despliegue! 🚀

# 🚀 Resumen Rápido - Despliegue en Render

## Checklist de Despliegue

### ✅ Preparación
- [ ] Código en repositorio Git (GitHub/GitLab/Bitbucket)
- [ ] Dockerfiles creados (ya están listos)
- [ ] Soporte PostgreSQL agregado al backend (ya está listo)

### 📊 Paso 1: Base de Datos PostgreSQL
1. Render Dashboard → **New +** → **PostgreSQL**
2. Configurar:
   - Name: `cornerapp-db`
   - Database: `cornerappdb`
   - Plan: **Free**
3. **Guardar Connection String** (se verá como `postgresql://...`)

### 🔧 Paso 2: Backend
1. Render Dashboard → **New +** → **Web Service**
2. Conectar repositorio Git
3. Configurar:
   - **Root Directory**: `Restaurante/CornerApp/backend-csharp`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `CornerApp.API/Dockerfile`
4. Variables de entorno:
   ```
   CONNECTION_STRING=postgresql://... (de paso 1)
   ASPNETCORE_ENVIRONMENT=Production
   ASPNETCORE_URLS=http://+:8080
   PORT=8080
   Cors__AllowedOrigins=["https://tu-frontend.onrender.com"]
   Jwt__Key=tu-clave-secreta-minimo-32-caracteres
   ```
5. **Guardar URL del backend** (ej: `https://cornerapp-backend.onrender.com`)

### 🎨 Paso 3: Frontend
1. Render Dashboard → **New +** → **Web Service**
2. Conectar mismo repositorio Git
3. Configurar:
   - **Root Directory**: `Restaurante/CornerApp/frontend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile`
4. Variables de entorno:
   ```
   VITE_API_URL=https://cornerapp-backend.onrender.com
   NODE_ENV=production
   ```
5. **Guardar URL del frontend** (ej: `https://cornerapp-frontend.onrender.com`)

### 🔄 Paso 4: Actualizar CORS
1. En el servicio del backend, editar variables de entorno
2. Actualizar `Cors__AllowedOrigins` con la URL real del frontend
3. Guardar y esperar redespliegue

### ✅ Paso 5: Verificar
- Backend: `https://tu-backend.onrender.com/health`
- Frontend: `https://tu-frontend.onrender.com`
- Probar login y funcionalidades

## 📝 URLs Importantes

- **Base de Datos**: PostgreSQL en Render (interno)
- **Backend**: `https://cornerapp-backend.onrender.com`
- **Frontend**: `https://cornerapp-frontend.onrender.com`

## ⚠️ Recordatorios

- Los servicios gratuitos se duermen después de 15 min de inactividad
- Primer request después del sleep puede tardar 30-50 segundos
- PostgreSQL gratuito tiene límite de 90 días

## 📚 Documentación Completa

Ver `GUIA_DESPLIEGUE_RENDER.md` para instrucciones detalladas paso a paso.

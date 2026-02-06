# 🔧 Configuración del Backend en Render

## 📋 Configuración de Build & Deploy

### 1. Root Directory
```
Restaurante/CornerApp/backend-csharp
```

### 2. Dockerfile Path
```
CornerApp.API/Dockerfile
```
⚠️ **IMPORTANTE**: Sin espacios, sin la ruta completa, solo `CornerApp.API/Dockerfile`

### 3. Docker Build Context Directory
```
CornerApp.API
```
O déjalo **vacío** si Render lo permite.

### 4. Docker Command
**Déjalo VACÍO** (el Dockerfile ya tiene el ENTRYPOINT configurado)

### 5. Pre-Deploy Command
**Déjalo VACÍO**

---

## 🔐 Variables de Entorno

Ve a **Settings → Environment** y agrega estas variables:

### Variables Obligatorias

```
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
PORT=8080
```

### Connection String de PostgreSQL

```
CONNECTION_STRING=postgresql://cornerappdb_user:4WooAkinpyDOliTZFk7FAqFJJoNGO7zS@dpg-d62kjuogjchc73bq48qg-a/cornerappdb
```

⚠️ **Nota**: Usa el connection string que obtuviste de tu base de datos PostgreSQL en Render.

### CORS - URL del Frontend

```
Cors__AllowedOrigins=["https://ridiexpress.onrender.com"]
```

⚠️ **IMPORTANTE**: Reemplaza `ridiexpress.onrender.com` con la URL real de tu frontend en Render.

Si tienes múltiples URLs (desarrollo y producción), puedes usar:
```
Cors__AllowedOrigins=["https://ridiexpress.onrender.com","http://localhost:3000"]
```

### JWT (JSON Web Tokens)

```
Jwt__Key=tu-clave-secreta-minimo-32-caracteres-para-seguridad-aqui-cambiar
Jwt__Issuer=CornerApp
Jwt__Audience=CornerApp
```

⚠️ **IMPORTANTE**: 
- Genera una clave secreta segura de al menos 32 caracteres
- Puedes usar un generador online o este comando: `openssl rand -base64 32`
- **NUNCA** compartas esta clave públicamente

### Configuración Opcional

```
EnableSwagger=false
```

---

## ✅ Checklist de Configuración

### Build & Deploy
- [ ] Root Directory: `Restaurante/CornerApp/backend-csharp`
- [ ] Dockerfile Path: `CornerApp.API/Dockerfile` (sin espacios)
- [ ] Docker Build Context Directory: `CornerApp.API` (o vacío)
- [ ] Docker Command: (vacío)
- [ ] Pre-Deploy Command: (vacío)

### Environment Variables
- [ ] `ASPNETCORE_ENVIRONMENT=Production`
- [ ] `ASPNETCORE_URLS=http://+:8080`
- [ ] `PORT=8080`
- [ ] `CONNECTION_STRING=` (tu connection string de PostgreSQL)
- [ ] `Cors__AllowedOrigins=` (URL de tu frontend)
- [ ] `Jwt__Key=` (clave secreta de 32+ caracteres)
- [ ] `Jwt__Issuer=CornerApp`
- [ ] `Jwt__Audience=CornerApp`

### Health Check
- [ ] Health Check Path: `/health`
- [ ] Auto-Deploy: `On Commit`

---

## 🔄 Después de Configurar

1. **Guarda todos los cambios** en Render
2. Render iniciará un **nuevo despliegue automáticamente**
3. Espera 5-10 minutos para que termine el build
4. Verifica que el servicio esté funcionando:
   - Visita: `https://tu-backend.onrender.com/health`
   - Deberías ver una respuesta JSON con el estado

---

## 🐛 Solución de Problemas

### Error: "Cannot find Dockerfile"
- Verifica que el Dockerfile Path sea exactamente: `CornerApp.API/Dockerfile`
- Sin espacios antes o después
- Sin la ruta completa

### Error: "Connection refused" o "Database connection failed"
- Verifica que el `CONNECTION_STRING` esté correcto
- Asegúrate de que la base de datos PostgreSQL esté activa en Render
- Revisa los logs del backend para ver el error específico

### Error: CORS en el frontend
- Verifica que `Cors__AllowedOrigins` incluya la URL exacta del frontend
- Debe incluir `https://` (no `http://` para producción)
- La URL debe coincidir exactamente (sin trailing slash)
- Reinicia el backend después de cambiar CORS

### El servicio no inicia
- Revisa los logs en Render
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que el puerto 8080 esté expuesto

---

## 📝 Notas Importantes

1. **Connection String**: Render proporciona el connection string en el formato `postgresql://...`. Tu backend ya está configurado para detectar PostgreSQL automáticamente.

2. **CORS**: Es crítico que la URL del frontend en `Cors__AllowedOrigins` coincida exactamente con la URL que Render te da para el frontend.

3. **JWT Key**: Genera una clave segura y única. Puedes usar:
   ```bash
   # En PowerShell
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
   ```

4. **Puerto**: Render asigna el puerto automáticamente, pero el Dockerfile está configurado para usar el puerto 8080, que Render respetará.

---

## 🎯 URL del Backend

Una vez desplegado, tu backend estará disponible en:
```
https://tu-backend.onrender.com
```

**Guarda esta URL** - la necesitarás para configurar el frontend.

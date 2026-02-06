# 📦 Notas sobre Dockerfiles para Render

## ✅ Dockerfiles Creados

### Frontend (`frontend/Dockerfile`)
- ✅ Multi-stage build (Node.js para build, Nginx para servir)
- ✅ Configuración de Nginx optimizada para SPA
- ✅ Health check configurado
- ✅ Compresión gzip habilitada
- ✅ Cache para assets estáticos

### Backend (`backend-csharp/CornerApp.API/Dockerfile`)
- ✅ Multi-stage build (SDK para build, Runtime para ejecución)
- ✅ Usuario no-root para seguridad
- ✅ Health check configurado
- ✅ Puertos expuestos: 8080, 8081
- ✅ Variables de entorno configuradas

## 🔧 Configuración en Render

### Backend
- **Dockerfile Path**: `CornerApp.API/Dockerfile`
- **Docker Context**: Dejar vacío o usar `CornerApp.API` si Render lo requiere
- **Root Directory**: `Restaurante/CornerApp/backend-csharp`

### Frontend
- **Dockerfile Path**: `Dockerfile`
- **Docker Context**: Dejar vacío
- **Root Directory**: `Restaurante/CornerApp/frontend`

## ⚠️ Consideraciones Importantes

### Puerto en Render
Render asigna un puerto dinámicamente a través de la variable de entorno `PORT`. El Dockerfile del backend ya está configurado para usar el puerto 8080, pero Render puede requerir que uses la variable `PORT`.

Si tienes problemas, puedes modificar el Dockerfile del backend para usar:

```dockerfile
ENV ASPNETCORE_URLS=http://+:$PORT
```

Y en las variables de entorno de Render, asegúrate de tener:
```
PORT=8080
```

### Health Checks
- Backend: `/health` (ya configurado en el código)
- Frontend: `/health` (configurado en nginx.conf)

### Variables de Entorno en Build Time
Vite necesita las variables de entorno en tiempo de build. Render las inyecta automáticamente durante el build de Docker.

## 🐛 Troubleshooting

### Error: "Cannot find module" en frontend
- Verifica que `package.json` esté en el directorio correcto
- Asegúrate de que el Dockerfile copie `package*.json` antes de `npm ci`

### Error: "Connection refused" en backend
- Verifica que el puerto esté correctamente expuesto
- Revisa las variables de entorno `ASPNETCORE_URLS` y `PORT`

### Error: "Database connection failed"
- Verifica el formato del connection string de PostgreSQL
- Asegúrate de que la base de datos esté activa en Render
- Revisa los logs del backend para ver el error específico

## 📝 Archivos de Configuración

### `.dockerignore` (Frontend)
Ya creado para excluir:
- `node_modules/`
- `dist/`
- Archivos de entorno
- Archivos de IDE

### `.dockerignore` (Backend)
Ya existe en `backend-csharp/.dockerignore`

## 🔄 Actualizaciones

Para actualizar los Dockerfiles:
1. Modifica el archivo correspondiente
2. Haz commit y push
3. Render detectará los cambios y redesplegará automáticamente

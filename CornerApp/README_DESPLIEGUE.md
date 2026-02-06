# 📦 Instrucciones Rápidas de Despliegue

## Para quien va a desplegar el proyecto

### 1️⃣ Extraer el ZIP
```bash
unzip CornerApp.zip
cd CornerApp
```

### 2️⃣ Configurar variables de entorno
```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar con tus valores
nano .env
```

**Valores importantes a cambiar:**
- `CONNECTION_STRING`: IP/host de SQL Server, usuario y contraseña
- `Jwt__Key`: Clave secreta de al menos 32 caracteres
- `Cors__AllowedOrigins__0`: URL pública del frontend
- `VITE_API_URL`: URL pública del backend

### 3️⃣ Construir y ejecutar con Docker Compose
```bash
# Construir imágenes y levantar servicios
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 4️⃣ Ejecutar migraciones de base de datos
```bash
# Opción 1: Desde el contenedor
docker exec -it cornerapp-backend dotnet ef database update --project /app

# Opción 2: Si tienes .NET SDK instalado
cd backend-csharp/CornerApp.API
dotnet ef database update
```

### 5️⃣ Verificar que funciona
```bash
# Verificar contenedores
docker ps

# Verificar backend
curl http://localhost:8080/health

# Verificar frontend
curl http://localhost
```

### 6️⃣ Configurar firewall
```bash
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 1433/tcp
```

---

## 📋 Checklist

- [ ] SQL Server instalado y base de datos creada
- [ ] Archivo `.env` configurado
- [ ] Imágenes construidas y contenedores corriendo
- [ ] Migraciones ejecutadas
- [ ] Backend responde en `/health`
- [ ] Frontend accesible
- [ ] Firewall configurado

---

## 📖 Documentación Completa

Ver `GUIA_DESPLIEGUE_SERVIDOR.md` para instrucciones detalladas.

---

## ⚠️ Problemas Comunes

**Error de conexión a SQL Server:**
- Verifica que SQL Server esté corriendo: `sudo systemctl status mssql-server`
- Verifica el connection string en `.env`
- Verifica firewall: `sudo ufw allow 1433/tcp`

**CORS bloqueado:**
- Verifica `Cors__AllowedOrigins__0` en `.env`
- Debe ser la URL exacta del frontend (sin barra final)

**Frontend no conecta al backend:**
- Verifica `VITE_API_URL` en `.env`
- Debe ser la URL exacta del backend (sin barra final)

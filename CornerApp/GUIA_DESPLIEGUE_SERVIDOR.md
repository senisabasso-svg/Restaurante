# 🚀 Guía de Despliegue en Servidor Linux

Esta guía explica paso a paso cómo desplegar el proyecto CornerApp en un servidor Linux.

## 📋 Requisitos Previos

- Servidor Linux (Ubuntu 20.04+ recomendado)
- Docker y Docker Compose instalados
- SQL Server instalado y configurado
- Acceso SSH al servidor
- Dominio o IP pública configurada

---

## 📦 Paso 1: Preparar el Proyecto

### 1.1 Extraer el ZIP

```bash
# En el servidor, extraer el ZIP
unzip CornerApp.zip
cd CornerApp
```

### 1.2 Verificar estructura

Asegúrate de que la estructura sea:
```
CornerApp/
├── backend-csharp/
│   └── CornerApp.API/
│       ├── Dockerfile
│       └── ...
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ...
└── docker-compose.prod.yml
```

---

## 🗄️ Paso 2: Configurar SQL Server

### 2.1 Instalar SQL Server (si no está instalado)

```bash
# Agregar repositorio de Microsoft
curl -o /tmp/mssql-server-2022.gpg https://packages.microsoft.com/keys/mssql-server-2022.gpg
sudo mv /tmp/mssql-server-2022.gpg /etc/apt/trusted.gpg.d/mssql-server-2022.gpg

curl -o /tmp/mssql-server-2022.list https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/mssql-server-2022.list
sudo mv /tmp/mssql-server-2022.list /etc/apt/sources.list.d/

# Instalar SQL Server
sudo apt-get update
sudo apt-get install -y mssql-server

# Configurar SQL Server
sudo /opt/mssql/bin/mssql-conf setup
```

### 2.2 Crear Base de Datos

```bash
# Conectar a SQL Server
sqlcmd -S localhost -U SA -P 'TuPassword123!'

# Crear base de datos
CREATE DATABASE cornerappdb;
GO

# Crear usuario
CREATE LOGIN cornerappdb_user WITH PASSWORD = 'TuPasswordSeguro123!';
GO

USE cornerappdb;
GO

CREATE USER cornerappdb_user FOR LOGIN cornerappdb_user;
GO

ALTER ROLE db_owner ADD MEMBER cornerappdb_user;
GO
```

---

## ⚙️ Paso 3: Configurar Variables de Entorno

### 3.1 Crear archivo .env

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```bash
# ============================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================
# Connection String de SQL Server
# Formato: Server=IP_O_HOST;Database=nombre_db;User Id=usuario;Password=contraseña;TrustServerCertificate=True;Encrypt=True;
CONNECTION_STRING=Server=localhost;Database=cornerappdb;User Id=cornerappdb_user;Password=TuPasswordSeguro123!;TrustServerCertificate=True;Encrypt=True;

# ============================================
# CONFIGURACIÓN JWT
# ============================================
# Clave secreta para JWT (mínimo 32 caracteres)
Jwt__Key=tu_clave_secreta_jwt_de_al_menos_32_caracteres_aqui_cambiar_por_una_segura

# ============================================
# CONFIGURACIÓN CORS
# ============================================
# URL del frontend (sin barra final)
# Ejemplo: https://cornerapp.com o http://192.168.1.100
Cors__AllowedOrigins__0=https://tu-dominio-frontend.com

# Si tienes múltiples orígenes, agrega más:
# Cors__AllowedOrigins__1=https://otro-dominio.com

# ============================================
# CONFIGURACIÓN FRONTEND
# ============================================
# URL del backend API (sin barra final)
# Ejemplo: https://api.cornerapp.com o http://192.168.1.100:8080
VITE_API_URL=https://api.tu-dominio.com

# ============================================
# CONFIGURACIÓN DE RED
# ============================================
# IP o dominio del servidor backend
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8080

# IP o dominio del servidor frontend
FRONTEND_HOST=0.0.0.0
FRONTEND_PORT=80
```

### 3.2 Editar valores según tu servidor

**IMPORTANTE:** Edita los siguientes valores en el archivo `.env`:

1. **CONNECTION_STRING**: 
   - Si SQL Server está en otro servidor, cambia `localhost` por la IP
   - Ejemplo: `Server=192.168.1.50;Database=cornerappdb;...`

2. **Jwt__Key**: 
   - Genera una clave segura de al menos 32 caracteres
   - Ejemplo: `openssl rand -base64 32`

3. **Cors__AllowedOrigins__0**: 
   - URL pública del frontend
   - Ejemplo: `https://cornerapp.com` o `http://192.168.1.100`

4. **VITE_API_URL**: 
   - URL pública del backend
   - Ejemplo: `https://api.cornerapp.com` o `http://192.168.1.100:8080`

---

## 🐳 Paso 4: Construir Imágenes Docker

### 4.1 Construir imagen del Backend

```bash
cd backend-csharp/CornerApp.API

# Construir imagen
docker build -t cornerapp-backend:latest .

# Verificar que se construyó correctamente
docker images | grep cornerapp-backend
```

### 4.2 Construir imagen del Frontend

```bash
cd ../../frontend

# Construir imagen (pasar la URL del backend como argumento)
docker build --build-arg VITE_API_URL=https://api.tu-dominio.com -t cornerapp-frontend:latest .

# Verificar que se construyó correctamente
docker images | grep cornerapp-frontend
```

**NOTA:** Reemplaza `https://api.tu-dominio.com` con la URL real de tu backend.

---

## 🚀 Paso 5: Ejecutar Migraciones de Base de Datos

### 5.1 Ejecutar migraciones desde el contenedor

```bash
# Volver a la raíz del proyecto
cd ../..

# Ejecutar migraciones
docker run --rm \
  --env-file .env \
  -v $(pwd)/backend-csharp/CornerApp.API:/app \
  mcr.microsoft.com/dotnet/sdk:8.0 \
  bash -c "cd /app && dotnet ef database update"
```

O si tienes .NET SDK instalado en el servidor:

```bash
cd backend-csharp/CornerApp.API
dotnet ef database update
```

---

## 🐳 Paso 6: Crear Docker Compose (Opcional pero Recomendado)

Crea un archivo `docker-compose.yml` en la raíz del proyecto:

```yaml
version: '3.8'

services:
  backend:
    image: cornerapp-backend:latest
    container_name: cornerapp-backend
    restart: unless-stopped
    ports:
      - "8080:8080"
    env_file:
      - .env
    environment:
      - ASPNETCORE_URLS=http://+:8080
      - ASPNETCORE_ENVIRONMENT=Production
    networks:
      - cornerapp-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: cornerapp-frontend:latest
    container_name: cornerapp-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - cornerapp-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

networks:
  cornerapp-network:
    driver: bridge
```

---

## 🚀 Paso 7: Iniciar los Contenedores

### Opción A: Con Docker Compose (Recomendado)

```bash
# Iniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Verificar estado
docker-compose ps
```

### Opción B: Con Docker directamente

```bash
# Iniciar backend
docker run -d \
  --name cornerapp-backend \
  --restart unless-stopped \
  --env-file .env \
  -p 8080:8080 \
  cornerapp-backend:latest

# Iniciar frontend
docker run -d \
  --name cornerapp-frontend \
  --restart unless-stopped \
  -p 80:80 \
  cornerapp-frontend:latest
```

---

## ✅ Paso 8: Verificar que Todo Funciona

### 8.1 Verificar contenedores

```bash
docker ps
```

Deberías ver ambos contenedores corriendo.

### 8.2 Verificar backend

```bash
# Health check
curl http://localhost:8080/health

# O desde el navegador
# http://tu-ip-servidor:8080/health
```

### 8.3 Verificar frontend

```bash
# Desde el navegador
# http://tu-ip-servidor
```

### 8.4 Ver logs

```bash
# Logs del backend
docker logs cornerapp-backend -f

# Logs del frontend
docker logs cornerapp-frontend -f
```

---

## 🔧 Paso 9: Configurar Firewall

```bash
# Permitir puertos HTTP y del backend
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 1433/tcp  # Puerto de SQL Server

# Si usas HTTPS
sudo ufw allow 443/tcp
```

---

## 🌐 Paso 10: Configurar Nginx como Reverse Proxy (Opcional pero Recomendado)

Si quieres usar un dominio y HTTPS, configura Nginx:

```nginx
# /etc/nginx/sites-available/cornerapp
server {
    listen 80;
    server_name tu-dominio.com;

    # Redirigir a HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📝 Resumen de Comandos Útiles

```bash
# Ver logs
docker logs cornerapp-backend -f
docker logs cornerapp-frontend -f

# Reiniciar servicios
docker restart cornerapp-backend
docker restart cornerapp-frontend

# Detener servicios
docker stop cornerapp-backend cornerapp-frontend

# Iniciar servicios
docker start cornerapp-backend cornerapp-frontend

# Ver uso de recursos
docker stats

# Limpiar contenedores detenidos
docker container prune

# Reconstruir imágenes después de cambios
docker-compose build --no-cache
docker-compose up -d
```

---

## ⚠️ Troubleshooting

### Error: No se puede conectar a SQL Server

1. Verifica que SQL Server esté corriendo:
   ```bash
   sudo systemctl status mssql-server
   ```

2. Verifica el connection string en `.env`

3. Verifica que el firewall permita el puerto 1433

### Error: CORS bloqueado

1. Verifica que `Cors__AllowedOrigins__0` en `.env` tenga la URL correcta del frontend

2. Verifica que no haya espacios o caracteres especiales

### Error: Frontend no puede conectar al backend

1. Verifica que `VITE_API_URL` en `.env` tenga la URL correcta del backend

2. Verifica que el backend esté corriendo:
   ```bash
   curl http://localhost:8080/health
   ```

### Error: Contenedor se detiene inmediatamente

1. Ver logs:
   ```bash
   docker logs cornerapp-backend
   ```

2. Verifica que todas las variables de entorno estén configuradas

---

## 📞 Soporte

Si tienes problemas, revisa los logs:
```bash
docker logs cornerapp-backend --tail 100
docker logs cornerapp-frontend --tail 100
```

---

## ✅ Checklist Final

- [ ] SQL Server instalado y configurado
- [ ] Base de datos creada
- [ ] Archivo `.env` configurado con valores correctos
- [ ] Imágenes Docker construidas
- [ ] Migraciones ejecutadas
- [ ] Contenedores corriendo
- [ ] Backend responde en `/health`
- [ ] Frontend accesible
- [ ] Firewall configurado
- [ ] Nginx configurado (si aplica)

¡Listo! Tu aplicación debería estar funcionando. 🎉

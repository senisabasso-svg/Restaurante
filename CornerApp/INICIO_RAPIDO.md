# 🚀 Inicio Rápido - Despliegue en Servidor

## Para quien recibe el ZIP

### Paso 1: Extraer y entrar al proyecto
```bash
unzip CornerApp.zip
cd CornerApp
```

### Paso 2: Crear archivo .env
Crea un archivo llamado `.env` en la raíz del proyecto con este contenido:

```bash
# Base de Datos SQL Server
CONNECTION_STRING=Server=localhost;Database=cornerappdb;User Id=cornerappdb_user;Password=TU_PASSWORD_AQUI;TrustServerCertificate=True;Encrypt=True;

# JWT (generar con: openssl rand -base64 32)
Jwt__Key=TU_CLAVE_JWT_DE_32_CARACTERES_MINIMO_AQUI

# CORS - URL del frontend (sin barra final)
Cors__AllowedOrigins__0=http://TU_IP_O_DOMINIO

# Frontend - URL del backend (sin barra final)
VITE_API_URL=http://TU_IP_O_DOMINIO:8080

# Puertos
BACKEND_PORT=8080
FRONTEND_PORT=80
```

**IMPORTANTE:** Reemplaza:
- `TU_PASSWORD_AQUI` → Contraseña de SQL Server
- `TU_CLAVE_JWT_DE_32_CARACTERES_MINIMO_AQUI` → Clave secreta (mínimo 32 caracteres)
- `TU_IP_O_DOMINIO` → IP o dominio del servidor (ejemplo: `192.168.1.100` o `cornerapp.com`)

### Paso 3: Construir y ejecutar
```bash
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
```

### Paso 4: Ejecutar migraciones
```bash
# Opción 1: Si tienes .NET SDK
cd backend-csharp/CornerApp.API
dotnet ef database update

# Opción 2: Desde Docker
docker exec -it cornerapp-backend dotnet ef database update --project /app
```

### Paso 5: Verificar
```bash
# Ver contenedores
docker ps

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f

# Probar backend
curl http://localhost:8080/health

# Probar frontend
curl http://localhost
```

### Paso 6: Configurar firewall
```bash
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 1433/tcp
```

---

## ✅ Listo!

- Frontend: http://TU_IP_O_DOMINIO
- Backend: http://TU_IP_O_DOMINIO:8080
- Health: http://TU_IP_O_DOMINIO:8080/health

---

## 📖 Para más detalles

Ver `GUIA_DESPLIEGUE_SERVIDOR.md`

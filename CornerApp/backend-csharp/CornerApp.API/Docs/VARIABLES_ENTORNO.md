# Variables de Entorno - Configuración para Producción

## 🔐 Variables Requeridas

### JWT Authentication

```bash
JWT_SECRET_KEY=tu-clave-secreta-de-al-menos-32-caracteres-aqui
JWT_ISSUER=CornerApp
JWT_AUDIENCE=CornerApp
```

**Importante:**
- `JWT_SECRET_KEY` debe tener al menos 32 caracteres
- Genera una clave segura usando: `openssl rand -base64 32`
- Nunca uses la misma clave en desarrollo y producción

### Base de Datos

```bash
CONNECTION_STRING=Server=tu-servidor;Database=CornerAppDb;User Id=tu-usuario;Password=tu-password;TrustServerCertificate=true
```

O para Azure SQL:
```bash
CONNECTION_STRING=Server=tcp:tu-servidor.database.windows.net,1433;Database=CornerAppDb;User Id=tu-usuario;Password=tu-password;Encrypt=true;TrustServerCertificate=false
```

### CORS Origins (Opcional)

```bash
CORS_ORIGINS=https://tu-dominio.com,https://app.tu-dominio.com
```

## 📋 Cómo Configurar

### Windows (PowerShell)

```powershell
# Configurar variables de entorno para la sesión actual
$env:JWT_SECRET_KEY = "tu-clave-secreta-aqui"
$env:JWT_ISSUER = "CornerApp"
$env:JWT_AUDIENCE = "CornerApp"
$env:CONNECTION_STRING = "Server=tu-servidor;Database=CornerAppDb;..."

# Para hacerlas permanentes (requiere reiniciar PowerShell como Administrador)
[System.Environment]::SetEnvironmentVariable("JWT_SECRET_KEY", "tu-clave-secreta-aqui", "Machine")
```

### Linux/Mac

```bash
# Agregar al archivo ~/.bashrc o ~/.zshrc
export JWT_SECRET_KEY="tu-clave-secreta-aqui"
export JWT_ISSUER="CornerApp"
export JWT_AUDIENCE="CornerApp"
export CONNECTION_STRING="Server=tu-servidor;Database=CornerAppDb;..."

# O crear archivo .env y cargarlo
source .env
```

### Azure App Service

1. Ve a tu App Service en Azure Portal
2. Settings → Configuration → Application settings
3. Agrega cada variable como "New application setting"

### Docker

```dockerfile
ENV JWT_SECRET_KEY=tu-clave-secreta-aqui
ENV JWT_ISSUER=CornerApp
ENV JWT_AUDIENCE=CornerApp
ENV CONNECTION_STRING=Server=tu-servidor;Database=CornerAppDb;...
```

O usando docker-compose.yml:
```yaml
services:
  api:
    environment:
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - JWT_ISSUER=${JWT_ISSUER}
      - CONNECTION_STRING=${CONNECTION_STRING}
```

## 🔒 Seguridad

### ✅ Hacer:
- Usar variables de entorno en producción
- Generar claves seguras y únicas
- Rotar claves periódicamente
- Usar Azure Key Vault o AWS Secrets Manager para producción

### ❌ No hacer:
- Subir archivos .env al repositorio
- Usar claves de desarrollo en producción
- Compartir claves por email o chat
- Hardcodear secrets en el código

## 🧪 Verificar Configuración

Para verificar que las variables están configuradas correctamente:

```bash
# Windows PowerShell
echo $env:JWT_SECRET_KEY

# Linux/Mac
echo $JWT_SECRET_KEY
```

Si la aplicación no encuentra las variables de entorno, usará los valores de `appsettings.json` como fallback (solo en desarrollo).

## 📝 Notas

- En **desarrollo**: Puedes usar `appsettings.Development.json` sin problemas
- En **producción**: SIEMPRE usa variables de entorno para secrets
- La aplicación validará que `JWT_SECRET_KEY` tenga al menos 32 caracteres en producción

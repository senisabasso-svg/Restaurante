# Guía de Deployment para Producción

## 📋 Checklist Pre-Deployment

### ✅ Configuración de Seguridad
- [ ] Variables de entorno configuradas (JWT_SECRET_KEY, CONNECTION_STRING)
- [ ] CORS configurado con orígenes específicos de producción
- [ ] Swagger deshabilitado en producción
- [ ] HTTPS forzado y certificado SSL configurado
- [ ] Rate Limiting habilitado

### ✅ Base de Datos
- [ ] Connection string configurado en variables de entorno
- [ ] Migraciones aplicadas
- [ ] Backup automático configurado
- [ ] Índices optimizados

### ✅ Logging y Monitoreo
- [ ] Serilog configurado para producción
- [ ] Logs configurados para retención (90 días)
- [ ] Health checks funcionando
- [ ] Sistema de alertas configurado (opcional)

### ✅ Infraestructura
- [ ] Servidor configurado (IIS, Azure, Linux, etc.)
- [ ] Variables de entorno configuradas
- [ ] Firewall configurado
- [ ] SSL/TLS certificado instalado

## 🚀 Deployment en Azure App Service

### Paso 1: Crear App Service

1. Ve a Azure Portal → App Services → Create
2. Configura:
   - **Name**: cornerapp-api
   - **Runtime**: .NET 8
   - **OS**: Windows o Linux
   - **Plan**: Basic o superior

### Paso 2: Configurar Variables de Entorno

En Azure Portal → Configuration → Application settings:

```
JWT_SECRET_KEY = [generar clave de 32+ caracteres]
JWT_ISSUER = CornerApp
JWT_AUDIENCE = CornerApp
CONNECTION_STRING = [connection string de Azure SQL]
ASPNETCORE_ENVIRONMENT = Production
```

### Paso 3: Configurar CORS

En `appsettings.Production.json` o Application Settings:

```json
{
  "Cors": {
    "AllowedOrigins": [
      "https://tu-dominio.com",
      "https://app.tu-dominio.com"
    ],
    "AllowCredentials": true
  }
}
```

### Paso 4: Deploy

**Opción A: Desde Visual Studio**
1. Click derecho en proyecto → Publish
2. Selecciona Azure App Service
3. Selecciona tu App Service
4. Publish

**Opción B: Desde Azure CLI**
```bash
az webapp deployment source config-zip \
  --resource-group tu-resource-group \
  --name cornerapp-api \
  --src ./publish.zip
```

**Opción C: GitHub Actions / Azure DevOps**
- Configurar pipeline CI/CD
- Deploy automático en push a main

### Paso 5: Verificar

1. Health Check: `https://tu-api.azurewebsites.net/health`
2. Verificar logs en Azure Portal
3. Probar endpoints principales

## 🐧 Deployment en Linux (Ubuntu/Debian)

### Paso 1: Preparar Servidor

```bash
# Instalar .NET 8 Runtime
wget https://dot.net/v1/dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 8.0

# Instalar Nginx (opcional, como reverse proxy)
sudo apt update
sudo apt install nginx
```

### Paso 2: Publicar Aplicación

```bash
cd backend-csharp/CornerApp.API
dotnet publish -c Release -o ./publish
```

### Paso 3: Configurar como Servicio Systemd

Crear `/etc/systemd/system/cornerapp-api.service`:

```ini
[Unit]
Description=CornerApp API
After=network.target

[Service]
Type=notify
ExecStart=/usr/bin/dotnet /var/www/cornerapp-api/CornerApp.API.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=cornerapp-api
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=JWT_SECRET_KEY=tu-clave-secreta
Environment=CONNECTION_STRING=tu-connection-string

[Install]
WantedBy=multi-user.target
```

### Paso 4: Iniciar Servicio

```bash
sudo systemctl daemon-reload
sudo systemctl enable cornerapp-api
sudo systemctl start cornerapp-api
sudo systemctl status cornerapp-api
```

### Paso 5: Configurar Nginx (Opcional)

Crear `/etc/nginx/sites-available/cornerapp-api`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cornerapp-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🪟 Deployment en Windows Server / IIS

### Paso 1: Instalar .NET 8 Hosting Bundle

Descargar e instalar desde: https://dotnet.microsoft.com/download/dotnet/8.0

### Paso 2: Publicar Aplicación

```powershell
cd backend-csharp\CornerApp.API
dotnet publish -c Release -o C:\inetpub\wwwroot\cornerapp-api
```

### Paso 3: Configurar IIS

1. Abrir IIS Manager
2. Crear nuevo Application Pool:
   - Name: `CornerAppAPI`
   - .NET CLR Version: No Managed Code
   - Managed Pipeline Mode: Integrated

3. Crear nuevo Website:
   - Site name: `CornerAppAPI`
   - Application pool: `CornerAppAPI`
   - Physical path: `C:\inetpub\wwwroot\cornerapp-api`
   - Binding: HTTPS con certificado SSL

### Paso 4: Configurar Variables de Entorno

En `web.config` o Application Pool → Advanced Settings → Environment Variables:

```xml
<aspNetCore>
  <environmentVariables>
    <environmentVariable name="ASPNETCORE_ENVIRONMENT" value="Production" />
    <environmentVariable name="JWT_SECRET_KEY" value="tu-clave-secreta" />
    <environmentVariable name="CONNECTION_STRING" value="tu-connection-string" />
  </environmentVariables>
</aspNetCore>
```

## 🔐 Generar JWT Secret Key Seguro

### Windows (PowerShell)
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Linux/Mac
```bash
openssl rand -base64 32
```

### Online
Usar un generador seguro de claves (mínimo 32 caracteres)

## 📊 Verificar Deployment

### Health Checks
```bash
curl https://tu-api.com/health
curl https://tu-api.com/health/ready
curl https://tu-api.com/health/live
```

### Verificar Logs
```bash
# Linux
sudo journalctl -u cornerapp-api -f

# Windows
Get-EventLog -LogName Application -Source "CornerApp API" -Newest 50
```

### Verificar Rate Limiting
```bash
# Hacer múltiples requests rápidas
for i in {1..150}; do curl https://tu-api.com/api/products; done
# Debería recibir 429 después de 100 requests
```

## 🔄 Actualización (Rolling Update)

### Azure App Service
- Deploy automático desde CI/CD
- O manual desde Azure Portal → Deployment Center

### Linux Systemd
```bash
sudo systemctl stop cornerapp-api
# Copiar nuevos archivos
sudo systemctl start cornerapp-api
```

### IIS
1. Detener Application Pool
2. Reemplazar archivos
3. Iniciar Application Pool

## 🐛 Troubleshooting

### Error: "JWT Secret Key no configurado"
- Verificar variable de entorno `JWT_SECRET_KEY`
- Verificar que tenga al menos 32 caracteres

### Error: "Connection string no configurado"
- Verificar variable de entorno `CONNECTION_STRING`
- Verificar que la base de datos esté accesible

### Error: CORS bloqueado
- Verificar `Cors:AllowedOrigins` en appsettings.Production.json
- Verificar que el origen del frontend esté en la lista

### Health Check falla
- Verificar conexión a base de datos
- Verificar logs para más detalles

### Rate Limiting muy restrictivo
- Ajustar límites en `appsettings.Production.json`
- Verificar `IpRateLimiting:GeneralRules`

## 📝 Notas Importantes

1. **Nunca** subas `appsettings.Production.json` con valores reales al repositorio
2. **Siempre** usa variables de entorno para secrets en producción
3. **Configura** backups automáticos de la base de datos
4. **Monitorea** los logs regularmente
5. **Actualiza** dependencias periódicamente
6. **Prueba** el deployment en un ambiente de staging primero

## 🔗 Recursos Adicionales

- [Documentación ASP.NET Core Deployment](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/)
- [Azure App Service Documentation](https://learn.microsoft.com/en-us/azure/app-service/)
- [Serilog Documentation](https://serilog.net/)

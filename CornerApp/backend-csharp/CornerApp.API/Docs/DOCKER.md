# Docker - Containerización

## Descripción

Este documento describe cómo usar Docker para containerizar y ejecutar CornerApp API en diferentes ambientes.

## ¿Por qué Docker?

- **Consistencia**: Mismo ambiente en desarrollo, staging y producción
- **Portabilidad**: Funciona en cualquier sistema que soporte Docker
- **Aislamiento**: No contamina el sistema host
- **Escalabilidad**: Fácil de escalar horizontalmente
- **CI/CD**: Integración perfecta con pipelines

## Archivos Docker

### Dockerfile
Multi-stage build optimizado para producción:
- **Etapa 1 (build)**: Compila la aplicación
- **Etapa 2 (publish)**: Publica la aplicación
- **Etapa 3 (final)**: Imagen runtime mínima

### docker-compose.yml
Para desarrollo local con SQL Server incluido.

### docker-compose.prod.yml
Para producción (sin base de datos, usa variables de entorno).

## Requisitos Previos

1. **Docker Desktop** instalado (Windows/Mac) o **Docker Engine** (Linux)
2. **Docker Compose** (incluido en Docker Desktop)

Verificar instalación:
```bash
docker --version
docker-compose --version
```

## Desarrollo Local

### Opción 1: Docker Compose (Recomendado)

Incluye SQL Server y API en un solo comando:

```bash
# Construir y levantar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f api

# Detener servicios
docker-compose down

# Detener y eliminar volúmenes
docker-compose down -v
```

**Acceso**:
- API: http://localhost:5000
- Swagger: http://localhost:5000/swagger
- SQL Server: localhost:1433

### Opción 2: Solo Docker (sin compose)

```bash
# Construir imagen
docker build -t cornerapp-api -f CornerApp.API/Dockerfile .

# Ejecutar contenedor
docker run -d \
  --name cornerapp-api \
  -p 5000:8080 \
  -e ASPNETCORE_ENVIRONMENT=Development \
  -e ConnectionStrings__DefaultConnection="Server=tu-servidor;Database=CornerAppDb;..." \
  -e JWT_SECRET_KEY="tu-clave-secreta" \
  cornerapp-api

# Ver logs
docker logs -f cornerapp-api

# Detener
docker stop cornerapp-api
docker rm cornerapp-api
```

## Producción

### Usando docker-compose.prod.yml

1. **Crear archivo `.env`** con variables de entorno:
```bash
CONNECTION_STRING=Server=tu-servidor;Database=CornerAppDb;User Id=usuario;Password=password;...
JWT_SECRET_KEY=tu-clave-secreta-min-32-caracteres
JWT_ISSUER=CornerApp
JWT_AUDIENCE=CornerApp
```

2. **Ejecutar**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Usando Docker directamente

```bash
# Construir imagen de producción
docker build -t cornerapp-api:latest -f CornerApp.API/Dockerfile .

# Ejecutar
docker run -d \
  --name cornerapp-api-prod \
  -p 8080:8080 \
  --restart always \
  -e ASPNETCORE_ENVIRONMENT=Production \
  -e ConnectionStrings__DefaultConnection="${CONNECTION_STRING}" \
  -e JWT_SECRET_KEY="${JWT_SECRET_KEY}" \
  cornerapp-api:latest
```

## Variables de Entorno

### Desarrollo (docker-compose.yml)
- `ASPNETCORE_ENVIRONMENT=Development`
- `ConnectionStrings__DefaultConnection`: Configurado automáticamente
- `JWT_SECRET_KEY`: Valor por defecto (cambiar en producción)

### Producción
- `ASPNETCORE_ENVIRONMENT=Production`
- `ConnectionStrings__DefaultConnection`: **Obligatorio** desde variable de entorno
- `JWT_SECRET_KEY`: **Obligatorio** desde variable de entorno

## Comandos Útiles

### Ver logs
```bash
# Todos los servicios
docker-compose logs -f

# Solo API
docker-compose logs -f api

# Últimas 100 líneas
docker-compose logs --tail=100 api
```

### Ejecutar comandos dentro del contenedor
```bash
# Shell interactivo
docker-compose exec api sh

# Ejecutar migraciones
docker-compose exec api dotnet ef database update
```

### Reconstruir imagen
```bash
# Forzar rebuild sin cache
docker-compose build --no-cache api

# Reconstruir y reiniciar
docker-compose up -d --build api
```

### Limpiar
```bash
# Detener y eliminar contenedores
docker-compose down

# Eliminar también volúmenes
docker-compose down -v

# Eliminar imágenes no usadas
docker system prune -a
```

## Health Checks

El contenedor incluye health checks automáticos:

```bash
# Verificar estado
docker ps

# Ver detalles de health check
docker inspect cornerapp-api | grep -A 10 Health
```

## Volúmenes

### Logs
Los logs se guardan en `./logs` y se mapean al contenedor.

### Archivos estáticos
`wwwroot` se mapea para servir imágenes y archivos estáticos.

## Migraciones de Base de Datos

### Opción 1: Desde el contenedor
```bash
docker-compose exec api dotnet ef database update
```

### Opción 2: Desde el host (si tienes .NET SDK)
```bash
cd CornerApp.API
dotnet ef database update --connection "Server=localhost,1433;Database=CornerAppDb;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=true"
```

## Troubleshooting

### El contenedor no inicia
```bash
# Ver logs
docker-compose logs api

# Verificar estado
docker-compose ps

# Verificar configuración
docker-compose config
```

### Error de conexión a base de datos
1. Verificar que SQL Server esté corriendo: `docker-compose ps sqlserver`
2. Verificar health check: `docker inspect cornerapp-sqlserver | grep Health`
3. Verificar connection string en variables de entorno

### Puerto ya en uso
```bash
# Cambiar puerto en docker-compose.yml
ports:
  - "5001:8080"  # Cambiar 5000 a 5001
```

### Permisos de logs
```bash
# En Linux/Mac, asegurar permisos
chmod -R 777 logs/
```

## Optimizaciones

### Multi-stage Build
El Dockerfile usa multi-stage build para:
- Reducir tamaño de imagen final
- Separar dependencias de build de runtime
- Mejorar seguridad (solo runtime en imagen final)

### Usuario no-root
El contenedor corre como usuario no-root para mayor seguridad.

### Health Checks
Health checks automáticos para monitoreo y orquestación.

## Integración con CI/CD

### GitHub Actions ejemplo
```yaml
- name: Build Docker image
  run: docker build -t cornerapp-api:${{ github.sha }} -f CornerApp.API/Dockerfile .

- name: Push to registry
  run: docker push cornerapp-api:${{ github.sha }}
```

### Azure DevOps ejemplo
```yaml
- task: Docker@2
  inputs:
    containerRegistry: 'AzureContainerRegistry'
    repository: 'cornerapp-api'
    command: 'buildAndPush'
    Dockerfile: 'CornerApp.API/Dockerfile'
    tags: '$(Build.BuildId)'
```

## Referencias

- [Docker Documentation](https://docs.docker.com/)
- [.NET Docker Images](https://hub.docker.com/_/microsoft-dotnet)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Best Practices for Dockerfiles](https://docs.docker.com/develop/dev-best-practices/)

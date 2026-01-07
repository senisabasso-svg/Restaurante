# CornerApp Backend - C# / .NET 8

API REST backend para CornerApp desarrollada con ASP.NET Core 8.0.

## 🚀 Inicio Rápido

### Opción 1: Docker (Recomendado)

```bash
# Levantar todo (API + SQL Server)
docker-compose up -d

# Ver logs
docker-compose logs -f api

# La API estará disponible en http://localhost:5000
```

### Opción 2: Desarrollo Local

```bash
# Restaurar dependencias
dotnet restore

# Ejecutar migraciones
cd CornerApp.API
dotnet ef database update

# Ejecutar API
dotnet run

# La API estará disponible en http://localhost:5000
```

## 📋 Requisitos

- **.NET 8.0 SDK** (para desarrollo local)
- **SQL Server** (o usar Docker Compose que incluye SQL Server)
- **Docker Desktop** (opcional, para containerización)

## 🐳 Docker

### Desarrollo
```bash
docker-compose up -d
```

### Producción
```bash
# Configurar variables de entorno en .env
docker-compose -f docker-compose.prod.yml up -d
```

Ver documentación completa en [Docs/DOCKER.md](CornerApp.API/Docs/DOCKER.md)

## 📁 Estructura del Proyecto

```
backend-csharp/
├── CornerApp.API/          # Proyecto principal de la API
│   ├── Controllers/        # Controladores de la API
│   ├── Services/           # Servicios de negocio
│   ├── Models/             # Entidades del dominio
│   ├── DTOs/               # Data Transfer Objects
│   ├── Helpers/            # Funciones auxiliares
│   ├── Middleware/         # Middlewares personalizados
│   ├── Data/               # DbContext y configuración de BD
│   ├── Migrations/         # Migraciones de Entity Framework
│   └── Docs/               # Documentación
├── CornerApp.API.Tests/    # Tests automatizados
├── docker-compose.yml      # Docker Compose para desarrollo
├── docker-compose.prod.yml # Docker Compose para producción
└── Dockerfile              # Dockerfile de la API
```

## 🔧 Configuración

### Variables de Entorno

Crear archivo `.env` o configurar variables de entorno:

```bash
# Base de datos
CONNECTION_STRING=Server=localhost;Database=CornerAppDb;Trusted_Connection=True;...

# JWT
JWT_SECRET_KEY=tu-clave-secreta-min-32-caracteres
JWT_ISSUER=CornerApp
JWT_AUDIENCE=CornerApp

# Ambiente
ASPNETCORE_ENVIRONMENT=Development
```

Ver más detalles en [Docs/VARIABLES_ENTORNO.md](CornerApp.API/Docs/VARIABLES_ENTORNO.md)

## 🧪 Tests

```bash
# Ejecutar todos los tests
cd CornerApp.API.Tests
dotnet test

# Ejecutar con cobertura
dotnet test /p:CollectCoverage=true
```

Ver documentación en [Docs/TESTING.md](CornerApp.API/Docs/TESTING.md)

## 📚 Documentación

- [Docker](CornerApp.API/Docs/DOCKER.md) - Containerización
- [Deployment](CornerApp.API/Docs/DEPLOYMENT.md) - Guía de deployment
- [Testing](CornerApp.API/Docs/TESTING.md) - Tests automatizados
- [Variables de Entorno](CornerApp.API/Docs/VARIABLES_ENTORNO.md) - Configuración
- [Health Checks](CornerApp.API/Docs/HEALTH_CHECKS.md) - Monitoreo
- [API Versioning](CornerApp.API/Docs/API_VERSIONING.md) - Versionado de API

## 🛠️ Comandos Útiles

### Migraciones
```bash
# Crear migración
dotnet ef migrations add NombreMigracion

# Aplicar migraciones
dotnet ef database update

# Revertir última migración
dotnet ef database update NombreMigracionAnterior
```

### Docker
```bash
# Construir imagen
docker build -t cornerapp-api -f CornerApp.API/Dockerfile .

# Ver logs
docker-compose logs -f api

# Detener servicios
docker-compose down
```

## 🔒 Seguridad

- ✅ JWT Authentication
- ✅ HTTPS en producción
- ✅ CORS configurado
- ✅ Rate Limiting
- ✅ Security Headers
- ✅ Input Validation
- ✅ Secrets en variables de entorno

## 📊 Características

- ✅ RESTful API
- ✅ Entity Framework Core
- ✅ Swagger/OpenAPI
- ✅ Logging estructurado (Serilog)
- ✅ Health Checks
- ✅ Caching (Memory Cache)
- ✅ Paginación
- ✅ ETags
- ✅ Background Jobs
- ✅ Circuit Breaker
- ✅ Feature Flags
- ✅ Retry Policies
- ✅ Audit System
- ✅ Webhooks
- ✅ API Versioning
- ✅ Tests Automatizados
- ✅ Docker Support

## 🚀 Deployment

Ver guía completa en [Docs/DEPLOYMENT.md](CornerApp.API/Docs/DEPLOYMENT.md)

### Azure
```bash
az webapp up --name cornerapp-api --resource-group myResourceGroup
```

### Docker
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Licencia

Este proyecto es privado y propietario.

## 👥 Contribución

Para contribuir, por favor crear un issue o pull request.

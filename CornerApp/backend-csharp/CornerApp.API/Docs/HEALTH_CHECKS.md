# Health Checks Avanzados

## Descripción

Este documento describe el sistema de Health Checks avanzado implementado en CornerApp API para monitorear el estado de diferentes componentes del sistema.

## Endpoints de Health Checks

### 1. `/health` - Health Check Completo

Endpoint principal que verifica todos los componentes:

```bash
GET /health
```

**Respuesta**:
```json
{
  "status": "Healthy",
  "totalDuration": "00:00:00.1234567",
  "entries": {
    "database": {
      "status": "Healthy",
      "description": "...",
      "duration": "00:00:00.0123456"
    },
    "cache": {
      "status": "Healthy",
      "description": "Cache en memoria funcionando correctamente",
      "duration": "00:00:00.0001234"
    }
  }
}
```

### 2. `/health/detailed` - Health Check Detallado

Endpoint con información detallada de todos los checks:

```bash
GET /health/detailed
```

**Respuesta**:
```json
{
  "status": "Healthy",
  "totalDuration": 123.45,
  "entries": [
    {
      "name": "database",
      "status": "Healthy",
      "description": "...",
      "duration": 12.34,
      "data": {},
      "tags": ["db", "sql", "ready"],
      "exception": null
    },
    {
      "name": "cache",
      "status": "Healthy",
      "description": "Cache en memoria funcionando correctamente",
      "duration": 0.12,
      "data": {},
      "tags": ["cache", "memory"],
      "exception": null
    }
  ]
}
```

### 3. `/health/ready` - Readiness Check

Verifica si la aplicación está lista para recibir tráfico:

```bash
GET /health/ready
```

Solo verifica checks marcados con tag `"ready"` (base de datos, etc.).

### 4. `/health/live` - Liveness Check

Verifica si la aplicación está viva:

```bash
GET /health/live
```

Solo verifica checks básicos (self check).

## Health Checks Implementados

### 1. Database Health Check

Verifica la conexión a la base de datos:

- **Nombre**: `database`
- **Tags**: `db`, `sql`, `ready`
- **Estado**: Healthy/Unhealthy

### 2. Cache Health Check

Verifica el funcionamiento del cache en memoria:

- **Nombre**: `cache`
- **Tags**: `cache`, `memory`
- **Estado**: Healthy/Unhealthy
- **Configuración**: `HealthChecks:Cache:Enabled`

### 3. Disk Space Health Check

Verifica el espacio disponible en disco:

- **Nombre**: `disk_space`
- **Tags**: `disk`, `storage`
- **Estado**: Healthy/Degraded/Unhealthy
- **Configuración**: 
  - `HealthChecks:DiskSpace:Enabled`
  - `HealthChecks:DiskSpace:MinimumFreeSpaceMB` (default: 1024 MB)

**Datos retornados**:
- Drive
- TotalSpaceGB
- FreeSpaceGB
- UsedSpaceGB
- FreeSpacePercent

### 4. Memory Health Check

Verifica el uso de memoria del proceso:

- **Nombre**: `memory`
- **Tags**: `memory`, `resources`
- **Estado**: Healthy/Degraded/Unhealthy
- **Configuración**:
  - `HealthChecks:Memory:Enabled`
  - `HealthChecks:Memory:MaximumUsageMB` (default: 2048 MB)

**Datos retornados**:
- MemoryUsageMB
- MaximumMemoryMB
- MemoryUsagePercent
- AvailableMemoryMB

### 5. External API Health Check

Verifica la disponibilidad de APIs externas:

- **Nombre**: `external_api`
- **Tags**: `external`, `api`
- **Estado**: Healthy/Degraded/Unhealthy
- **Configuración**:
  - `HealthChecks:ExternalApi:Enabled`
  - `HealthChecks:ExternalApi:Url`
  - `HealthChecks:ExternalApi:TimeoutSeconds` (default: 5)

**Datos retornados**:
- Url
- StatusCode
- ResponseTimeMs

## Configuración

### appsettings.json

```json
{
  "HealthChecks": {
    "Cache": {
      "Enabled": true
    },
    "DiskSpace": {
      "Enabled": true,
      "MinimumFreeSpaceMB": 1024
    },
    "Memory": {
      "Enabled": true,
      "MaximumUsageMB": 2048
    },
    "ExternalApi": {
      "Enabled": false,
      "Url": "https://api.example.com/health",
      "TimeoutSeconds": 5
    }
  }
}
```

## Estados de Health Checks

### Healthy
El componente está funcionando correctamente.

### Degraded
El componente funciona pero con problemas menores (ej: espacio en disco bajo, memoria alta).

### Unhealthy
El componente no está funcionando correctamente (ej: base de datos no disponible).

## Uso con Kubernetes/Docker

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 80
  initialDelaySeconds: 10
  periodSeconds: 5
```

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 80
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Monitoreo

### Integración con Monitoring Tools

Los endpoints de health checks pueden ser monitoreados por:
- **Prometheus**: Scrape `/health/detailed`
- **Azure Monitor**: Health check endpoint
- **AWS CloudWatch**: Health check metric
- **Custom Monitoring**: Polling periódico

### Alertas

Configurar alertas basadas en el estado:
- **Unhealthy**: Alerta crítica
- **Degraded**: Alerta de advertencia
- **Healthy**: Sin alerta

## Agregar Nuevos Health Checks

### Ejemplo: Health Check Personalizado

```csharp
public class CustomHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Verificar componente
            var isHealthy = CheckComponent();
            
            if (isHealthy)
            {
                return Task.FromResult(HealthCheckResult.Healthy("Componente funcionando"));
            }
            
            return Task.FromResult(HealthCheckResult.Unhealthy("Componente no disponible"));
        }
        catch (Exception ex)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("Error al verificar componente", ex));
        }
    }
}
```

### Registrar en Program.cs

```csharp
healthChecksBuilder.AddCheck<CustomHealthCheck>(
    "custom_component",
    failureStatus: HealthStatus.Unhealthy,
    tags: new[] { "custom" });
```

## Mejores Prácticas

1. **Readiness vs Liveness**:
   - Readiness: ¿Puede la app recibir tráfico?
   - Liveness: ¿Está la app viva?

2. **Timeouts**: Configurar timeouts apropiados para cada check

3. **Caching**: Deshabilitar cache en health checks (`AllowCachingResponses = false`)

4. **Tags**: Usar tags para agrupar checks relacionados

5. **Datos Adicionales**: Incluir datos útiles en el resultado

6. **Logging**: Registrar errores en health checks para debugging

## Troubleshooting

### Health Check siempre Unhealthy

- Verificar configuración del componente
- Revisar logs para errores específicos
- Verificar conectividad (red, BD, etc.)

### Health Check muy lento

- Optimizar la verificación
- Reducir timeout si es apropiado
- Considerar verificación asíncrona

### Health Check no aparece

- Verificar que esté registrado en `Program.cs`
- Verificar que `Enabled` esté en `true` en configuración
- Verificar logs de inicio

## Referencias

- [ASP.NET Core Health Checks](https://docs.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks)
- [Kubernetes Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Check Pattern](https://microservices.io/patterns/observability/health-check-api.html)

# Optimización de Conexiones de Base de Datos

Este documento describe las optimizaciones implementadas para el manejo de conexiones a la base de datos.

## Connection Pooling

### Configuración Actual

La aplicación utiliza connection pooling de SQL Server con las siguientes configuraciones:

- **Pooling**: Habilitado (por defecto en SQL Server)
- **Min Pool Size**: 5 conexiones mínimas
- **Max Pool Size**: 100 conexiones máximas
- **Connection Timeout**: 30 segundos

### Beneficios del Connection Pooling

1. **Reutilización de conexiones**: Las conexiones se reutilizan en lugar de crearse y destruirse constantemente
2. **Mejor rendimiento**: Reduce la sobrecarga de establecer nuevas conexiones
3. **Control de recursos**: Limita el número máximo de conexiones simultáneas
4. **Escalabilidad**: Maneja mejor picos de tráfico

## Retry Logic

### Configuración

Entity Framework Core está configurado con retry logic para manejar errores transitorios:

- **Max Retry Count**: 3 intentos
- **Max Retry Delay**: 5 segundos entre intentos
- **Error Numbers**: Errores transitorios de SQL Server

### Errores que se reintentan automáticamente

- Timeouts de conexión
- Errores de deadlock
- Errores de red transitorios
- Errores de recursos temporales

## Query Tracking

### Configuración

- **Query Tracking Behavior**: `TrackAll` (por defecto)
- **Lazy Loading**: Deshabilitado (mejor performance)

### Uso de AsNoTracking()

Para consultas de solo lectura, se recomienda usar `AsNoTracking()`:

```csharp
var products = await _context.Products
    .AsNoTracking()
    .Where(p => p.IsAvailable)
    .ToListAsync();
```

**Beneficios**:
- Reduce el uso de memoria
- Mejora el rendimiento
- Evita tracking innecesario de cambios

## Timeouts

### Command Timeout

- **Default**: 30 segundos por comando
- Configurable por operación si es necesario

### Connection Timeout

- **Default**: 30 segundos para establecer conexión
- Configurado en connection string

## Configuración por Ambiente

### Desarrollo

- `EnableSensitiveDataLogging`: Habilitado
- `EnableDetailedErrors`: Habilitado
- Logging detallado de queries

### Producción

- `EnableSensitiveDataLogging`: Deshabilitado (seguridad)
- `EnableDetailedErrors`: Deshabilitado (seguridad)
- Solo errores críticos en logs

## Mejores Prácticas

### 1. Usar AsNoTracking() para consultas de solo lectura

```csharp
// ✅ Correcto
var products = await _context.Products
    .AsNoTracking()
    .ToListAsync();

// ❌ Evitar (si no necesitas tracking)
var products = await _context.Products
    .ToListAsync();
```

### 2. Cerrar contextos apropiadamente

Los contextos se cierran automáticamente con dependency injection, pero asegúrate de no mantener referencias innecesarias.

### 3. Usar Include() solo cuando sea necesario

```csharp
// ✅ Correcto - solo cuando necesitas datos relacionados
var order = await _context.Orders
    .Include(o => o.Items)
    .FirstOrDefaultAsync(o => o.Id == id);

// ❌ Evitar - si no necesitas Items
var order = await _context.Orders
    .Include(o => o.Items)
    .FirstOrDefaultAsync(o => o.Id == id);
```

### 4. Paginar consultas grandes

```csharp
// ✅ Correcto
var orders = await _context.Orders
    .AsNoTracking()
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();

// ❌ Evitar - carga todos los registros
var orders = await _context.Orders
    .AsNoTracking()
    .ToListAsync();
```

### 5. Usar proyecciones para reducir datos transferidos

```csharp
// ✅ Correcto - solo campos necesarios
var products = await _context.Products
    .AsNoTracking()
    .Select(p => new { p.Id, p.Name, p.Price })
    .ToListAsync();

// ❌ Evitar - todos los campos
var products = await _context.Products
    .AsNoTracking()
    .ToListAsync();
```

## Monitoreo

### Métricas a monitorear

1. **Número de conexiones activas**
2. **Tiempo promedio de conexión**
3. **Tasa de errores de conexión**
4. **Tiempo de respuesta de queries**
5. **Uso de connection pool**

### Consultas SQL para monitoreo

```sql
-- Ver conexiones activas
SELECT 
    DB_NAME(dbid) as DatabaseName,
    COUNT(dbid) as NumberOfConnections,
    loginame as LoginName
FROM sys.sysprocesses
WHERE dbid > 0
GROUP BY dbid, loginame
ORDER BY NumberOfConnections DESC;

-- Ver configuración del pool
SELECT 
    name,
    value
FROM sys.configurations
WHERE name LIKE '%pool%' OR name LIKE '%connection%';
```

## Troubleshooting

### Problema: "Timeout expired"

**Solución**: 
- Aumentar `CommandTimeout` si las queries son legítimamente largas
- Optimizar queries lentas
- Revisar índices

### Problema: "Pool exhausted"

**Solución**:
- Aumentar `Max Pool Size` en connection string
- Revisar si hay conexiones que no se están cerrando
- Implementar circuit breaker pattern

### Problema: "Deadlock"

**Solución**:
- El retry logic maneja deadlocks automáticamente
- Revisar transacciones largas
- Optimizar orden de acceso a tablas

## Configuración Recomendada por Carga

### Baja carga (< 100 req/min)
- Min Pool Size: 5
- Max Pool Size: 20
- Connection Timeout: 30

### Media carga (100-1000 req/min)
- Min Pool Size: 10
- Max Pool Size: 50
- Connection Timeout: 30

### Alta carga (> 1000 req/min)
- Min Pool Size: 20
- Max Pool Size: 100
- Connection Timeout: 30
- Considerar read replicas

## Variables de Entorno

Para producción, configura la connection string como variable de entorno:

```bash
CONNECTION_STRING="Server=...;Database=...;Pooling=true;Min Pool Size=10;Max Pool Size=100;Connection Timeout=30"
```

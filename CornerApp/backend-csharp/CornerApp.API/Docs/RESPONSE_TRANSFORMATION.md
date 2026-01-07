# Response Transformation y Metadata

## Descripción

Este documento describe el sistema de transformación automática de respuestas y agregado de metadata implementado en CornerApp API.

## Componentes

### 1. ResponseTransformationMiddleware

Middleware que transforma automáticamente las respuestas HTTP a un formato estándar con metadata.

**Características**:
- Transforma respuestas JSON a formato estándar
- Agrega metadata automáticamente (requestId, timestamp, statusCode)
- Excluye paths específicos (Swagger, Health Checks, etc.)
- Configurable desde `appsettings.json`

**Formato de respuesta transformada**:
```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { /* datos originales */ },
  "statusCode": 200,
  "requestId": "abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/products",
  "method": "GET"
}
```

### 2. ResponseMetadataHelper

Helper estático para agregar metadata manualmente a las respuestas.

**Métodos disponibles**:

#### AddMetadata<T>
Agrega metadata estándar a una respuesta exitosa:
```csharp
var response = ResponseMetadataHelper.AddMetadata(products, "Productos obtenidos exitosamente", requestId);
return Ok(response);
```

#### AddErrorMetadata
Agrega metadata a una respuesta de error:
```csharp
var response = ResponseMetadataHelper.AddErrorMetadata(
    "Error al procesar la solicitud",
    "VALIDATION_ERROR",
    validationErrors,
    requestId
);
return BadRequest(response);
```

#### AddPaginationMetadata
Agrega metadata de paginación:
```csharp
var response = ResponseMetadataHelper.AddPaginationMetadata(
    items,
    page: 1,
    pageSize: 10,
    totalItems: 100,
    requestId
);
return Ok(response);
```

#### AddPerformanceMetadata
Agrega metadata de performance:
```csharp
var stopwatch = Stopwatch.StartNew();
// ... operación ...
stopwatch.Stop();

var response = ResponseMetadataHelper.AddPerformanceMetadata(
    data,
    stopwatch.Elapsed,
    requestId
);
return Ok(response);
```

## Configuración

### appsettings.json

```json
{
  "ResponseTransformation": {
    "EnableTransformation": false,
    "ExcludedPaths": [
      "/swagger",
      "/health",
      "/metrics"
    ]
  }
}
```

**Nota**: La transformación automática está **deshabilitada por defecto** para mantener compatibilidad con el código existente. Puedes habilitarla cuando estés listo.

### Variables de Entorno

```
ResponseTransformation__EnableTransformation=true
ResponseTransformation__ExcludedPaths__0=/swagger
ResponseTransformation__ExcludedPaths__1=/health
```

## Uso

### Opción 1: Transformación Automática (Middleware)

1. Habilitar en `appsettings.json`:
```json
{
  "ResponseTransformation": {
    "EnableTransformation": true
  }
}
```

2. Las respuestas se transforman automáticamente (excepto paths excluidos).

### Opción 2: Metadata Manual (Helper)

Usar `ResponseMetadataHelper` en los controladores:

```csharp
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var products = await _context.Products.ToListAsync();
    var requestId = HttpContext.Items["RequestId"]?.ToString();
    
    var response = ResponseMetadataHelper.AddMetadata(
        products,
        "Productos obtenidos exitosamente",
        requestId
    );
    
    return Ok(response);
}
```

### Opción 3: Combinar con Paginación

```csharp
[HttpGet]
public async Task<IActionResult> GetProducts(int page = 1, int pageSize = 10)
{
    var totalItems = await _context.Products.CountAsync();
    var items = await _context.Products
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();
    
    var requestId = HttpContext.Items["RequestId"]?.ToString();
    
    var response = ResponseMetadataHelper.AddPaginationMetadata(
        items,
        page,
        pageSize,
        totalItems,
        requestId
    );
    
    return Ok(response);
}
```

## Respuestas Transformadas

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": {
    "id": 1,
    "name": "Producto 1"
  },
  "statusCode": 200,
  "requestId": "abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/products/1",
  "method": "GET"
}
```

### Respuesta de Error (400 Bad Request)

```json
{
  "success": false,
  "message": "Solicitud inválida",
  "data": null,
  "error": {
    "field": "name",
    "message": "El nombre es requerido"
  },
  "statusCode": 400,
  "requestId": "abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/products",
  "method": "POST"
}
```

### Respuesta Paginada

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": [
    { "id": 1, "name": "Producto 1" },
    { "id": 2, "name": "Producto 2" }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "requestId": "abc123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Paths Excluidos

Por defecto, estos paths NO se transforman:
- `/swagger` - Documentación Swagger
- `/health` - Health Checks
- `/metrics` - Métricas

Puedes agregar más paths en la configuración.

## Mejores Prácticas

1. **Transformación Automática**: Úsala cuando quieras estandarizar todas las respuestas automáticamente
2. **Metadata Manual**: Úsala cuando necesites control granular sobre el formato
3. **Performance**: El middleware agrega overhead mínimo, pero considera deshabilitarlo en endpoints de alto tráfico si no es necesario
4. **Compatibilidad**: La transformación automática está deshabilitada por defecto para mantener compatibilidad

## Troubleshooting

### Las respuestas no se transforman

- Verificar que `EnableTransformation` esté en `true`
- Verificar que el path no esté en `ExcludedPaths`
- Verificar que el Content-Type sea `application/json`
- Verificar que no sea una respuesta 204 o 304

### Error al transformar respuesta

- Revisar logs para ver el error específico
- Verificar que la respuesta original sea JSON válido
- El middleware retorna la respuesta original si hay error

### Performance degradada

- Considerar deshabilitar transformación automática en endpoints de alto tráfico
- Usar metadata manual solo donde sea necesario
- Monitorear tiempos de respuesta

## Referencias

- [ASP.NET Core Middleware](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/middleware/)
- [JSON Serialization](https://docs.microsoft.com/en-us/dotnet/standard/serialization/system-text-json-overview)

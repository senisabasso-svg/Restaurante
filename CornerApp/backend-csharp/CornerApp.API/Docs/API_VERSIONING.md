# API Versioning

## Descripción

Este documento describe el sistema de versionado de API implementado en CornerApp API para permitir múltiples versiones de la API coexistiendo.

## ¿Por qué versionar la API?

El versionado de API permite:
- **Evolución sin romper cambios**: Agregar nuevas funcionalidades sin afectar clientes existentes
- **Deprecación gradual**: Retirar versiones antiguas de forma controlada
- **Compatibilidad**: Mantener soporte para clientes que no pueden actualizarse inmediatamente
- **Testing**: Probar nuevas versiones en paralelo con versiones existentes

## Componentes

### 1. ApiVersioningMiddleware

Middleware que detecta y valida la versión de API solicitada desde:
- **Headers**: `X-API-Version: 1.0`
- **Query String**: `?api-version=1.0`
- **Ruta**: `/api/v1/products`

### 2. ApiVersionHelper

Helper estático para trabajar con versiones:
- `GetApiVersion(HttpContext)`: Obtiene la versión del contexto
- `IsVersionCompatible()`: Verifica compatibilidad de versiones
- `CompareVersions()`: Compara dos versiones

### 3. ApiVersionAttribute

Atributo para marcar endpoints con versiones específicas (para uso futuro).

## Configuración

### appsettings.json

```json
{
  "ApiVersioning": {
    "EnableVersioning": false,
    "SupportedVersions": [
      "1.0",
      "2.0"
    ],
    "DefaultVersion": "1.0",
    "RejectInvalidVersions": false,
    "VersionHeaderEnabled": true,
    "VersionHeaderName": "X-API-Version",
    "QueryStringEnabled": true,
    "QueryStringParameterName": "api-version",
    "RouteEnabled": true
  }
}
```

**Parámetros**:
- `EnableVersioning`: Habilitar/deshabilitar versionado (default: false)
- `SupportedVersions`: Lista de versiones soportadas
- `DefaultVersion`: Versión por defecto si no se especifica
- `RejectInvalidVersions`: Rechazar requests con versiones inválidas
- `VersionHeaderEnabled`: Permitir versión en headers
- `VersionHeaderName`: Nombre del header (default: "X-API-Version")
- `QueryStringEnabled`: Permitir versión en query string
- `QueryStringParameterName`: Nombre del parámetro (default: "api-version")
- `RouteEnabled`: Permitir versión en ruta (ej: /api/v1/products)

## Uso

### Opción 1: Header

```bash
GET /api/products
X-API-Version: 1.0
```

### Opción 2: Query String

```bash
GET /api/products?api-version=1.0
```

### Opción 3: Ruta

```bash
GET /api/v1/products
```

### En Código

```csharp
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var apiVersion = ApiVersionHelper.GetApiVersion(HttpContext);
    
    if (ApiVersionHelper.IsVersionCompatible(apiVersion, "2.0"))
    {
        // Usar nueva funcionalidad de v2.0
        return await GetProductsV2Async();
    }
    
    // Usar funcionalidad de v1.0
    return await GetProductsV1Async();
}
```

## Estrategias de Versionado

### 1. Header (Recomendado)

**Ventajas**:
- No contamina la URL
- Fácil de implementar
- Estándar en APIs REST

**Ejemplo**:
```
X-API-Version: 1.0
```

### 2. Query String

**Ventajas**:
- Fácil de probar en navegador
- Visible en logs

**Desventajas**:
- Contamina la URL
- Puede ser ignorado por cache

**Ejemplo**:
```
GET /api/products?api-version=1.0
```

### 3. Ruta (URL Path)

**Ventajas**:
- Muy explícito
- Fácil de entender

**Desventajas**:
- Requiere cambios en routing
- Más complejo de mantener

**Ejemplo**:
```
GET /api/v1/products
GET /api/v2/products
```

## Mejores Prácticas

1. **Usar Header por Defecto**: Más limpio y estándar
2. **Soporte Múltiple**: Permitir header, query string y ruta
3. **Versión por Defecto**: Si no se especifica, usar versión más reciente estable
4. **Documentación**: Documentar claramente qué versión usar
5. **Deprecación**: Avisar con suficiente anticipación antes de retirar versiones
6. **Compatibilidad**: Mantener versiones antiguas por tiempo razonable

## Deprecación de Versiones

### Proceso Recomendado

1. **Aviso de Deprecación**: Agregar header `X-API-Deprecated: true`
2. **Fecha de Retiro**: Especificar en header `X-API-Sunset-Date: 2024-12-31`
3. **Documentación**: Actualizar documentación
4. **Comunicación**: Notificar a clientes afectados
5. **Retiro**: Deshabilitar versión después del período de gracia

### Ejemplo de Headers de Deprecación

```csharp
if (apiVersion == "1.0")
{
    Response.Headers.Append("X-API-Deprecated", "true");
    Response.Headers.Append("X-API-Sunset-Date", "2024-12-31");
    Response.Headers.Append("X-API-Supported-Versions", "2.0");
}
```

## Migración de Versiones

### Ejemplo: Migración de v1.0 a v2.0

```csharp
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var apiVersion = ApiVersionHelper.GetApiVersion(HttpContext);
    
    switch (apiVersion)
    {
        case "2.0":
            // Nueva estructura de respuesta
            return await GetProductsV2Async();
        
        case "1.0":
        default:
            // Estructura antigua (compatibilidad)
            return await GetProductsV1Async();
    }
}
```

## Troubleshooting

### Versión no se detecta

- Verificar que `EnableVersioning` esté en `true`
- Verificar que el header/query/route esté configurado correctamente
- Revisar logs para ver qué versión se detectó

### Versión inválida rechazada

- Verificar que la versión esté en `SupportedVersions`
- O deshabilitar `RejectInvalidVersions` para permitir cualquier versión

### Versión por defecto no funciona

- Verificar que `DefaultVersion` esté en `SupportedVersions`
- Verificar que esté configurado correctamente

## Referencias

- [API Versioning Best Practices](https://restfulapi.net/versioning/)
- [Microsoft API Versioning](https://github.com/microsoft/aspnet-api-versioning)
- [REST API Versioning](https://www.baeldung.com/rest-versioning)

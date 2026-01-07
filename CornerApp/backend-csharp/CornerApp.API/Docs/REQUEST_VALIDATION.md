# Request Validation

## Descripción

Este documento describe el sistema de validación de requests implementado en CornerApp API, incluyendo validación de headers, métodos HTTP, y otros aspectos de seguridad.

## Componentes

### 1. RequestValidationMiddleware

Middleware que valida automáticamente aspectos de las requests antes de procesarlas.

**Validaciones implementadas**:
- Headers requeridos
- User-Agent requerido (opcional)
- Tamaño máximo de Content-Length
- Métodos HTTP permitidos
- Paths excluidos (skip validation)

### 2. RequestValidationHelper

Helper estático para validaciones adicionales en controladores.

**Métodos disponibles**:
- `ValidateContentType`: Valida Content-Type
- `ValidateHeader`: Valida presencia y valor de header
- `ValidateHttpMethod`: Valida método HTTP
- `ValidateContentLength`: Valida tamaño del contenido
- `ValidateUserAgent`: Valida User-Agent
- `ValidateOrigin`: Valida origen de la request
- `ValidateAcceptHeader`: Valida Accept header

## Configuración

### appsettings.json

```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "RequiredHeaders": [],
    "RequireUserAgent": false,
    "MaxContentLengthBytes": 10485760,
    "AllowedMethods": null,
    "ExcludedPaths": [
      "/swagger",
      "/health",
      "/metrics"
    ]
  }
}
```

**Parámetros**:
- `EnableValidation`: Habilitar/deshabilitar validación
- `RequiredHeaders`: Lista de headers requeridos (ej: `["X-API-Key"]`)
- `RequireUserAgent`: Requerir User-Agent header
- `MaxContentLengthBytes`: Tamaño máximo de Content-Length (0 = sin límite)
- `AllowedMethods`: Lista de métodos HTTP permitidos (null = todos)
- `ExcludedPaths`: Paths donde no se aplica validación

### Variables de Entorno

```
RequestValidation__EnableValidation=true
RequestValidation__RequireUserAgent=true
RequestValidation__MaxContentLengthBytes=10485760
RequestValidation__RequiredHeaders__0=X-API-Key
```

## Uso

### Validación Automática (Middleware)

El middleware valida automáticamente todas las requests según la configuración.

**Ejemplo: Requerir API Key**:
```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "RequiredHeaders": ["X-API-Key"]
  }
}
```

**Ejemplo: Limitar métodos HTTP**:
```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE"]
  }
}
```

### Validación Manual (Helper)

Usar `RequestValidationHelper` en controladores:

```csharp
[HttpPost]
public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest request)
{
    // Validar Content-Type
    var (isValid, errorMessage) = RequestValidationHelper.ValidateContentType(
        Request,
        "application/json"
    );
    
    if (!isValid)
    {
        return BadRequest(new { error = errorMessage });
    }

    // Validar header personalizado
    var (headerValid, headerError) = RequestValidationHelper.ValidateHeader(
        Request,
        "X-Custom-Header",
        required: true
    );
    
    if (!headerValid)
    {
        return BadRequest(new { error = headerError });
    }

    // Continuar con la lógica...
}
```

### Validar Método HTTP

```csharp
[HttpPost]
public async Task<IActionResult> UpdateProduct(int id, [FromBody] UpdateProductRequest request)
{
    var (isValid, errorMessage) = RequestValidationHelper.ValidateHttpMethod(
        Request,
        "POST",
        "PUT",
        "PATCH"
    );
    
    if (!isValid)
    {
        return BadRequest(new { error = errorMessage });
    }

    // Continuar...
}
```

### Validar Tamaño de Contenido

```csharp
[HttpPost]
public async Task<IActionResult> UploadFile(IFormFile file)
{
    var (isValid, errorMessage) = RequestValidationHelper.ValidateContentLength(
        Request,
        maxSizeBytes: 10 * 1024 * 1024 // 10 MB
    );
    
    if (!isValid)
    {
        return BadRequest(new { error = errorMessage });
    }

    // Continuar...
}
```

### Validar Accept Header

```csharp
[HttpGet]
public async Task<IActionResult> GetProducts()
{
    var (isValid, errorMessage) = RequestValidationHelper.ValidateAcceptHeader(
        Request,
        "application/json",
        "application/xml"
    );
    
    if (!isValid)
    {
        return StatusCode(406, new { error = errorMessage }); // Not Acceptable
    }

    // Continuar...
}
```

## Respuestas de Error

### Header Faltante

```json
{
  "success": false,
  "message": "Headers requeridos faltantes",
  "errorCode": "MISSING_REQUIRED_HEADERS",
  "missingHeaders": ["X-API-Key"],
  "requestId": "abc123"
}
```

### User-Agent Faltante

```json
{
  "success": false,
  "message": "User-Agent header es requerido",
  "errorCode": "MISSING_USER_AGENT",
  "requestId": "abc123"
}
```

### Contenido Demasiado Grande

```json
{
  "success": false,
  "message": "El tamaño del contenido excede el límite máximo de 10.00 MB",
  "errorCode": "CONTENT_TOO_LARGE",
  "maxSizeBytes": 10485760,
  "requestId": "abc123"
}
```

### Método No Permitido

```json
{
  "success": false,
  "message": "Método HTTP 'TRACE' no permitido",
  "errorCode": "METHOD_NOT_ALLOWED",
  "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
  "requestId": "abc123"
}
```

## Paths Excluidos

Por defecto, estos paths NO se validan:
- `/swagger` - Documentación Swagger
- `/health` - Health Checks
- `/metrics` - Métricas

Puedes agregar más paths en la configuración.

## Mejores Prácticas

1. **Headers Requeridos**: Usar para APIs que requieren autenticación o identificación
2. **User-Agent**: Requerir para prevenir bots maliciosos (pero puede bloquear clientes legítimos)
3. **Content-Length**: Limitar para prevenir ataques de DoS
4. **Métodos HTTP**: Limitar a los métodos realmente necesarios
5. **Validación Manual**: Usar para validaciones específicas de endpoint

## Casos de Uso

### API Pública con API Key

```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "RequiredHeaders": ["X-API-Key"],
    "RequireUserAgent": true
  }
}
```

### API Interna con Métodos Limitados

```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "AllowedMethods": ["GET", "POST"],
    "MaxContentLengthBytes": 5242880
  }
}
```

### API de Upload con Límite de Tamaño

```json
{
  "RequestValidation": {
    "EnableValidation": true,
    "MaxContentLengthBytes": 104857600,
    "RequiredHeaders": ["Content-Type"]
  }
}
```

## Troubleshooting

### Requests legítimas son rechazadas

- Verificar configuración de `RequiredHeaders`
- Verificar `RequireUserAgent` si está habilitado
- Verificar `AllowedMethods` si está configurado
- Agregar path a `ExcludedPaths` si es necesario

### Error 413 Payload Too Large

- Verificar `MaxContentLengthBytes` en configuración
- Aumentar límite si es necesario
- Verificar que el límite sea consistente con `RequestLimits:MaxRequestBodySize`

### Método HTTP no permitido

- Verificar `AllowedMethods` en configuración
- Agregar método necesario a la lista
- O establecer a `null` para permitir todos

## Referencias

- [ASP.NET Core Middleware](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/middleware/)
- [HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)

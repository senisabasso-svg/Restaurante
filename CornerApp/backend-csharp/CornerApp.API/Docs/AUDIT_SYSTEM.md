# Sistema de Auditoría

## Descripción

Este documento describe el sistema de auditoría implementado en CornerApp API para rastrear cambios importantes, acciones de usuarios y eventos del sistema.

## ¿Qué es un Sistema de Auditoría?

Un sistema de auditoría registra quién hizo qué, cuándo y cómo. Es esencial para:
- **Compliance**: Cumplimiento de regulaciones (GDPR, SOX, etc.)
- **Seguridad**: Detección de accesos no autorizados
- **Debugging**: Rastrear problemas y cambios
- **Accountability**: Responsabilidad de acciones
- **Análisis**: Entender el uso del sistema

## Componentes

### 1. IAuditService / AuditService

Servicio principal para registrar y consultar eventos de auditoría:

```csharp
public interface IAuditService
{
    Task LogAsync(AuditEvent auditEvent);
    void Log(AuditEvent auditEvent);
    Task<List<AuditEvent>> GetEventsAsync(AuditQuery query);
    Task<List<AuditEvent>> GetEventsForEntityAsync(string entityType, int entityId);
}
```

### 2. AuditHelper

Helper estático para facilitar la creación de eventos:

```csharp
var auditEvent = AuditHelper.CreateEvent(
    HttpContext,
    action: "Update",
    entityType: "Product",
    entityId: productId,
    oldValues: oldProductDict,
    newValues: newProductDict
);
```

### 3. AuditAttribute

Atributo para registrar automáticamente eventos:

```csharp
[Audit("Update", "Product")]
[HttpPut("{id}")]
public async Task<IActionResult> UpdateProduct(...)
{
    // El evento se registra automáticamente
}
```

### 4. AuditController

Controller para consultar eventos de auditoría:
- `GET /api/audit` - Obtener eventos con filtros
- `GET /api/audit/entity/{type}/{id}` - Eventos para una entidad

## Configuración

### appsettings.json

```json
{
  "Audit": {
    "EnableDatabaseAudit": true,
    "EnableFileAudit": false,
    "LogPath": "logs/audit.log",
    "LogActions": [
      "Create",
      "Update",
      "Delete",
      "Login",
      "Logout",
      "PasswordChange"
    ]
  }
}
```

**Parámetros**:
- `EnableDatabaseAudit`: Guardar eventos en base de datos (default: true)
- `EnableFileAudit`: Guardar eventos en archivo (default: false)
- `LogPath`: Ruta del archivo de log (default: "logs/audit.log")
- `LogActions`: Lista de acciones a registrar

## Uso

### Opción 1: Uso Manual en Controladores

```csharp
[HttpPut("{id}")]
public async Task<IActionResult> UpdateProduct(int id, UpdateProductRequest request)
{
    var product = await _context.Products.FindAsync(id);
    if (product == null)
    {
        return NotFound();
    }

    // Guardar valores antiguos
    var oldValues = new Dictionary<string, object>
    {
        ["Name"] = product.Name,
        ["Price"] = product.Price
    };

    // Actualizar
    product.Name = request.Name;
    product.Price = request.Price;
    await _context.SaveChangesAsync();

    // Guardar valores nuevos
    var newValues = new Dictionary<string, object>
    {
        ["Name"] = product.Name,
        ["Price"] = product.Price
    };

    // Registrar evento de auditoría
    var auditEvent = AuditHelper.CreateEvent(
        HttpContext,
        action: "Update",
        entityType: "Product",
        entityId: id,
        oldValues: oldValues,
        newValues: newValues,
        description: $"Producto {product.Name} actualizado"
    );

    await _auditService.LogAsync(auditEvent);

    return Ok(product);
}
```

### Opción 2: Atributo Automático

```csharp
[Audit("Update", "Product")]
[HttpPut("{id}")]
public async Task<IActionResult> UpdateProduct(int id, UpdateProductRequest request)
{
    // El evento se registra automáticamente
    var product = await _context.Products.FindAsync(id);
    // ... actualizar producto
    return Ok(product);
}
```

### Opción 3: Eventos de Autenticación

```csharp
[HttpPost("login")]
public async Task<IActionResult> Login(LoginRequest request)
{
    // ... lógica de login
    
    if (loginSuccessful)
    {
        var auditEvent = AuditHelper.CreateEvent(
            HttpContext,
            action: "Login",
            entityType: "User",
            entityId: user.Id,
            description: $"Usuario {user.Email} inició sesión"
        );

        await _auditService.LogAsync(auditEvent);
    }

    return Ok(token);
}
```

## Consultar Eventos

### Obtener Eventos con Filtros

```bash
GET /api/audit?entityType=Product&userId=1&action=Update&fromDate=2024-01-01&page=1&pageSize=50
```

### Obtener Eventos para una Entidad

```bash
GET /api/audit/entity/Product/123
```

## Estructura de AuditEvent

```csharp
public class AuditEvent
{
    public int Id { get; set; }
    public string Action { get; set; }              // Create, Update, Delete, Login
    public string EntityType { get; set; }         // Product, Order, Customer
    public int? EntityId { get; set; }              // ID de la entidad
    public int? UserId { get; set; }                // ID del usuario
    public string? UserName { get; set; }           // Nombre del usuario
    public string? IpAddress { get; set; }          // IP del cliente
    public string? UserAgent { get; set; }          // User-Agent del cliente
    public Dictionary<string, object>? OldValues { get; set; }  // Valores antiguos
    public Dictionary<string, object>? NewValues { get; set; }  // Valores nuevos
    public string? Description { get; set; }        // Descripción del evento
    public DateTime Timestamp { get; set; }         // Fecha/hora del evento
    public string? RequestId { get; set; }         // Request ID para correlación
    public string? AdditionalData { get; set; }    // Datos adicionales (JSON)
}
```

## Casos de Uso

### 1. Rastrear Cambios en Productos

```csharp
[Audit("Update", "Product")]
[HttpPut("{id}")]
public async Task<IActionResult> UpdateProduct(...)
{
    // Cambios registrados automáticamente
}
```

### 2. Rastrear Accesos

```csharp
[HttpPost("login")]
public async Task<IActionResult> Login(...)
{
    var auditEvent = AuditHelper.CreateEvent(
        HttpContext,
        "Login",
        "User",
        userId: user.Id
    );
    await _auditService.LogAsync(auditEvent);
}
```

### 3. Rastrear Eliminaciones

```csharp
[Audit("Delete", "Order")]
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteOrder(int id)
{
    // Eliminación registrada automáticamente
}
```

## Mejores Prácticas

1. **Registrar Acciones Críticas**: Login, cambios de contraseña, eliminaciones
2. **Incluir Contexto**: IP, User-Agent, Request ID
3. **Valores Antiguos y Nuevos**: Para cambios, registrar ambos
4. **No Registrar Datos Sensibles**: Evitar passwords, tokens, etc.
5. **Performance**: Usar logging asíncrono para no bloquear requests
6. **Retención**: Definir políticas de retención de logs

## Seguridad

- **Autenticación Requerida**: Solo usuarios autenticados pueden ver auditoría
- **Autorización**: Considerar roles para ver diferentes tipos de eventos
- **Datos Sensibles**: No registrar passwords, tokens, datos de tarjetas
- **Encriptación**: Considerar encriptar logs en reposo

## Troubleshooting

### Eventos no se registran

- Verificar que `EnableDatabaseAudit` o `EnableFileAudit` esté en `true`
- Verificar logs para errores
- Verificar que el servicio esté registrado en DI

### Performance degradada

- Usar logging asíncrono (`LogAsync` en lugar de `Log`)
- Considerar procesamiento en background
- Limitar cantidad de datos en `OldValues`/`NewValues`

### Archivo de log muy grande

- Implementar rotación de logs
- Configurar retención de logs
- Considerar compresión de logs antiguos

## Referencias

- [Audit Logging Best Practices](https://owasp.org/www-community/Logging)
- [GDPR Compliance](https://gdpr.eu/)
- [SOX Compliance](https://www.soxlaw.com/)

# Logging con Serilog

## 📋 Configuración

El proyecto usa **Serilog** para logging estructurado, que proporciona:

- ✅ Logs estructurados en formato JSON
- ✅ Rotación automática de archivos
- ✅ Enriquecimiento con contexto (máquina, entorno, thread)
- ✅ Múltiples sinks (consola y archivo)
- ✅ Configuración por ambiente

## 📁 Ubicación de Logs

Los logs se guardan en:
```
logs/cornerapp-YYYYMMDD.log
```

- **Rotación diaria**: Un archivo por día
- **Retención**: 
  - Desarrollo: 30 días
  - Producción: 90 días
- **Formato**: Texto estructurado con timestamps

## 🔍 Niveles de Log

### Desarrollo
- `Information`: Eventos generales de la aplicación
- `Warning`: Advertencias y errores recuperables
- `Error`: Errores que requieren atención

### Producción
- `Warning`: Solo advertencias y errores
- `Error`: Solo errores críticos
- `Information`: Solo para eventos importantes de la aplicación

## 📊 Enriquecimiento de Logs

Cada log incluye automáticamente:
- **Timestamp**: Fecha y hora exacta
- **Level**: Nivel de log (Information, Warning, Error)
- **Message**: Mensaje del log
- **Properties**: Propiedades adicionales del contexto
- **Exception**: Stack trace si hay excepción
- **Environment**: Nombre del ambiente (Development, Production)
- **MachineName**: Nombre de la máquina
- **ThreadId**: ID del thread

## 💡 Ejemplos de Uso

### En Controladores

```csharp
public class OrdersController : ControllerBase
{
    private readonly ILogger<OrdersController> _logger;

    public OrdersController(ILogger<OrdersController> logger)
    {
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        _logger.LogInformation("Creando pedido para cliente {CustomerName}", request.CustomerName);
        
        try
        {
            // ... lógica ...
            _logger.LogInformation("Pedido {OrderId} creado exitosamente", order.Id);
            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido para {CustomerName}", request.CustomerName);
            throw;
        }
    }
}
```

### Logging Estructurado

```csharp
_logger.LogInformation(
    "Pedido {OrderId} actualizado. Estado: {OldStatus} -> {NewStatus}. Cliente: {CustomerId}",
    order.Id,
    oldStatus,
    newStatus,
    order.CustomerId
);
```

## 🔧 Configuración Avanzada

### Agregar Sink Adicional (Azure, Seq, etc.)

En `Program.cs`, agregar después de `WriteTo.File`:

```csharp
.WriteTo.AzureTableStorage(
    connectionString: builder.Configuration["AzureStorage:ConnectionString"],
    storageTableName: "Logs")
```

### Cambiar Formato de Logs

En `appsettings.json`, modificar `outputTemplate`:

```json
"outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] [{SourceContext}] {Message:lj}{NewLine}{Exception}"
```

## 📈 Monitoreo en Producción

### Recomendaciones

1. **Centralizar Logs**: Usar Azure Log Analytics, Application Insights, o Seq
2. **Alertas**: Configurar alertas para errores críticos
3. **Análisis**: Usar herramientas de análisis de logs para detectar patrones
4. **Retención**: Ajustar `retainedFileCountLimit` según necesidades

### Integración con Azure Application Insights

```csharp
.WriteTo.ApplicationInsights(
    telemetryConfiguration,
    TelemetryConverter.Traces)
```

## 🚨 Logs Sensibles

**IMPORTANTE**: Nunca loguear:
- ❌ Contraseñas
- ❌ Tokens JWT completos
- ❌ Información de tarjetas de crédito
- ❌ Datos personales sensibles

Si necesitas debuggear, usa:
```csharp
_logger.LogDebug("Token recibido: {TokenPrefix}...", token?.Substring(0, 10));
```

## 📝 Mejores Prácticas

1. **Usar niveles apropiados**:
   - `Information`: Flujo normal de la aplicación
   - `Warning`: Situaciones inusuales pero manejables
   - `Error`: Errores que requieren atención
   - `Critical`: Errores que pueden causar caída del sistema

2. **Incluir contexto**:
   ```csharp
   _logger.LogError(ex, "Error al procesar pedido {OrderId} del cliente {CustomerId}", 
       orderId, customerId);
   ```

3. **No loguear en loops**:
   ```csharp
   // ❌ Malo
   foreach (var item in items)
   {
       _logger.LogInformation("Procesando item {ItemId}", item.Id);
   }
   
   // ✅ Bueno
   _logger.LogInformation("Procesando {Count} items", items.Count);
   ```

4. **Usar structured logging**:
   ```csharp
   _logger.LogInformation("Usuario {UserId} realizó acción {Action} en {Resource}", 
       userId, action, resource);
   ```

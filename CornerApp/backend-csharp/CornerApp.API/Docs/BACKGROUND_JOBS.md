# Background Jobs y Tareas Asíncronas

## Descripción

Este documento describe el sistema de Background Jobs implementado en CornerApp API para procesamiento asíncrono de tareas.

## Componentes

### 1. IBackgroundTaskQueue / BackgroundTaskQueue

Cola de tareas en segundo plano basada en `System.Threading.Channels`:

- **Capacidad**: 100 tareas por defecto (configurable)
- **Modo**: BoundedChannel con modo `Wait` (espera cuando está llena)
- **Thread-safe**: Seguro para uso concurrente

**Uso:**
```csharp
await _backgroundTaskQueue.QueueBackgroundWorkItemAsync(async cancellationToken =>
{
    // Tu lógica aquí
    await ProcessSomethingAsync(cancellationToken);
});
```

### 2. QueuedHostedService

Servicio hospedado (`BackgroundService`) que procesa tareas de la cola:

- Se ejecuta automáticamente al iniciar la aplicación
- Procesa tareas de forma secuencial
- Maneja errores y logging automáticamente
- Se detiene gracefulmente al cerrar la aplicación

### 3. CacheCleanupService

Servicio en segundo plano para limpieza periódica de cache:

- **Intervalo**: Cada 30 minutos por defecto (configurable)
- **Propósito**: Limpiar entradas de cache expiradas
- **Configuración**: `BackgroundJobs:CacheCleanup` en `appsettings.json`

### 4. OrderProcessingService

Servicio para procesar pedidos en segundo plano:

- **Método**: `QueueOrderProcessingAsync(int orderId)`
- **Uso**: Se llama automáticamente al crear un pedido
- **Propósito**: 
  - Actualizar inventario
  - Enviar notificaciones
  - Generar facturas
  - Actualizar puntos de lealtad
  - etc.

## Configuración

### appsettings.json

```json
{
  "BackgroundJobs": {
    "EnableBackgroundJobs": true,
    "CacheCleanup": {
      "Enabled": true,
      "IntervalMinutes": 30,
      "ExpirationThresholdMinutes": 60
    }
  }
}
```

### Variables de Entorno

- `BackgroundJobs__EnableBackgroundJobs`: Habilitar/deshabilitar todos los background jobs
- `BackgroundJobs__CacheCleanup__Enabled`: Habilitar/deshabilitar limpieza de cache
- `BackgroundJobs__CacheCleanup__IntervalMinutes`: Intervalo de limpieza en minutos

## Uso en Controladores

### Ejemplo: Procesar pedido en segundo plano

```csharp
public class OrdersController : ControllerBase
{
    private readonly OrderProcessingService _orderProcessingService;

    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        // Crear pedido...
        var order = new Order { ... };
        await _context.SaveChangesAsync();

        // Procesar en segundo plano
        await _orderProcessingService.QueueOrderProcessingAsync(order.Id);

        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
    }
}
```

### Ejemplo: Usar cola directamente

```csharp
public class MyController : ControllerBase
{
    private readonly IBackgroundTaskQueue _backgroundTaskQueue;

    [HttpPost]
    public async Task<IActionResult> DoSomething()
    {
        await _backgroundTaskQueue.QueueBackgroundWorkItemAsync(async cancellationToken =>
        {
            // Procesar algo pesado
            await HeavyProcessingAsync(cancellationToken);
        });

        return Ok(new { message = "Tarea encolada" });
    }
}
```

## Mejores Prácticas

1. **Manejo de Errores**: Siempre maneja excepciones dentro de las tareas
2. **Cancellation Tokens**: Respeta `cancellationToken` para detención graceful
3. **Logging**: Registra inicio, progreso y finalización de tareas
4. **Timeouts**: Configura timeouts apropiados para tareas largas
5. **Idempotencia**: Diseña tareas para ser idempotentes cuando sea posible
6. **Resource Limits**: No encoles demasiadas tareas simultáneamente

## Monitoreo

### Logs

Los servicios de background jobs registran:
- Inicio/detención de servicios
- Ejecución de tareas
- Errores durante procesamiento
- Métricas de rendimiento

### Métricas

Puedes extender `MetricsService` para rastrear:
- Número de tareas encoladas
- Tiempo de procesamiento
- Tareas fallidas
- Tamaño de la cola

## Extensión

### Agregar Nuevo Background Service

1. Crear clase que herede de `BackgroundService`:

```csharp
public class MyBackgroundService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Tu lógica periódica
            await DoWorkAsync();
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
```

2. Registrar en `Program.cs`:

```csharp
builder.Services.AddHostedService<MyBackgroundService>();
```

### Agregar Nueva Tarea a la Cola

```csharp
await _backgroundTaskQueue.QueueBackgroundWorkItemAsync(async cancellationToken =>
{
    // Tu lógica aquí
});
```

## Troubleshooting

### Tareas no se ejecutan

- Verificar que `EnableBackgroundJobs` esté en `true`
- Revisar logs para errores en `QueuedHostedService`
- Verificar que la aplicación no esté siendo detenida

### Cola llena

- Aumentar capacidad en `BackgroundTaskQueue` constructor
- Procesar tareas más rápido
- Implementar priorización de tareas

### Alto uso de memoria

- Reducir número de tareas encoladas
- Implementar límites de concurrencia
- Optimizar lógica de procesamiento

## Referencias

- [ASP.NET Core Background Services](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services)
- [System.Threading.Channels](https://docs.microsoft.com/en-us/dotnet/api/system.threading.channels)
- [BackgroundService Class](https://docs.microsoft.com/en-us/dotnet/api/microsoft.extensions.hosting.backgroundservice)

# Message Queue - Sistema de Colas de Mensajes

## Descripción

Este documento describe el sistema de Message Queue implementado en CornerApp API usando RabbitMQ para procesamiento asíncrono de eventos.

## ¿Qué es Message Queue?

Un sistema de colas de mensajes permite:
- **Procesamiento asíncrono**: Desacoplar operaciones que no requieren respuesta inmediata
- **Escalabilidad**: Procesar mensajes en paralelo con múltiples consumidores
- **Confiabilidad**: Garantizar que los mensajes se procesen incluso si hay fallos temporales
- **Resiliencia**: Re-encolar mensajes fallidos para reintento

## Arquitectura

```
API Controller → RabbitMQ → Message Consumer → Procesamiento Asíncrono
```

### Componentes

1. **IMessageQueueService**: Interfaz para publicar y consumir mensajes
2. **RabbitMQService**: Implementación usando RabbitMQ
3. **DummyMessageQueueService**: Implementación dummy cuando RabbitMQ está deshabilitado
4. **OrderMessageConsumer**: Consumidor de mensajes de órdenes

## Configuración

### appsettings.json

```json
{
  "RabbitMQ": {
    "Enabled": true,
    "HostName": "localhost",
    "Port": 5672,
    "UserName": "guest",
    "Password": "guest",
    "VirtualHost": "/"
  }
}
```

### Variables de Entorno

```bash
RabbitMQ__Enabled=true
RabbitMQ__HostName=rabbitmq
RabbitMQ__Port=5672
RabbitMQ__UserName=guest
RabbitMQ__Password=guest
RabbitMQ__VirtualHost=/
```

### Docker Compose

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: cornerapp-rabbitmq
    ports:
      - "5672:5672"   # AMQP port
      - "15672:15672" # Management UI
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
```

## Uso

### Publicar Mensaje

```csharp
public class OrdersController : ControllerBase
{
    private readonly IMessageQueueService _messageQueue;
    
    public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
    {
        // ... crear orden ...
        
        // Publicar mensaje
        var message = new OrderCreatedMessage
        {
            OrderId = order.Id,
            CustomerId = order.CustomerId ?? 0,
            CustomerName = order.CustomerName,
            Status = order.Status,
            TotalAmount = order.Total,
            CreatedAt = order.CreatedAt,
            Items = order.Items.Select(item => new OrderItemMessage
            {
                ProductId = item.ProductId,
                ProductName = item.ProductName,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                Subtotal = item.Subtotal
            }).ToList()
        };
        
        await _messageQueue.PublishAsync("orders.created", message);
    }
}
```

### Consumir Mensajes

```csharp
public class OrderMessageConsumer : BackgroundService
{
    private readonly IMessageQueueService _messageQueue;
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _messageQueue.ConnectAsync(stoppingToken);
        await _messageQueue.SubscribeAsync<OrderCreatedMessage>(
            "orders.created",
            HandleOrderCreatedMessage,
            stoppingToken);
    }
    
    private async Task HandleOrderCreatedMessage(
        OrderCreatedMessage message, 
        CancellationToken cancellationToken)
    {
        // Procesar mensaje
        // Ejemplo: enviar notificaciones, actualizar inventario, etc.
    }
}
```

## Tipos de Mensajes

### OrderCreatedMessage

Publicado cuando se crea una nueva orden.

```csharp
public class OrderCreatedMessage
{
    public int OrderId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; }
    public string Status { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemMessage> Items { get; set; }
}
```

## Colas Disponibles

### orders.created

**Propósito**: Notificar cuando se crea una nueva orden

**Mensaje**: `OrderCreatedMessage`

**Uso**:
- Enviar notificaciones push
- Actualizar inventario
- Generar reportes
- Integración con sistemas externos

## RabbitMQ Management UI

Acceder a la interfaz de administración:

```
URL: http://localhost:15672
Usuario: guest
Contraseña: guest
```

### Funcionalidades

- Ver colas y mensajes
- Monitorear conexiones
- Ver estadísticas
- Gestionar exchanges y bindings

## Modo Dummy

Cuando RabbitMQ está deshabilitado (`RabbitMQ:Enabled: false`), se usa `DummyMessageQueueService`:

- **No-op**: Los mensajes no se publican realmente
- **Logging**: Se registra que se intentó publicar
- **Sin errores**: La aplicación funciona normalmente

Útil para:
- Desarrollo local sin RabbitMQ
- Testing
- Despliegues sin cola de mensajes

## Mejores Prácticas

### 1. Manejo de Errores

```csharp
try
{
    await _messageQueue.PublishAsync("orders.created", message);
}
catch (Exception ex)
{
    // No fallar la operación principal si la publicación falla
    _logger.LogWarning(ex, "No se pudo publicar mensaje");
}
```

### 2. Mensajes Idempotentes

Diseñar mensajes para que sean procesables múltiples veces:

```csharp
// ✅ Bueno - Idempotente
public async Task HandleOrderCreated(OrderCreatedMessage message)
{
    var order = await _dbContext.Orders.FindAsync(message.OrderId);
    if (order == null) return; // Ya procesado
    
    // Procesar...
}

// ❌ Malo - No idempotente
public async Task HandleOrderCreated(OrderCreatedMessage message)
{
    // Siempre procesa, puede duplicar trabajo
    await SendNotification(message.OrderId);
}
```

### 3. Acknowledgment

Los mensajes se confirman automáticamente después de procesarse exitosamente. Si hay un error, se re-encolan.

### 4. QoS (Quality of Service)

Configurado para procesar un mensaje a la vez por consumidor:

```csharp
_channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);
```

## Troubleshooting

### RabbitMQ no se conecta

1. **Verificar que RabbitMQ esté corriendo**:
```bash
docker ps | grep rabbitmq
```

2. **Verificar configuración**:
```json
{
  "RabbitMQ": {
    "Enabled": true,
    "HostName": "rabbitmq"  // En Docker, usar nombre del servicio
  }
}
```

3. **Verificar logs**:
```
[INFO] Conectado a RabbitMQ en rabbitmq:5672
```

### Mensajes no se procesan

1. **Verificar que el consumidor esté corriendo**:
```bash
# Ver logs del consumidor
docker logs cornerapp-api | grep OrderMessageConsumer
```

2. **Verificar cola en Management UI**:
- Ir a http://localhost:15672
- Verificar que la cola `orders.created` existe
- Verificar que hay mensajes en la cola

3. **Verificar errores en logs**:
```
[ERROR] Error al procesar mensaje de cola orders.created
```

### Mensajes se re-encolan infinitamente

1. **Verificar manejo de errores**:
```csharp
try
{
    await ProcessMessage(message);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error al procesar mensaje");
    throw; // Re-lanzar para re-encolar
}
```

2. **Implementar dead letter queue** (avanzado):
```csharp
_channel.QueueDeclare(
    queue: "orders.created",
    durable: true,
    exclusive: false,
    autoDelete: false,
    arguments: new Dictionary<string, object>
    {
        { "x-dead-letter-exchange", "dlx" }
    });
```

## Escalabilidad

### Múltiples Consumidores

RabbitMQ distribuye mensajes entre múltiples consumidores automáticamente:

```
Consumer 1 ←─┐
Consumer 2 ←─┼─ RabbitMQ ── Message 1, 2, 3, 4...
Consumer 3 ←─┘
```

### Particionado

Para alta carga, usar múltiples colas:

```csharp
// Cola por región
await _messageQueue.PublishAsync($"orders.{region}.created", message);
```

## Seguridad

### Producción

1. **Cambiar credenciales por defecto**:
```yaml
environment:
  - RABBITMQ_DEFAULT_USER=admin
  - RABBITMQ_DEFAULT_PASS=strong-password
```

2. **Usar TLS/SSL**:
```csharp
var factory = new ConnectionFactory
{
    Ssl = new SslOption
    {
        Enabled = true,
        ServerName = "rabbitmq.example.com"
    }
};
```

3. **Restringir acceso**:
- Firewall
- VPN
- Network policies

## Referencias

- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [RabbitMQ .NET Client](https://www.rabbitmq.com/dotnet.html)
- [Message Queue Patterns](https://www.rabbitmq.com/tutorials/tutorial-one-dotnet.html)

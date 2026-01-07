using CornerApp.API.Data;
using CornerApp.API.Models.Messages;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Consumidor de mensajes de órdenes desde RabbitMQ
/// </summary>
public class OrderMessageConsumer : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMessageQueueService _messageQueue;
    private readonly ILogger<OrderMessageConsumer> _logger;
    private const string ORDER_QUEUE_NAME = "orders.created";

    public OrderMessageConsumer(
        IServiceProvider serviceProvider,
        IMessageQueueService messageQueue,
        ILogger<OrderMessageConsumer> logger)
    {
        _serviceProvider = serviceProvider;
        _messageQueue = messageQueue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OrderMessageConsumer iniciado");

        try
        {
            await _messageQueue.ConnectAsync(stoppingToken);
            await _messageQueue.SubscribeAsync<OrderCreatedMessage>(
                ORDER_QUEUE_NAME,
                HandleOrderCreatedMessage,
                stoppingToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en OrderMessageConsumer");
        }

        // Mantener el servicio corriendo
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(1000, stoppingToken);
        }
    }

    private async Task HandleOrderCreatedMessage(OrderCreatedMessage message, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Procesando mensaje de orden creada: OrderId={OrderId}, CustomerId={CustomerId}", 
            message.OrderId, message.CustomerId);

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // Aquí puedes agregar lógica de procesamiento asíncrono
            // Por ejemplo: enviar notificaciones, actualizar inventario, etc.
            
            // Ejemplo: Verificar que la orden existe
            var orderExists = await dbContext.Orders
                .AnyAsync(o => o.Id == message.OrderId, cancellationToken);
            
            if (!orderExists)
            {
                _logger.LogWarning("Orden {OrderId} no encontrada en la base de datos", message.OrderId);
                return;
            }
            
            _logger.LogInformation("Orden {OrderId} procesada exitosamente", message.OrderId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al procesar mensaje de orden {OrderId}", message.OrderId);
            throw; // Re-lanzar para que RabbitMQ re-encolé el mensaje
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("OrderMessageConsumer deteniéndose");
        await _messageQueue.DisconnectAsync(cancellationToken);
        await base.StopAsync(cancellationToken);
    }
}

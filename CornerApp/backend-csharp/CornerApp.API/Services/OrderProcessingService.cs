using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Constants;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para procesar pedidos en segundo plano
/// </summary>
public class OrderProcessingService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<OrderProcessingService> _logger;
    private readonly IBackgroundTaskQueue _backgroundTaskQueue;

    public OrderProcessingService(
        ApplicationDbContext context,
        ILogger<OrderProcessingService> logger,
        IBackgroundTaskQueue backgroundTaskQueue)
    {
        _context = context;
        _logger = logger;
        _backgroundTaskQueue = backgroundTaskQueue;
    }

    /// <summary>
    /// Procesa un pedido en segundo plano (ej: actualizar inventario, enviar notificaciones)
    /// </summary>
    public async Task QueueOrderProcessingAsync(int orderId)
    {
        await _backgroundTaskQueue.QueueBackgroundWorkItemAsync(async cancellationToken =>
        {
            try
            {
                _logger.LogInformation("Procesando pedido {OrderId} en segundo plano", orderId);

                var order = await _context.Orders
                    .Include(o => o.Items)
                    .FirstOrDefaultAsync(o => o.Id == orderId, cancellationToken);

                if (order == null)
                {
                    _logger.LogWarning("Pedido {OrderId} no encontrado para procesamiento", orderId);
                    return;
                }

                // Aquí puedes agregar lógica de procesamiento:
                // - Actualizar inventario
                // - Enviar notificaciones por email/SMS
                // - Generar facturas
                // - Actualizar puntos de lealtad
                // - etc.

                _logger.LogInformation("Pedido {OrderId} procesado exitosamente", orderId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar pedido {OrderId}: {Message}", orderId, ex.Message);
                throw;
            }
        });
    }

    /// <summary>
    /// Procesa pedidos pendientes en lote
    /// </summary>
    public async Task ProcessPendingOrdersAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var pendingOrders = await _context.Orders
                .Where(o => o.Status == OrderConstants.STATUS_PENDING && !o.IsArchived)
                .OrderBy(o => o.CreatedAt)
                .Take(50) // Procesar máximo 50 a la vez
                .ToListAsync(cancellationToken);

            _logger.LogInformation("Procesando {Count} pedidos pendientes", pendingOrders.Count);

            foreach (var order in pendingOrders)
            {
                await QueueOrderProcessingAsync(order.Id);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al procesar pedidos pendientes: {Message}", ex.Message);
        }
    }
}

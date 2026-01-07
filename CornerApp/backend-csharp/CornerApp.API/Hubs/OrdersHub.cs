using Microsoft.AspNetCore.SignalR;

namespace CornerApp.API.Hubs;

/// <summary>
/// Hub de SignalR para notificaciones en tiempo real de pedidos
/// </summary>
public class OrdersHub : Hub
{
    private readonly ILogger<OrdersHub> _logger;

    public OrdersHub(ILogger<OrdersHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Cliente conectado al hub de pedidos: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Cliente desconectado del hub de pedidos: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Permite a los clientes unirse a un grupo específico (ej: admin, delivery)
    /// </summary>
    public async Task JoinGroup(string groupName)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Cliente {ConnectionId} se unió al grupo {Group}", Context.ConnectionId, groupName);
    }

    /// <summary>
    /// Permite a los clientes salir de un grupo
    /// </summary>
    public async Task LeaveGroup(string groupName)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
        _logger.LogInformation("Cliente {ConnectionId} salió del grupo {Group}", Context.ConnectionId, groupName);
    }
}

/// <summary>
/// Interfaz para el servicio de notificaciones de pedidos
/// </summary>
public interface IOrderNotificationService
{
    Task NotifyOrderCreated(object order);
    Task NotifyOrderUpdated(object order);
    Task NotifyOrderStatusChanged(int orderId, string newStatus, string? deliveryPersonName = null);
    Task NotifyOrderDeleted(int orderId);
}

/// <summary>
/// Servicio para enviar notificaciones de pedidos via SignalR
/// </summary>
public class OrderNotificationService : IOrderNotificationService
{
    private readonly IHubContext<OrdersHub> _hubContext;
    private readonly ILogger<OrderNotificationService> _logger;

    public OrderNotificationService(IHubContext<OrdersHub> hubContext, ILogger<OrderNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyOrderCreated(object order)
    {
        _logger.LogInformation("Notificando nuevo pedido a todos los clientes");
        await _hubContext.Clients.All.SendAsync("OrderCreated", order);
        await _hubContext.Clients.Group("admin").SendAsync("OrderCreated", order);
    }

    public async Task NotifyOrderUpdated(object order)
    {
        _logger.LogInformation("Notificando actualización de pedido a todos los clientes");
        await _hubContext.Clients.All.SendAsync("OrderUpdated", order);
        await _hubContext.Clients.Group("admin").SendAsync("OrderUpdated", order);
    }

    public async Task NotifyOrderStatusChanged(int orderId, string newStatus, string? deliveryPersonName = null)
    {
        _logger.LogInformation("Notificando cambio de estado del pedido {OrderId} a {Status}", orderId, newStatus);
        var notification = new { orderId, status = newStatus, deliveryPersonName, timestamp = DateTime.UtcNow };
        await _hubContext.Clients.All.SendAsync("OrderStatusChanged", notification);
        await _hubContext.Clients.Group("admin").SendAsync("OrderStatusChanged", notification);
    }

    public async Task NotifyOrderDeleted(int orderId)
    {
        _logger.LogInformation("Notificando eliminación del pedido {OrderId}", orderId);
        await _hubContext.Clients.All.SendAsync("OrderDeleted", new { orderId });
        await _hubContext.Clients.Group("admin").SendAsync("OrderDeleted", new { orderId });
    }
}


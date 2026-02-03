using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.Constants;
using CornerApp.API.Services;
using CornerApp.API.Hubs;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de caja de repartidor
/// Permite que los repartidores abran/cierren su caja y gestionen pedidos desde la app web
/// </summary>
[ApiController]
[Route("api/delivery-cash-register")]
[Tags("Repartidores - Caja")]
[Authorize] // Requiere autenticación de repartidor
public class DeliveryCashRegisterController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DeliveryCashRegisterController> _logger;
    private readonly IOrderNotificationService _orderNotificationService;

    public DeliveryCashRegisterController(
        ApplicationDbContext context,
        ILogger<DeliveryCashRegisterController> logger,
        IOrderNotificationService orderNotificationService)
    {
        _context = context;
        _logger = logger;
        _orderNotificationService = orderNotificationService;
    }

    /// <summary>
    /// Obtiene el ID del repartidor autenticado desde el token
    /// </summary>
    private int? GetDeliveryPersonId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return null;
        }
        return userId;
    }

    /// <summary>
    /// Obtiene el estado actual de la caja del repartidor (si está abierta o cerrada)
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult> GetCashRegisterStatus()
    {
        try
        {
            var deliveryPersonId = GetDeliveryPersonId();
            if (!deliveryPersonId.HasValue)
            {
                return Unauthorized(new { error = "Token inválido" });
            }

            // Obtener RestaurantId del repartidor
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == deliveryPersonId.Value);
            
            if (deliveryPerson == null)
            {
                return Unauthorized(new { error = "Repartidor no encontrado" });
            }

            var restaurantId = deliveryPerson.RestaurantId;

            var openCashRegister = await _context.DeliveryCashRegisters
                .Include(dcr => dcr.DeliveryPerson)
                .Where(c => c.DeliveryPersonId == deliveryPersonId.Value && c.RestaurantId == restaurantId && c.IsOpen)
                .OrderByDescending(c => c.OpenedAt)
                .FirstOrDefaultAsync();

            if (openCashRegister == null)
            {
                return Ok(new { isOpen = false, cashRegister = (object?)null });
            }

            // Obtener pedidos asignados a este repartidor durante esta sesión (del mismo restaurante)
            var orders = await _context.Orders
                .Where(o => o.DeliveryPersonId == deliveryPersonId.Value
                    && o.RestaurantId == restaurantId
                    && o.CreatedAt >= openCashRegister.OpenedAt
                    && !o.IsArchived)
                .ToListAsync();

            var activeOrders = orders.Where(o => 
                o.Status == OrderConstants.STATUS_PENDING ||
                o.Status == OrderConstants.STATUS_PREPARING ||
                o.Status == OrderConstants.STATUS_DELIVERING
            ).Count();

            var completedOrders = orders.Where(o => 
                o.Status == OrderConstants.STATUS_COMPLETED
            ).Count();

            return Ok(new
            {
                isOpen = true,
                cashRegister = new
                {
                    id = openCashRegister.Id,
                    deliveryPersonId = openCashRegister.DeliveryPersonId,
                    deliveryPersonName = openCashRegister.DeliveryPerson?.Name,
                    openedAt = openCashRegister.OpenedAt,
                    activeOrders = activeOrders,
                    completedOrders = completedOrders,
                    totalOrders = orders.Count
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estado de caja de repartidor");
            return StatusCode(500, new { error = "Error al obtener el estado de la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Abre una nueva sesión de caja para el repartidor autenticado
    /// </summary>
    [HttpPost("open")]
    public async Task<ActionResult<DeliveryCashRegister>> OpenCashRegister()
    {
        try
        {
            var deliveryPersonId = GetDeliveryPersonId();
            if (!deliveryPersonId.HasValue)
            {
                return Unauthorized(new { error = "Token inválido" });
            }

            // Verificar que el repartidor existe y está activo
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == deliveryPersonId.Value && d.IsActive);

            if (deliveryPerson == null)
            {
                return BadRequest(new { error = "Repartidor no encontrado o inactivo" });
            }

            // Obtener RestaurantId del repartidor
            var restaurantId = deliveryPerson.RestaurantId;
            if (restaurantId <= 0)
            {
                return BadRequest(new { error = "El repartidor no tiene un restaurante asignado válido" });
            }

            // Verificar que no haya una caja abierta para este repartidor (del mismo restaurante)
            var existingOpenCashRegister = await _context.DeliveryCashRegisters
                .Where(c => c.DeliveryPersonId == deliveryPersonId.Value && c.RestaurantId == restaurantId && c.IsOpen)
                .FirstOrDefaultAsync();

            if (existingOpenCashRegister != null)
            {
                return BadRequest(new { error = "Ya tienes una caja abierta. Debes cerrarla antes de abrir una nueva." });
            }

            var cashRegister = new DeliveryCashRegister
            {
                RestaurantId = restaurantId, // Asignar RestaurantId
                DeliveryPersonId = deliveryPersonId.Value,
                OpenedAt = DateTime.UtcNow,
                IsOpen = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.DeliveryCashRegisters.Add(cashRegister);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Caja de repartidor abierta: ID {CashRegisterId}, Repartidor: {DeliveryPersonId} ({Name})",
                cashRegister.Id, deliveryPersonId.Value, deliveryPerson.Name);

            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al abrir caja de repartidor");
            return StatusCode(500, new { error = "Error al abrir la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Cierra la caja actual del repartidor autenticado
    /// </summary>
    [HttpPost("close")]
    public async Task<ActionResult<DeliveryCashRegister>> CloseCashRegister([FromBody] CloseDeliveryCashRegisterRequest? request)
    {
        try
        {
            var deliveryPersonId = GetDeliveryPersonId();
            if (!deliveryPersonId.HasValue)
            {
                return Unauthorized(new { error = "Token inválido" });
            }

            // Obtener RestaurantId del repartidor
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == deliveryPersonId.Value);
            
            if (deliveryPerson == null)
            {
                return Unauthorized(new { error = "Repartidor no encontrado" });
            }

            var restaurantId = deliveryPerson.RestaurantId;

            // Obtener la caja abierta de este repartidor (del mismo restaurante)
            var cashRegister = await _context.DeliveryCashRegisters
                .Where(c => c.DeliveryPersonId == deliveryPersonId.Value && c.RestaurantId == restaurantId && c.IsOpen)
                .OrderByDescending(c => c.OpenedAt)
                .FirstOrDefaultAsync();

            if (cashRegister == null)
            {
                return BadRequest(new { error = "No tienes una caja abierta para cerrar" });
            }

            // Verificar que no haya pedidos activos asignados a este repartidor (del mismo restaurante)
            var pendingOrders = await _context.Orders
                .Where(o => o.DeliveryPersonId == deliveryPersonId.Value
                    && o.RestaurantId == restaurantId
                    && o.CreatedAt >= cashRegister.OpenedAt
                    && o.Status != OrderConstants.STATUS_COMPLETED
                    && o.Status != OrderConstants.STATUS_CANCELLED
                    && !o.IsArchived)
                .Select(o => new { o.Id, o.Status })
                .ToListAsync();

            if (pendingOrders.Any())
            {
                return BadRequest(new
                {
                    error = "No se puede cerrar la caja porque tienes pedidos activos asignados",
                    pendingOrders = pendingOrders.Count
                });
            }

            // Actualizar caja
            cashRegister.ClosedAt = DateTime.UtcNow;
            cashRegister.IsOpen = false;
            cashRegister.Notes = request?.Notes;
            cashRegister.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Caja de repartidor cerrada: ID {CashRegisterId}, Repartidor: {DeliveryPersonId}",
                cashRegister.Id, deliveryPersonId.Value);

            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cerrar caja de repartidor");
            return StatusCode(500, new { error = "Error al cerrar la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene los pedidos asignados al repartidor autenticado (solo si tiene caja abierta)
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult> GetMyOrders()
    {
        try
        {
            var deliveryPersonId = GetDeliveryPersonId();
            if (!deliveryPersonId.HasValue)
            {
                return Unauthorized(new { error = "Token inválido" });
            }

            // Obtener RestaurantId del repartidor
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == deliveryPersonId.Value);
            
            if (deliveryPerson == null)
            {
                return Unauthorized(new { error = "Repartidor no encontrado" });
            }

            var restaurantId = deliveryPerson.RestaurantId;

            // Verificar que tenga una caja abierta (del mismo restaurante)
            var openCashRegister = await _context.DeliveryCashRegisters
                .Where(c => c.DeliveryPersonId == deliveryPersonId.Value && c.RestaurantId == restaurantId && c.IsOpen)
                .FirstOrDefaultAsync();

            if (openCashRegister == null)
            {
                return BadRequest(new { error = "Debes abrir tu caja primero para ver tus pedidos" });
            }

            // Obtener pedidos asignados a este repartidor (solo los que no están completados o cancelados, del mismo restaurante)
            var orders = await _context.Orders
                .Include(o => o.Items)
                .Include(o => o.Customer)
                .Where(o => o.DeliveryPersonId == deliveryPersonId.Value
                    && o.RestaurantId == restaurantId
                    && o.Status != OrderConstants.STATUS_COMPLETED
                    && o.Status != OrderConstants.STATUS_CANCELLED
                    && !o.IsArchived)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new
                {
                    id = o.Id,
                    customerName = o.CustomerName,
                    customerPhone = o.CustomerPhone,
                    customerAddress = o.CustomerAddress,
                    total = o.Total,
                    paymentMethod = o.PaymentMethod,
                    status = o.Status,
                    createdAt = o.CreatedAt,
                    updatedAt = o.UpdatedAt,
                    estimatedDeliveryMinutes = o.EstimatedDeliveryMinutes,
                    comments = o.Comments,
                    items = o.Items.Select(i => new
                    {
                        productName = i.ProductName,
                        quantity = i.Quantity,
                        unitPrice = i.UnitPrice,
                        subtotal = i.Subtotal
                    }).ToList()
                })
                .ToListAsync();

            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener pedidos del repartidor");
            return StatusCode(500, new { error = "Error al obtener pedidos", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza el estado de un pedido asignado al repartidor autenticado
    /// </summary>
    [HttpPatch("orders/{orderId}/status")]
    public async Task<ActionResult> UpdateOrderStatus(int orderId, [FromBody] UpdateOrderStatusRequest request)
    {
        try
        {
            var deliveryPersonId = GetDeliveryPersonId();
            if (!deliveryPersonId.HasValue)
            {
                return Unauthorized(new { error = "Token inválido" });
            }

            // Obtener RestaurantId del repartidor
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == deliveryPersonId.Value);
            
            if (deliveryPerson == null)
            {
                return Unauthorized(new { error = "Repartidor no encontrado" });
            }

            var restaurantId = deliveryPerson.RestaurantId;

            // Verificar que tenga una caja abierta (del mismo restaurante)
            var openCashRegister = await _context.DeliveryCashRegisters
                .Where(c => c.DeliveryPersonId == deliveryPersonId.Value && c.RestaurantId == restaurantId && c.IsOpen)
                .FirstOrDefaultAsync();

            if (openCashRegister == null)
            {
                return BadRequest(new { error = "Debes abrir tu caja primero para gestionar pedidos" });
            }

            // Verificar que el pedido esté asignado a este repartidor (del mismo restaurante)
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == orderId && o.DeliveryPersonId == deliveryPersonId.Value && o.RestaurantId == restaurantId);

            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado o no está asignado a ti" });
            }

            // Validar transición de estado
            var validTransitions = new Dictionary<string, string[]>
            {
                { OrderConstants.STATUS_PREPARING, new[] { OrderConstants.STATUS_DELIVERING } },
                { OrderConstants.STATUS_DELIVERING, new[] { OrderConstants.STATUS_COMPLETED, OrderConstants.STATUS_CANCELLED } }
            };

            if (validTransitions.ContainsKey(order.Status))
            {
                if (!validTransitions[order.Status].Contains(request.Status))
                {
                    return BadRequest(new { error = $"No se puede cambiar el estado de '{order.Status}' a '{request.Status}'" });
                }
            }

            var oldStatus = order.Status;
            order.Status = request.Status;
            order.UpdatedAt = DateTime.UtcNow;

            // Registrar en historial
            var historyEntry = new OrderStatusHistory
            {
                OrderId = order.Id,
                FromStatus = oldStatus,
                ToStatus = request.Status,
                ChangedBy = $"Repartidor {deliveryPersonId.Value}",
                Note = request.Note,
                ChangedAt = DateTime.UtcNow
            };
            _context.OrderStatusHistory.Add(historyEntry);

            await _context.SaveChangesAsync();

            _logger.LogInformation("Pedido {OrderId} actualizado por repartidor {DeliveryPersonId}: {OldStatus} -> {NewStatus}",
                orderId, deliveryPersonId.Value, oldStatus, request.Status);

            // Notificar via SignalR
            try
            {
                await _orderNotificationService.NotifyOrderStatusChanged(orderId, request.Status);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo enviar notificación SignalR para pedido {OrderId}", orderId);
            }

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar estado del pedido {OrderId}", orderId);
            return StatusCode(500, new { error = "Error al actualizar estado del pedido", details = ex.Message });
        }
    }
}

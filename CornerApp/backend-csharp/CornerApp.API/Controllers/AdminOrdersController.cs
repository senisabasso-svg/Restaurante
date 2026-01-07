using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;
using CornerApp.API.Constants;
using CornerApp.API.Hubs;
using CornerApp.API.Helpers;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de pedidos en administración
/// </summary>
[ApiController]
[Route("admin/api")]
[Tags("Administración - Pedidos")]
[Authorize(Roles = "Admin")]
public class AdminOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminOrdersController> _logger;
    private readonly IDeliveryZoneService _deliveryZoneService;
    private readonly IAdminDashboardService _adminDashboardService;
    private readonly IOrderNotificationService _orderNotificationService;
    private readonly IWebhookService _webhookService;
    private readonly IEmailService _emailService;
    private readonly ICacheService? _cache;
    private readonly IMetricsService? _metricsService;
    
    private const string ORDER_STATS_CACHE_KEY = "admin_orders_stats";
    private static readonly TimeSpan ORDER_STATS_CACHE_DURATION = TimeSpan.FromMinutes(2);
    private const int MAX_PAGE_SIZE = 100;
    private const int DEFAULT_PAGE_SIZE = 20;

    public AdminOrdersController(
        ApplicationDbContext context,
        ILogger<AdminOrdersController> logger,
        IDeliveryZoneService deliveryZoneService,
        IAdminDashboardService adminDashboardService,
        IOrderNotificationService orderNotificationService,
        IWebhookService webhookService,
        IEmailService emailService,
        ICacheService? cache = null,
        IMetricsService? metricsService = null)
    {
        _context = context;
        _logger = logger;
        _deliveryZoneService = deliveryZoneService;
        _adminDashboardService = adminDashboardService;
        _orderNotificationService = orderNotificationService;
        _webhookService = webhookService;
        _emailService = emailService;
        _cache = cache;
        _metricsService = metricsService;
    }

    /// <summary>
    /// Obtiene todos los pedidos para administración
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders(
        [FromQuery] bool showArchived = false,
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortOrder = "desc",
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        // Normalizar paginación con límites
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .AsQueryable();

        if (!showArchived)
        {
            query = query.Where(o => !o.IsArchived);
        }

        // Ordenar
        query = sortBy.ToLower() switch
        {
            "total" => sortOrder == "asc" ? query.OrderBy(o => o.Total) : query.OrderByDescending(o => o.Total),
            "status" => sortOrder == "asc" ? query.OrderBy(o => o.Status) : query.OrderByDescending(o => o.Status),
            "customername" => sortOrder == "asc" ? query.OrderBy(o => o.CustomerName) : query.OrderByDescending(o => o.CustomerName),
            _ => sortOrder == "asc" ? query.OrderBy(o => o.CreatedAt) : query.OrderByDescending(o => o.CreatedAt)
        };

        var totalCount = await query.CountAsync();
        var orders = await query
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync();

        return Ok(new
        {
            data = orders,
            totalCount,
            page = normalizedPage,
            pageSize = normalizedPageSize,
            totalPages = (int)Math.Ceiling(totalCount / (double)normalizedPageSize)
        });
    }

    /// <summary>
    /// Obtiene pedidos activos (no completados ni cancelados) con paginación
    /// </summary>
    [HttpGet("orders/active")]
    public async Task<ActionResult<IEnumerable<Order>>> GetActiveOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        // Normalizar paginación con límites
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => !o.IsArchived && 
                       o.Status != OrderConstants.STATUS_COMPLETED && 
                       o.Status != OrderConstants.STATUS_CANCELLED)
            .OrderByDescending(o => o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(
            query, normalizedPage, normalizedPageSize);

        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene un pedido por ID (incluye pedidos archivados)
    /// </summary>
    [HttpGet("orders/{id}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        var order = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.DeliveryPerson)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado", orderId = id, message = "El pedido puede haber sido eliminado permanentemente" });
        }

        return Ok(order);
    }

    /// <summary>
    /// Obtiene información de fechas de creación de pedidos específicos (útil para debugging)
    /// </summary>
    [HttpGet("orders/dates")]
    public async Task<ActionResult> GetOrdersCreationDates([FromQuery] int[] ids)
    {
        if (ids == null || ids.Length == 0)
        {
            return BadRequest(new { error = "Debe proporcionar al menos un ID de pedido" });
        }

        var orders = await _context.Orders
            .AsNoTracking()
            .Where(o => ids.Contains(o.Id))
            .Select(o => new
            {
                o.Id,
                o.CreatedAt,
                o.UpdatedAt,
                o.Status,
                o.CustomerName
            })
            .ToListAsync();

        if (orders.Count == 0)
        {
            return NotFound(new { error = "No se encontraron pedidos con los IDs proporcionados" });
        }

        return Ok(new
        {
            orders = orders.OrderBy(o => o.Id).Select(o => new
            {
                o.Id,
                createdAt = o.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss UTC"),
                updatedAt = o.UpdatedAt?.ToString("yyyy-MM-dd HH:mm:ss UTC"),
                status = o.Status,
                customerName = o.CustomerName,
                timeSinceCreation = DateTime.UtcNow - o.CreatedAt
            })
        });
    }

    /// <summary>
    /// Obtiene pedidos archivados con paginación
    /// </summary>
    [HttpGet("orders/archived")]
    public async Task<ActionResult<IEnumerable<Order>>> GetArchivedOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.DeliveryPerson)
            .Where(o => o.IsArchived)
            .OrderByDescending(o => o.ArchivedAt ?? o.UpdatedAt ?? o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(
            query, normalizedPage, normalizedPageSize);

        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene productos disponibles para crear pedidos
    /// </summary>
    [HttpGet("products")]
    public async Task<ActionResult<IEnumerable<object>>> GetProducts()
    {
        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.IsAvailable)
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new
            {
                id = p.Id,
                name = p.Name,
                category = p.Category != null ? p.Category.Name : "",
                categoryId = p.CategoryId,
                description = p.Description,
                price = p.Price,
                image = p.Image
            })
            .ToListAsync();

        return Ok(products);
    }

    /// <summary>
    /// Crea un pedido manualmente desde administración
    /// </summary>
    [HttpPost("orders/create")]
    public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { error = "El request no puede ser nulo" });
            }

            if (request.Items == null || !request.Items.Any())
            {
                return BadRequest(new { error = "El pedido debe contener al menos un item" });
            }

            if (string.IsNullOrEmpty(request.CustomerName))
            {
                return BadRequest(new { error = "El nombre del cliente es requerido" });
            }

            var total = request.Items.Sum(item => 
            {
                var price = item.Price >= 0 ? item.Price : 0;
                return price * item.Quantity;
            });

            // Obtener o crear cliente
            int? customerId = null;
            if (!string.IsNullOrWhiteSpace(request.CustomerPhone) || !string.IsNullOrWhiteSpace(request.CustomerEmail))
            {
                Customer? existingCustomer = null;
                
                if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
                {
                    existingCustomer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Phone == request.CustomerPhone);
                }
                
                if (existingCustomer == null && !string.IsNullOrWhiteSpace(request.CustomerEmail))
                {
                    existingCustomer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Email == request.CustomerEmail);
                }
                
                if (existingCustomer != null)
                {
                    customerId = existingCustomer.Id;
                }
                else
                {
                    var newCustomer = new Customer
                    {
                        Name = request.CustomerName,
                        Phone = request.CustomerPhone ?? string.Empty,
                        Email = request.CustomerEmail ?? string.Empty,
                        DefaultAddress = request.CustomerAddress,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    
                    _context.Customers.Add(newCustomer);
                    await _context.SaveChangesAsync();
                    customerId = newCustomer.Id;
                }
            }

            // Obtener coordenadas del cliente
            double? customerLatitude = null;
            double? customerLongitude = null;
            if (!string.IsNullOrWhiteSpace(request.CustomerAddress))
            {
                var zoneValidation = await _deliveryZoneService.ValidateDeliveryZoneAsync(request.CustomerAddress);
                if (zoneValidation.CustomerLatitude.HasValue && zoneValidation.CustomerLongitude.HasValue)
                {
                    customerLatitude = zoneValidation.CustomerLatitude.Value;
                    customerLongitude = zoneValidation.CustomerLongitude.Value;
                }
            }

            // Validar método de pago
            var paymentMethodName = request.PaymentMethod ?? PaymentConstants.METHOD_CASH;
            var paymentMethod = await _context.PaymentMethods
                .FirstOrDefaultAsync(pm => pm.Name != null && 
                    pm.Name.Equals(paymentMethodName, StringComparison.OrdinalIgnoreCase) && pm.IsActive);
            
            if (paymentMethod == null)
            {
                await _adminDashboardService.EnsurePaymentMethodsExistAsync();
                paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Name != null && 
                        pm.Name.Equals(PaymentConstants.METHOD_CASH, StringComparison.OrdinalIgnoreCase) && pm.IsActive);
                
                if (paymentMethod != null)
                {
                    paymentMethodName = paymentMethod.Name;
                }
            }
            else
            {
                paymentMethodName = paymentMethod.Name;
            }

            var estimatedMinutes = _adminDashboardService.CalculateEstimatedDeliveryTime(
                customerLatitude, customerLongitude, null, null);

            var order = new Order
            {
                CustomerId = customerId,
                CustomerName = request.CustomerName,
                CustomerPhone = request.CustomerPhone ?? string.Empty,
                CustomerAddress = request.CustomerAddress ?? string.Empty,
                CustomerEmail = request.CustomerEmail ?? string.Empty,
                CustomerLatitude = customerLatitude,
                CustomerLongitude = customerLongitude,
                Total = total,
                PaymentMethod = paymentMethodName,
                Status = OrderConstants.STATUS_PENDING,
                EstimatedDeliveryMinutes = estimatedMinutes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Comments = request.Comments,
                Items = request.Items.Select(item => new OrderItem
                {
                    ProductId = item.Id,
                    ProductName = item.Name ?? "Producto sin nombre",
                    UnitPrice = item.Price >= 0 ? item.Price : 0,
                    Quantity = item.Quantity > 0 ? item.Quantity : 1
                }).ToList()
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            if (customerId.HasValue)
            {
                var customer = await _context.Customers.FindAsync(customerId.Value);
                if (customer != null)
                {
                    var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
                    var pointsToAdd = businessInfo?.PointsPerOrder ?? AppConstants.DEFAULT_POINTS_PER_ORDER;
                    
                    customer.Points += pointsToAdd;
                    customer.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            _logger.LogInformation("Pedido {OrderId} creado desde administración", order.Id);

            return Ok(new { 
                id = order.Id, 
                message = "Pedido creado exitosamente",
                order = order
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido desde administración");
            return StatusCode(500, new { 
                error = "Error al crear el pedido", 
                details = ex.Message
            });
        }
    }

    /// <summary>
    /// Obtiene estadísticas de pedidos para el dashboard (optimizado con queries agregadas y cache)
    /// </summary>
    [HttpGet("orders/stats")]
    public async Task<ActionResult> GetOrderStats()
    {
        // Intentar obtener desde cache
        if (_cache != null)
        {
            var cachedStats = await _cache.GetAsync<object>(ORDER_STATS_CACHE_KEY);
            if (cachedStats != null)
            {
                _metricsService?.RecordCacheHit(ORDER_STATS_CACHE_KEY);
                _logger.LogInformation("Estadísticas obtenidas desde cache");
                return Ok(cachedStats);
            }
        }

        _metricsService?.RecordCacheMiss(ORDER_STATS_CACHE_KEY);

        var today = DateTime.UtcNow.Date;
        var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
        var startOfMonth = new DateTime(today.Year, today.Month, 1);

        var baseQuery = _context.Orders
            .AsNoTracking()
            .Where(o => !o.IsArchived);

        // Usar queries agregadas en lugar de cargar todos los pedidos en memoria
        // Esto es mucho más eficiente para grandes volúmenes de datos
        var totalOrders = await baseQuery.CountAsync();
        
        var pendingOrders = await baseQuery.CountAsync(o => o.Status == OrderConstants.STATUS_PENDING);
        var preparingOrders = await baseQuery.CountAsync(o => o.Status == OrderConstants.STATUS_PREPARING);
        var deliveringOrders = await baseQuery.CountAsync(o => o.Status == OrderConstants.STATUS_DELIVERING);
        var completedOrders = await baseQuery.CountAsync(o => o.Status == OrderConstants.STATUS_COMPLETED);
        var cancelledOrders = await baseQuery.CountAsync(o => o.Status == OrderConstants.STATUS_CANCELLED);
        
        var todayOrders = await baseQuery.CountAsync(o => o.CreatedAt.Date == today);
        var todayRevenue = await baseQuery
            .Where(o => o.CreatedAt.Date == today && o.Status == OrderConstants.STATUS_COMPLETED)
            .SumAsync(o => o.Total);
        
        var weekOrders = await baseQuery.CountAsync(o => o.CreatedAt >= startOfWeek);
        var weekRevenue = await baseQuery
            .Where(o => o.CreatedAt >= startOfWeek && o.Status == OrderConstants.STATUS_COMPLETED)
            .SumAsync(o => o.Total);
        
        var monthOrders = await baseQuery.CountAsync(o => o.CreatedAt >= startOfMonth);
        var monthRevenue = await baseQuery
            .Where(o => o.CreatedAt >= startOfMonth && o.Status == OrderConstants.STATUS_COMPLETED)
            .SumAsync(o => o.Total);

        var pendingReceiptsCount = await baseQuery.CountAsync(o => 
            o.PaymentMethod != null && 
            (o.PaymentMethod.ToLower().Contains("transfer") || o.PaymentMethod.ToLower().Contains("transferencia")) && 
            !string.IsNullOrEmpty(o.TransferReceiptImage) && 
            !o.IsReceiptVerified);

        var stats = new
        {
            totalOrders,
            pendingOrders,
            preparingOrders,
            deliveringOrders,
            completedOrders,
            cancelledOrders,
            todayOrders,
            todayRevenue,
            weekOrders,
            weekRevenue,
            monthOrders,
            monthRevenue,
            pendingReceiptsCount
        };

        // Guardar en cache
        if (_cache != null)
        {
            await _cache.SetAsync(ORDER_STATS_CACHE_KEY, stats, ORDER_STATS_CACHE_DURATION);
        }

        return Ok(stats);
    }

    /// <summary>
    /// Actualiza el estado de un pedido
    /// </summary>
    [HttpPut("orders/{id}/status")]
    public async Task<ActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.DeliveryPerson)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);

            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            var oldStatus = order.Status;
            order.Status = request.Status;
            order.UpdatedAt = DateTime.UtcNow;

            // Registrar en historial de estados
            var historyEntry = new OrderStatusHistory
            {
                OrderId = order.Id,
                FromStatus = oldStatus,
                ToStatus = request.Status,
                ChangedBy = "admin", // TODO: Obtener del contexto de autenticación
                Note = request.Note,
                ChangedAt = DateTime.UtcNow
            };
            _context.OrderStatusHistory.Add(historyEntry);

            // Asignar repartidor si se proporciona
            if (request.DeliveryPersonId.HasValue)
            {
                var deliveryPerson = await _context.DeliveryPersons.FindAsync(request.DeliveryPersonId.Value);
                if (deliveryPerson != null && deliveryPerson.IsActive)
                {
                    order.DeliveryPersonId = request.DeliveryPersonId.Value;
                    order.DeliveryPerson = deliveryPerson;
                }
            }

            // Si cambia a "en camino", verificar que tenga repartidor
            if (request.Status == OrderConstants.STATUS_DELIVERING && !order.DeliveryPersonId.HasValue)
            {
                return BadRequest(new { error = "Debe asignar un repartidor antes de poner en camino" });
            }

            await _context.SaveChangesAsync();

            // Invalidar cache de estadísticas ya que cambió un pedido
            if (_cache != null)
            {
                await _cache.RemoveAsync(ORDER_STATS_CACHE_KEY);
            }

            // Notificar via SignalR
            await _orderNotificationService.NotifyOrderStatusChanged(
                order.Id, 
                order.Status, 
                order.DeliveryPerson?.Name);

            // Disparar webhook si el pedido se completó
            if (request.Status == OrderConstants.STATUS_COMPLETED)
            {
                // Encolar trigger de webhook
                _ = Task.Run(() => _webhookService.TriggerWebhookAsync("order.completed", order));
                
                // Enviar recibo por email al cliente
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var orderWithItems = await _context.Orders
                            .Include(o => o.Items)
                            .Include(o => o.DeliveryPerson)
                            .AsNoTracking()
                            .FirstOrDefaultAsync(o => o.Id == order.Id);
                        
                        if (orderWithItems != null)
                        {
                            await _emailService.SendOrderReceiptAsync(orderWithItems);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error al enviar recibo por email para el pedido {OrderId}", order.Id);
                    }
                });
            }

            _logger.LogInformation("Pedido {OrderId} cambió de {OldStatus} a {NewStatus}", id, oldStatus, request.Status);

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar estado del pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al actualizar el estado del pedido" });
        }
    }

    /// <summary>
    /// Archiva un pedido
    /// </summary>
    [HttpPost("orders/{id}/archive")]
    public async Task<ActionResult> ArchiveOrder(int id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        order.IsArchived = true;
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Pedido {OrderId} archivado", id);

        return Ok(new { message = "Pedido archivado" });
    }

    /// <summary>
    /// Restaura un pedido archivado
    /// </summary>
    [HttpPost("orders/{id}/restore")]
    public async Task<ActionResult> RestoreOrder(int id)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        order.IsArchived = false;
        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Pedido {OrderId} restaurado", id);

        return Ok(new { message = "Pedido restaurado" });
    }

    /// <summary>
    /// Verifica o desverifica el comprobante de transferencia de un pedido
    /// </summary>
    [HttpPut("orders/{id}/receipt/verify")]
    public async Task<ActionResult> VerifyReceipt(int id, [FromBody] VerifyReceiptRequest request)
    {
        try
        {
            var order = await _context.Orders.FindAsync(id);
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            if (string.IsNullOrWhiteSpace(order.TransferReceiptImage))
            {
                return BadRequest(new { error = "Este pedido no tiene comprobante de transferencia" });
            }

            order.IsReceiptVerified = request.IsVerified;
            order.ReceiptVerifiedAt = request.IsVerified ? DateTime.UtcNow : null;
            order.ReceiptVerifiedBy = request.IsVerified ? "admin" : null; // TODO: Obtener del contexto de autenticación
            order.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Comprobante del pedido {OrderId} {Status} por {User}",
                id,
                request.IsVerified ? "verificado" : "desverificado",
                order.ReceiptVerifiedBy ?? "admin"
            );

            return Ok(new
            {
                message = request.IsVerified ? "Comprobante verificado" : "Verificación del comprobante removida",
                order
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al verificar comprobante del pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al verificar el comprobante" });
        }
    }

    /// <summary>
    /// Elimina un pedido permanentemente (solo si está archivado)
    /// </summary>
    [HttpDelete("orders/{id}")]
    public async Task<ActionResult> DeleteOrder(int id)
    {
        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        // Solo permitir eliminación permanente si está archivado
        if (!order.IsArchived)
        {
            return BadRequest(new { error = "No se puede eliminar permanentemente un pedido activo. Debe archivarlo primero usando POST /api/admin/orders/{id}/archive" });
        }

        // Eliminar el pedido (los items se eliminarán automáticamente por cascada)
        _context.Orders.Remove(order);
        await _context.SaveChangesAsync();

        _logger.LogWarning("Pedido {OrderId} eliminado permanentemente", id);

        return Ok(new { message = "Pedido eliminado permanentemente", orderId = id });
    }

    /// <summary>
    /// Obtiene el historial de estados de un pedido
    /// </summary>
    [HttpGet("orders/{id}/history")]
    public async Task<ActionResult> GetOrderStatusHistory(int id)
    {
        var order = await _context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        var history = await _context.OrderStatusHistory
            .AsNoTracking()
            .Where(h => h.OrderId == id)
            .OrderByDescending(h => h.ChangedAt)
            .Select(h => new
            {
                h.Id,
                h.FromStatus,
                h.ToStatus,
                h.ChangedBy,
                h.Note,
                h.ChangedAt
            })
            .ToListAsync();

        return Ok(history);
    }
}

public class UpdateOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
    public int? DeliveryPersonId { get; set; }
    public string? Note { get; set; }
}

public class VerifyReceiptRequest
{
    public bool IsVerified { get; set; }
}

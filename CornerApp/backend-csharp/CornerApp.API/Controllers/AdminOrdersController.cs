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
[Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden ver y gestionar pedidos
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
    [HttpGet("orders/products")]
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

            // Validar que todos los productos existan en la base de datos
            var productIds = request.Items.Select(item => item.Id).Distinct().ToList();
            var existingProducts = await _context.Products
                .Where(p => productIds.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts).ToList();
            if (missingProductIds.Any())
            {
                _logger.LogWarning("Intento de crear pedido con productos inexistentes: {ProductIds}", string.Join(", ", missingProductIds));
                return BadRequest(new { 
                    error = $"Los siguientes productos no existen: {string.Join(", ", missingProductIds)}" 
                });
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
                    // Generar un email único si está vacío para evitar violación de índice único
                    var customerEmail = request.CustomerEmail;
                    if (string.IsNullOrWhiteSpace(customerEmail))
                    {
                        // Generar un email único temporal basado en teléfono o GUID
                        var uniqueId = !string.IsNullOrWhiteSpace(request.CustomerPhone) 
                            ? $"temp_{request.CustomerPhone.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "")}@temp.local"
                            : $"temp_{Guid.NewGuid()}@temp.local";
                        customerEmail = uniqueId;
                    }
                    
                    var newCustomer = new Customer
                    {
                        Name = request.CustomerName,
                        Phone = request.CustomerPhone ?? string.Empty,
                        Email = customerEmail,
                        DefaultAddress = request.CustomerAddress,
                        PasswordHash = string.Empty, // Cliente creado automáticamente sin contraseña
                        Points = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };
                    
                    _context.Customers.Add(newCustomer);
                    try
                    {
                        await _context.SaveChangesAsync();
                        customerId = newCustomer.Id;
                    }
                    catch (DbUpdateException dbEx)
                    {
                        var innerException = dbEx.InnerException;
                        var errorDetails = dbEx.Message;
                        
                        if (innerException != null)
                        {
                            errorDetails = $"{dbEx.Message} | Inner Exception: {innerException.Message}";
                            if (innerException.InnerException != null)
                            {
                                errorDetails += $" | Inner Inner Exception: {innerException.InnerException.Message}";
                            }
                        }
                        
                        _logger.LogError(dbEx, "Error de base de datos al crear cliente: {ErrorDetails}. Datos: Name={Name}, Phone={Phone}, Email={Email}", 
                            errorDetails, newCustomer.Name, newCustomer.Phone, newCustomer.Email);
                        
                        // Verificar si es un error de restricción única (duplicado)
                        if (innerException != null && (
                            innerException.Message.Contains("UNIQUE") ||
                            innerException.Message.Contains("duplicate key") ||
                            innerException.Message.Contains("Cannot insert duplicate")))
                        {
                            _logger.LogWarning("Cliente duplicado detectado, buscando cliente existente...");
                            
                            // Intentar buscar el cliente que ya existe
                            Customer? duplicateCustomer = null;
                            if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
                            {
                                duplicateCustomer = await _context.Customers
                                    .FirstOrDefaultAsync(c => c.Phone == request.CustomerPhone);
                            }
                            
                            if (duplicateCustomer == null && !string.IsNullOrWhiteSpace(customerEmail))
                            {
                                duplicateCustomer = await _context.Customers
                                    .FirstOrDefaultAsync(c => c.Email == customerEmail);
                            }
                            
                            if (duplicateCustomer != null)
                            {
                                customerId = duplicateCustomer.Id;
                                _logger.LogInformation("Cliente existente encontrado después de error de duplicado: {CustomerId}", customerId);
                                // Continuar con el flujo normal usando el cliente existente
                            }
                            else
                            {
                                return BadRequest(new { 
                                    error = "Ya existe un cliente con este teléfono o email",
                                    details = innerException.Message
                                });
                            }
                        }
                        else
                        {
                            // Re-lanzar para que se capture en el catch general
                            throw new Exception($"Error al crear cliente: {errorDetails}", dbEx);
                        }
                    }
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
            var paymentMethodNameLower = paymentMethodName.ToLower();
            var paymentMethod = await _context.PaymentMethods
                .FirstOrDefaultAsync(pm => pm.Name != null && 
                    pm.Name.ToLower() == paymentMethodNameLower && pm.IsActive);
            
            if (paymentMethod == null)
            {
                await _adminDashboardService.EnsurePaymentMethodsExistAsync();
                var cashMethodLower = PaymentConstants.METHOD_CASH.ToLower();
                paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Name != null && 
                        pm.Name.ToLower() == cashMethodLower && pm.IsActive);
                
                if (paymentMethod != null)
                {
                    paymentMethodName = paymentMethod.Name;
                }
                else
                {
                    // Si aún no existe, usar el valor por defecto
                    paymentMethodName = PaymentConstants.METHOD_CASH;
                }
            }
            else
            {
                paymentMethodName = paymentMethod.Name ?? PaymentConstants.METHOD_CASH;
            }
            
            // Asegurar que paymentMethodName nunca sea null o vacío
            if (string.IsNullOrWhiteSpace(paymentMethodName))
            {
                paymentMethodName = PaymentConstants.METHOD_CASH;
            }

            var estimatedMinutes = _adminDashboardService.CalculateEstimatedDeliveryTime(
                customerLatitude, customerLongitude, null, null);

            // Crear los items primero
            var orderItems = request.Items.Select(item => new OrderItem
            {
                ProductId = item.Id,
                ProductName = (item.Name ?? "Producto sin nombre").Length > 200 
                    ? (item.Name ?? "Producto sin nombre").Substring(0, 200) 
                    : (item.Name ?? "Producto sin nombre"),
                UnitPrice = item.Price >= 0 ? item.Price : 0,
                Quantity = item.Quantity > 0 ? item.Quantity : 1
            }).ToList();

            var order = new Order
            {
                CustomerId = customerId,
                CustomerName = request.CustomerName ?? string.Empty,
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
                TableId = request.TableId, // Asignar TableId si viene en el request
                Items = orderItems
            };

            _context.Orders.Add(order);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                var innerException = ex.InnerException;
                var innerExceptionMessage = innerException?.Message ?? ex.Message;
                var innerExceptionType = innerException?.GetType().Name ?? ex.GetType().Name;
                var innerExceptionStackTrace = innerException?.StackTrace ?? ex.StackTrace;
                
                // Log detallado
                _logger.LogError(ex, "Error al guardar el pedido. Inner exception type: {InnerExceptionType}, Message: {InnerExceptionMessage}", 
                    innerExceptionType, innerExceptionMessage);
                _logger.LogError("Stack trace: {StackTrace}", innerExceptionStackTrace);
                _logger.LogError("Datos del pedido: CustomerName={CustomerName}, Total={Total}, PaymentMethod={PaymentMethod}, ItemsCount={ItemsCount}", 
                    order.CustomerName, order.Total, order.PaymentMethod, order.Items?.Count ?? 0);
                
                if (order.Items != null && order.Items.Any())
                {
                    foreach (var item in order.Items)
                    {
                        _logger.LogError("Item: ProductId={ProductId}, ProductName={ProductName} (Length={Length}), UnitPrice={UnitPrice}, Quantity={Quantity}", 
                            item.ProductId, item.ProductName, item.ProductName?.Length ?? 0, item.UnitPrice, item.Quantity);
                    }
                }
                
                // Verificar si es un error de restricción de clave foránea
                if (innerException != null && (
                    innerException.Message.Contains("FOREIGN KEY") ||
                    innerException.Message.Contains("The INSERT statement conflicted") ||
                    innerException.Message.Contains("Cannot insert") ||
                    innerException.Message.Contains("violates foreign key constraint")))
                {
                    return BadRequest(new { 
                        error = "Error al crear el pedido: Uno o más productos no son válidos",
                        details = innerExceptionMessage
                    });
                }
                
                // Retornar el error con el inner exception en los detalles
                return StatusCode(500, new { 
                    error = "Error al crear el pedido", 
                    details = $"{innerExceptionType}: {innerExceptionMessage}",
                    fullException = ex.ToString()
                });
            }
            catch (Exception ex)
            {
                // Capturar inner exception para obtener más detalles
                var errorMessage = ex.Message;
                var innerException = ex.InnerException;
                
                if (innerException != null)
                {
                    errorMessage = $"{ex.Message} | Inner Exception: {innerException.Message}";
                    if (innerException.InnerException != null)
                    {
                        errorMessage += $" | Inner Inner Exception: {innerException.InnerException.Message}";
                    }
                }
                
                _logger.LogError(ex, "Error inesperado al crear el pedido: {ExceptionType} - {Message}\n{StackTrace}\n{InnerException}", 
                    ex.GetType().Name,
                    ex.Message,
                    ex.StackTrace,
                    innerException?.ToString() ?? "No inner exception");
                
                return StatusCode(500, new { 
                    error = "Error al crear el pedido", 
                    details = errorMessage,
                    exceptionType = ex.GetType().Name,
                    fullException = ex.ToString()
                });
            }

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

            // Si el pedido es de una mesa, actualizar el estado de la mesa
            if (request.TableId.HasValue)
            {
                var table = await _context.Tables.FindAsync(request.TableId.Value);
                if (table != null)
                {
                    table.Status = "OrderPlaced";
                    table.OrderPlacedAt = DateTime.UtcNow;
                    table.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Estado de mesa {TableId} actualizado a OrderPlaced", table.Id);
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

            // Si cambia a "en camino", verificar que tenga repartidor (solo si NO es un pedido de mesa)
            if (request.Status == OrderConstants.STATUS_DELIVERING && !order.DeliveryPersonId.HasValue && !order.TableId.HasValue)
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
                // Si el pedido está asociado a una mesa, actualizar el estado de la mesa a Available
                if (order.TableId.HasValue)
                {
                    var table = await _context.Tables.FindAsync(order.TableId.Value);
                    if (table != null)
                    {
                        table.Status = "Available";
                        table.OrderPlacedAt = null;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("Estado de mesa {TableId} actualizado a Available después de completar pedido {OrderId}", table.Id, order.Id);
                    }
                }

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
    /// Actualiza el método de pago de un pedido
    /// </summary>
    [HttpPatch("orders/{id}/payment-method")]
    public async Task<ActionResult> UpdateOrderPaymentMethod(int id, [FromBody] UpdateOrderPaymentMethodRequest request)
    {
        try
        {
            var order = await _context.Orders.FindAsync(id);
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            if (string.IsNullOrWhiteSpace(request.PaymentMethod))
            {
                return BadRequest(new { error = "El método de pago es requerido" });
            }

            // Validar que el método de pago existe y está activo
            var paymentMethod = await _context.PaymentMethods
                .FirstOrDefaultAsync(pm => pm.Name != null && 
                    pm.Name.ToLower() == request.PaymentMethod.ToLower() && pm.IsActive);

            if (paymentMethod == null)
            {
                return BadRequest(new { error = "Método de pago no encontrado o inactivo" });
            }

            order.PaymentMethod = paymentMethod.Name;
            order.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Método de pago del pedido {OrderId} actualizado a: {PaymentMethod}", id, paymentMethod.Name);

            return Ok(order);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar método de pago del pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al actualizar el método de pago" });
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

public class UpdateOrderPaymentMethodRequest
{
    public string PaymentMethod { get; set; } = string.Empty;
}

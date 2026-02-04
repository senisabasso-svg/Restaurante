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
using System.Net.Http;
using System.Text;
using System.Text.Json;

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
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ICacheService? _cache;
    private readonly IMetricsService? _metricsService;
    
    private const string ORDER_STATS_CACHE_KEY = "admin_orders_stats";
    private static readonly TimeSpan ORDER_STATS_CACHE_DURATION = TimeSpan.FromMinutes(2);
    private const int MAX_PAGE_SIZE = 100;
    private const int DEFAULT_PAGE_SIZE = 20;
    
    // URLs del POS (constantes)
    private const string POS_API_URL = "https://poslink.hm.opos.com.uy/itdServer/processFinancialPurchase";
    private const string POS_VOID_API_URL = "https://poslink.hm.opos.com.uy/itdServer/processFinancialPurchaseRefund";
    private const string POS_QUERY_API_URL = "https://poslink.hm.opos.com.uy/itdServer/processFinancialPurchaseQuery";
    private const string POS_REVERSE_API_URL = "https://poslink.hm.opos.com.uy/itdServer/processFinancialReverse";
    
    // Valores por defecto para POS (si el restaurante no tiene configuración)
    private const string DEFAULT_POS_ID = "22224628";
    private const string DEFAULT_SYSTEM_ID = "cb67e3e5-3ab9-3a6b-960b-2b874b68ab3c";
    private const string DEFAULT_BRANCH = "1";
    private const string DEFAULT_CLIENT_APP_ID = "1";

    public AdminOrdersController(
        ApplicationDbContext context,
        ILogger<AdminOrdersController> logger,
        IDeliveryZoneService deliveryZoneService,
        IAdminDashboardService adminDashboardService,
        IOrderNotificationService orderNotificationService,
        IWebhookService webhookService,
        IEmailService emailService,
        IHttpClientFactory httpClientFactory,
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
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _metricsService = metricsService;
    }

    /// <summary>
    /// Obtiene todos los pedidos para administración (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("orders")]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders(
        [FromQuery] bool showArchived = false,
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortOrder = "desc",
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        // Normalizar paginación con límites
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.RestaurantId == restaurantId)
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
    /// Obtiene pedidos activos (no completados ni cancelados) con paginación (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("orders/active")]
    public async Task<ActionResult<IEnumerable<Order>>> GetActiveOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        // Normalizar paginación con límites
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.Table) // Incluir información de la mesa para mostrar número de mesa
            .Where(o => o.RestaurantId == restaurantId &&
                       !o.IsArchived && 
                       o.Status != OrderConstants.STATUS_COMPLETED && 
                       o.Status != OrderConstants.STATUS_CANCELLED)
            .OrderByDescending(o => o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(
            query, normalizedPage, normalizedPageSize);

        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene un pedido por ID (solo del restaurante del usuario, incluye pedidos archivados)
    /// </summary>
    [HttpGet("orders/{id}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var order = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.DeliveryPerson)
            .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado", orderId = id, message = "El pedido puede haber sido eliminado permanentemente o no pertenece a tu restaurante" });
        }

        return Ok(order);
    }

    /// <summary>
    /// Obtiene información de fechas de creación de pedidos específicos (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("orders/dates")]
    public async Task<ActionResult> GetOrdersCreationDates([FromQuery] int[] ids)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        if (ids == null || ids.Length == 0)
        {
            return BadRequest(new { error = "Debe proporcionar al menos un ID de pedido" });
        }

        var orders = await _context.Orders
            .AsNoTracking()
            .Where(o => ids.Contains(o.Id) && o.RestaurantId == restaurantId)
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
    /// Obtiene pedidos archivados con paginación (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("orders/archived")]
    public async Task<ActionResult<IEnumerable<Order>>> GetArchivedOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(
            page, pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

        var query = _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.DeliveryPerson)
            .Where(o => o.RestaurantId == restaurantId && o.IsArchived)
            .OrderByDescending(o => o.ArchivedAt ?? o.UpdatedAt ?? o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(
            query, normalizedPage, normalizedPageSize);

        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene productos disponibles para crear pedidos (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("orders/products")]
    public async Task<ActionResult<IEnumerable<object>>> GetProducts()
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.RestaurantId == restaurantId && p.IsAvailable)
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
    /// Crea un pedido manualmente desde administración (asignado automáticamente al restaurante del usuario)
    /// </summary>
    [HttpPost("orders/create")]
    public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
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

            // Validar que todos los productos existan en la base de datos y pertenezcan al restaurante
            var productIds = request.Items.Select(item => item.Id).Distinct().ToList();
            var existingProducts = await _context.Products
                .Include(p => p.Category)
                .Where(p => productIds.Contains(p.Id) && p.RestaurantId == restaurantId)
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts.Select(p => p.Id)).ToList();
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
                        .FirstOrDefaultAsync(c => c.Phone == request.CustomerPhone && c.RestaurantId == restaurantId);
                }
                
                if (existingCustomer == null && !string.IsNullOrWhiteSpace(request.CustomerEmail))
                {
                    existingCustomer = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Email == request.CustomerEmail && c.RestaurantId == restaurantId);
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
                        RestaurantId = restaurantId,
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
            var orderItems = request.Items.Select(item => 
            {
                // Buscar el producto para obtener su categoría
                var product = existingProducts.FirstOrDefault(p => p.Id == item.Id);
                
                return new OrderItem
                {
                    ProductId = item.Id,
                    ProductName = (item.Name ?? "Producto sin nombre").Length > 200 
                        ? (item.Name ?? "Producto sin nombre").Substring(0, 200) 
                        : (item.Name ?? "Producto sin nombre"),
                    CategoryId = product?.CategoryId,
                    CategoryName = product?.Category?.Name,
                    UnitPrice = item.Price >= 0 ? item.Price : 0,
                    Quantity = item.Quantity > 0 ? item.Quantity : 1
                };
            }).ToList();

            var order = new Order
            {
                RestaurantId = restaurantId,
                CustomerId = customerId,
                CustomerName = request.CustomerName ?? string.Empty,
                CustomerPhone = request.CustomerPhone ?? string.Empty,
                CustomerAddress = request.CustomerAddress ?? string.Empty,
                CustomerEmail = request.CustomerEmail ?? string.Empty,
                CustomerLatitude = customerLatitude,
                CustomerLongitude = customerLongitude,
                Total = total,
                PaymentMethod = paymentMethodName,
                Status = OrderConstants.STATUS_PREPARING, // Ir directamente a cocina
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
                var customer = await _context.Customers
                    .FirstOrDefaultAsync(c => c.Id == customerId.Value && c.RestaurantId == restaurantId);
                if (customer != null)
                {
                    var businessInfo = await _context.BusinessInfo
                        .AsNoTracking()
                        .FirstOrDefaultAsync();
                    var pointsToAdd = businessInfo?.PointsPerOrder ?? AppConstants.DEFAULT_POINTS_PER_ORDER;
                    
                    customer.Points += pointsToAdd;
                    customer.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }

            // Si el pedido es de una mesa, actualizar el estado de la mesa (filtrar por RestaurantId)
            if (request.TableId.HasValue)
            {
                var table = await _context.Tables
                    .FirstOrDefaultAsync(t => t.Id == request.TableId.Value && t.RestaurantId == restaurantId);
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
    /// Actualiza el estado de un pedido (solo del restaurante del usuario)
    /// </summary>
    [HttpPut("orders/{id}/status")]
    public async Task<ActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var order = await _context.Orders
                .Include(o => o.DeliveryPerson)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);

            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado o no pertenece a tu restaurante" });
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

            // Asignar repartidor si se proporciona (solo del mismo restaurante)
            if (request.DeliveryPersonId.HasValue)
            {
                var deliveryPerson = await _context.DeliveryPersons
                    .FirstOrDefaultAsync(d => d.Id == request.DeliveryPersonId.Value && d.RestaurantId == restaurantId);
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

            // Si se completa un pedido de delivery con repartidor asignado, actualizar la caja del repartidor
            if (request.Status == OrderConstants.STATUS_COMPLETED && order.DeliveryPersonId.HasValue && !order.TableId.HasValue)
            {
                // Buscar la caja abierta del repartidor (del mismo restaurante)
                var openCashRegister = await _context.DeliveryCashRegisters
                    .Where(c => c.DeliveryPersonId == order.DeliveryPersonId.Value 
                             && c.RestaurantId == restaurantId 
                             && c.IsOpen)
                    .FirstOrDefaultAsync();

                if (openCashRegister != null)
                {
                    // Obtener todos los pedidos completados de esta sesión de caja
                    var completedOrders = await _context.Orders
                        .Where(o => o.DeliveryPersonId == order.DeliveryPersonId.Value
                                 && o.RestaurantId == restaurantId
                                 && o.CreatedAt >= openCashRegister.OpenedAt
                                 && o.Status == OrderConstants.STATUS_COMPLETED
                                 && !o.IsArchived)
                        .ToListAsync();

                    // Calcular totales actualizados
                    var totalSales = completedOrders.Sum(o => o.Total);
                    var totalCash = completedOrders
                        .Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
                        .Sum(o => o.Total);
                    var totalPOS = completedOrders
                        .Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_POS.ToLower())
                        .Sum(o => o.Total);
                    var totalTransfer = completedOrders
                        .Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
                        .Sum(o => o.Total);

                    // Actualizar la caja del repartidor
                    openCashRegister.TotalSales = totalSales;
                    openCashRegister.TotalCash = totalCash;
                    openCashRegister.TotalPOS = totalPOS;
                    openCashRegister.TotalTransfer = totalTransfer;
                    openCashRegister.UpdatedAt = DateTime.UtcNow;

                    _logger.LogInformation("Caja de repartidor {DeliveryPersonId} actualizada: Total ventas: {TotalSales}", 
                        order.DeliveryPersonId.Value, totalSales);
                }
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
                // Si el pedido está asociado a una mesa, verificar si hay otros pedidos activos
                if (order.TableId.HasValue)
                {
                    var table = await _context.Tables
                        .FirstOrDefaultAsync(t => t.Id == order.TableId.Value && t.RestaurantId == restaurantId);
                    if (table != null)
                    {
                        // Verificar si hay otros pedidos activos en esta mesa (optimizado con AsNoTracking)
                        var hasOtherActiveOrders = await _context.Orders
                            .AsNoTracking()
                            .AnyAsync(o => o.TableId == table.Id
                                && o.RestaurantId == restaurantId 
                                && o.Id != order.Id
                                && !o.IsArchived 
                                && o.Status != OrderConstants.STATUS_COMPLETED 
                                && o.Status != OrderConstants.STATUS_DELIVERED
                                && o.Status != OrderConstants.STATUS_CANCELLED);

                        // Solo actualizar a Available si no hay otros pedidos activos
                        if (!hasOtherActiveOrders)
                        {
                            table.Status = "Available";
                            table.OrderPlacedAt = null;
                            _logger.LogInformation("Estado de mesa {TableId} actualizado a Available después de completar pedido {OrderId} (sin otros pedidos activos)", table.Id, order.Id);
                        }
                        else
                        {
                            _logger.LogInformation("Mesa {TableId} mantiene estado {Status} porque tiene otros pedidos activos", table.Id, table.Status);
                        }
                        
                        table.UpdatedAt = DateTime.UtcNow;
                        await _context.SaveChangesAsync();
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
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado o no pertenece a tu restaurante" });
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

            // Si es pago POS, guardar información de la transacción
            if (paymentMethod.Name.ToLower() == PaymentConstants.METHOD_POS.ToLower() && 
                (request.POSTransactionId.HasValue || !string.IsNullOrWhiteSpace(request.POSTransactionIdString)))
            {
                order.POSTransactionId = request.POSTransactionId;
                order.POSTransactionIdString = request.POSTransactionIdString;
                order.POSTransactionDateTime = request.POSTransactionDateTime;
                order.POSResponse = request.POSResponse;
                _logger.LogInformation("Información POS guardada para pedido {OrderId}: TransactionId={TransactionId}", 
                    id, request.POSTransactionId ?? (long.TryParse(request.POSTransactionIdString, out var parsed) ? parsed : 0));
            }

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
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado o no pertenece a tu restaurante" });
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
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado o no pertenece a tu restaurante" });
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
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            var order = await _context.Orders
                .FirstOrDefaultAsync(o => o.Id == id && o.RestaurantId == restaurantId);
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado o no pertenece a tu restaurante" });
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

    /// <summary>
    /// Obtiene la configuración POS del restaurante actual
    /// </summary>
    private async Task<(string PosId, string SystemId, string Branch, string ClientAppId)> GetPOSConfigAsync()
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        var restaurant = await _context.Restaurants
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == restaurantId);
        
        return (
            PosId: restaurant?.PosId ?? DEFAULT_POS_ID,
            SystemId: restaurant?.SystemId ?? DEFAULT_SYSTEM_ID,
            Branch: restaurant?.Branch ?? DEFAULT_BRANCH,
            ClientAppId: restaurant?.ClientAppId ?? DEFAULT_CLIENT_APP_ID
        );
    }

    /// <summary>
    /// Envía una transacción al POS externo
    /// </summary>
    [HttpPost("pos/transaction")]
    public async Task<ActionResult> SendPOSTransaction([FromBody] POSTransactionRequest request)
    {
        try
        {
            if (request.Amount <= 0)
            {
                return BadRequest(new { error = "El monto debe ser mayor a 0" });
            }

            // Obtener configuración POS del restaurante
            var posConfig = await GetPOSConfigAsync();

            // Formatear fecha como yyyyMMddHHmmssSSS
            var now = DateTime.UtcNow;
            var transactionDateTime = now.ToString("yyyyMMddHHmmssfff");

            // Convertir el monto: si es 2000, debe ser "200000" (multiplicar por 100)
            var amountFormatted = ((long)Math.Round(request.Amount * 100)).ToString();

            // Crear el JSON exactamente como lo hace el código Java
            // Construir el JSON manualmente para mantener los nombres exactos
            var jsonContent = $@"{{
  ""PosID"": ""{posConfig.PosId}"",
  ""SystemId"": ""{posConfig.SystemId}"",
  ""Branch"": ""{posConfig.Branch}"",
  ""ClientAppId"": ""{posConfig.ClientAppId}"",
  ""UserId"": ""1"",
  ""TransactionDateTimeyyyyMMddHHmmssSSS"": ""{transactionDateTime}"",
  ""Amount"": ""{amountFormatted}"",
  ""Quotas"": ""5"",
  ""Plan"": ""0"",
  ""Currency"": ""858"",
  ""TaxRefund"": ""1"",
  ""TaxableAmount"": ""1194400"",
  ""InvoiceAmount"": ""1420000""
}}";

            // Log del JSON que se envía al POSLink (ITD)
            _logger.LogInformation("📤 [POS] Enviando transacción al POSLink (ITD). URL: {Url}", POS_API_URL);
            _logger.LogInformation("📤 [POS] JSON de transacción enviado:\n{Json}", jsonContent);
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine("📤 [POS] ENVIANDO TRANSACCIÓN AL POSLINK (ITD)");
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine($"URL: {POS_API_URL}");
            Console.WriteLine($"JSON Enviado:\n{jsonContent}");
            Console.WriteLine("═══════════════════════════════════════════════════════════");

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json")
            {
                CharSet = "UTF-8"
            };

            var response = await httpClient.PostAsync(POS_API_URL, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            // Log de la respuesta recibida del POSLink
            _logger.LogInformation("📥 [POS] Respuesta recibida del POSLink. Status: {Status}", response.StatusCode);
            _logger.LogInformation("📥 [POS] Respuesta JSON:\n{Response}", responseContent);
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine("📥 [POS] RESPUESTA RECIBIDA DEL POSLINK (ITD)");
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine($"Status Code: {response.StatusCode}");
            Console.WriteLine($"Respuesta JSON:\n{responseContent}");
            Console.WriteLine("═══════════════════════════════════════════════════════════");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Error al enviar transacción POS. Status: {Status}, Response: {Response}", 
                    response.StatusCode, responseContent);
                return StatusCode((int)response.StatusCode, new { 
                    error = "Error al comunicarse con el POS", 
                    details = responseContent 
                });
            }

            // Parsear la respuesta para extraer el TransactionId
            // La respuesta del POS viene como: {"ResponseCode":0,"TransactionId":2603079266119181,"STransactionId":"2603079266119181"}
            long? transactionId = null;
            string? sTransactionId = null;
            try
            {
                // Parsear la respuesta directa del POS
                var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Buscar TransactionId directamente en la respuesta del POS
                if (responseJson.TryGetProperty("TransactionId", out var transactionIdElement))
                {
                    if (transactionIdElement.ValueKind == JsonValueKind.Number)
                    {
                        transactionId = transactionIdElement.GetInt64();
                        sTransactionId = transactionId.Value.ToString();
                    }
                    else if (transactionIdElement.ValueKind == JsonValueKind.String)
                    {
                        sTransactionId = transactionIdElement.GetString();
                        if (long.TryParse(sTransactionId, out var parsedId))
                        {
                            transactionId = parsedId;
                        }
                    }
                }
                
                // Si no se encontró TransactionId, buscar STransactionId
                if (transactionId == null && responseJson.TryGetProperty("STransactionId", out var sTransactionIdElement))
                {
                    sTransactionId = sTransactionIdElement.GetString();
                    if (!string.IsNullOrEmpty(sTransactionId) && long.TryParse(sTransactionId, out var parsedId))
                    {
                        transactionId = parsedId;
                    }
                }
                
                // También buscar con camelCase por si acaso
                if (transactionId == null && responseJson.TryGetProperty("transactionId", out var transactionIdElementCamel))
                {
                    if (transactionIdElementCamel.ValueKind == JsonValueKind.Number)
                    {
                        transactionId = transactionIdElementCamel.GetInt64();
                        sTransactionId = transactionId.Value.ToString();
                    }
                    else if (transactionIdElementCamel.ValueKind == JsonValueKind.String)
                    {
                        sTransactionId = transactionIdElementCamel.GetString();
                        if (long.TryParse(sTransactionId, out var parsedId))
                        {
                            transactionId = parsedId;
                        }
                    }
                }
                
                if (transactionId == null)
                {
                    _logger.LogWarning("No se encontró TransactionId en la respuesta del POS. ResponseContent: {ResponseContent}", responseContent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al parsear TransactionId de la respuesta POS. ResponseContent: {ResponseContent}", responseContent);
            }

            _logger.LogInformation("Transacción POS enviada exitosamente. Monto: {Amount}, TransactionId: {TransactionId}, Response: {Response}", 
                request.Amount, transactionId, responseContent);

            return Ok(new { 
                success = true, 
                message = "Transacción POS enviada exitosamente",
                transactionId = transactionId,
                sTransactionId = sTransactionId,
                transactionDateTime = transactionDateTime,
                requestJson = jsonContent, // JSON enviado al ITD
                response = responseContent // Respuesta recibida del ITD
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar transacción POS");
            return StatusCode(500, new { error = "Error al enviar transacción POS", details = ex.Message });
        }
    }

    /// <summary>
    /// Envía una devolución (void) al POS externo
    /// </summary>
    [HttpPost("pos/void")]
    public async Task<ActionResult> SendPOSVoid([FromBody] POSVoidRequest request)
    {
        try
        {
            if (request.Amount <= 0)
            {
                return BadRequest(new { error = "El monto debe ser mayor a 0" });
            }

            // Obtener información del pedido original si se proporciona OrderId
            Order? originalOrder = null;
            if (request.OrderId.HasValue)
            {
                originalOrder = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == request.OrderId.Value);
                
                if (originalOrder == null)
                {
                    return BadRequest(new { error = "Pedido no encontrado" });
                }

                // Verificar si ya existe una devolución para este pedido
                if (originalOrder.POSRefundTransactionId != null || !string.IsNullOrWhiteSpace(originalOrder.POSRefundTransactionIdString))
                {
                    return BadRequest(new { 
                        error = "Este pedido ya tiene una devolución procesada",
                        refundTransactionId = originalOrder.POSRefundTransactionId ?? (long.TryParse(originalOrder.POSRefundTransactionIdString, out var parsedId) ? parsedId : null),
                        refundTransactionIdString = originalOrder.POSRefundTransactionIdString,
                        refundedAt = originalOrder.POSRefundedAt
                    });
                }
            }

            // Fecha/hora de la devolución (actual) - REQUERIDO: TransactionDateTimeyyyyMMddHHmmssSSS
            var now = DateTime.UtcNow;
            var refundTransactionDateTime = now.ToString("yyyyMMddHHmmssfff");

            // Fecha de la transacción original - REQUERIDO: OriginalTransactionDateyyMMdd (formato yyMMdd - 6 caracteres)
            string originalTransactionDate;
            if (!string.IsNullOrWhiteSpace(request.OriginalTransactionDateTime))
            {
                // Si viene en formato yyyyMMddHHmmssSSS, extraer solo yyMMdd
                if (request.OriginalTransactionDateTime.Length >= 8)
                {
                    // Extraer los primeros 8 caracteres (yyyyMMdd) y luego tomar los últimos 6 (yyMMdd)
                    var yyyyMMdd = request.OriginalTransactionDateTime.Substring(0, 8);
                    originalTransactionDate = yyyyMMdd.Substring(2, 6); // yyMMdd
                }
                else if (request.OriginalTransactionDateTime.Length == 6)
                {
                    // Ya viene en formato yyMMdd
                    originalTransactionDate = request.OriginalTransactionDateTime;
                }
                else
                {
                    // Si no tiene el formato correcto, usar la fecha del pedido
                    var orderDate = originalOrder?.CreatedAt ?? DateTime.UtcNow;
                    originalTransactionDate = orderDate.ToString("yyMMdd");
                }
            }
            else if (originalOrder?.POSTransactionDateTime != null)
            {
                // Usar la fecha de la transacción original del pedido
                var originalDateTime = originalOrder.POSTransactionDateTime;
                if (originalDateTime.Length >= 8)
                {
                    var yyyyMMdd = originalDateTime.Substring(0, 8);
                    originalTransactionDate = yyyyMMdd.Substring(2, 6); // yyMMdd
                }
                else
                {
                    var orderDate = originalOrder.CreatedAt;
                    originalTransactionDate = orderDate.ToString("yyMMdd");
                }
            }
            else
            {
                // Si no hay información, usar la fecha actual menos 1 día (asumiendo que la transacción fue reciente)
                var yesterday = DateTime.UtcNow.AddDays(-1);
                originalTransactionDate = yesterday.ToString("yyMMdd");
            }

            // TicketNumber - REQUERIDO: Número de ticket de la transacción original
            string ticketNumber;
            if (!string.IsNullOrWhiteSpace(request.TicketNumber))
            {
                ticketNumber = request.TicketNumber;
            }
            else if (originalOrder?.POSTransactionIdString != null)
            {
                // Usar los últimos 4 dígitos del TransactionId como TicketNumber
                var transactionIdStr = originalOrder.POSTransactionIdString;
                if (transactionIdStr.Length >= 4)
                {
                    ticketNumber = transactionIdStr.Substring(transactionIdStr.Length - 4).PadLeft(4, '0');
                }
                else
                {
                    ticketNumber = transactionIdStr.PadLeft(4, '0');
                }
            }
            else if (originalOrder?.POSTransactionId != null)
            {
                // Usar los últimos 4 dígitos del TransactionId como TicketNumber
                var transactionIdStr = originalOrder.POSTransactionId.ToString();
                if (transactionIdStr.Length >= 4)
                {
                    ticketNumber = transactionIdStr.Substring(transactionIdStr.Length - 4).PadLeft(4, '0');
                }
                else
                {
                    ticketNumber = transactionIdStr.PadLeft(4, '0');
                }
            }
            else
            {
                return BadRequest(new { error = "TicketNumber es requerido. Proporcione TicketNumber o OrderId con información de transacción POS." });
            }

            // Convertir el monto: si es 1120, debe ser "112000" (multiplicar por 100)
            var amountFormatted = ((long)Math.Round(request.Amount * 100)).ToString();

            // Calcular TaxableAmount e InvoiceAmount
            // Si no se proporcionan, usar el monto como base (asumiendo IVA del 22%)
            var taxableAmount = request.TaxableAmount.HasValue 
                ? ((long)Math.Round(request.TaxableAmount.Value * 100)).ToString()
                : amountFormatted; // Por defecto usar el mismo monto
            
            var invoiceAmount = request.InvoiceAmount.HasValue
                ? ((long)Math.Round(request.InvoiceAmount.Value * 100)).ToString()
                : amountFormatted; // Por defecto usar el mismo monto

            // Obtener configuración POS del restaurante
            var posConfig = await GetPOSConfigAsync();

            // Crear el JSON con todos los campos requeridos según la documentación
            // Formato consistente con el ejemplo Java que funciona
            var jsonContent = $@"{{
  ""PosID"": ""{posConfig.PosId}"",
  ""SystemId"": ""{posConfig.SystemId}"",
  ""Branch"": ""{posConfig.Branch}"",
  ""ClientAppId"": ""{posConfig.ClientAppId}"",
  ""UserId"": ""1"",
  ""TransactionDateTimeyyyyMMddHHmmssSSS"": ""{refundTransactionDateTime}"",
  ""OriginalTransactionDateyyMMdd"": ""{originalTransactionDate}"",
  ""Amount"": ""{amountFormatted}"",
  ""Quotas"": ""1"",
  ""Plan"": ""0"",
  ""Currency"": ""858"",
  ""TaxRefund"": ""1"",
  ""TaxableAmount"": ""{taxableAmount}"",
  ""InvoiceAmount"": ""{invoiceAmount}"",
  ""TicketNumber"": ""{ticketNumber}""
}}";

            _logger.LogInformation("Enviando devolución POS. JSON: {Json}", jsonContent);

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json")
            {
                CharSet = "UTF-8"
            };

            var response = await httpClient.PostAsync(POS_VOID_API_URL, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Error al enviar devolución POS. Status: {Status}, Response: {Response}", 
                    response.StatusCode, responseContent);
                return StatusCode((int)response.StatusCode, new { 
                    error = "Error al comunicarse con el POS para devolución", 
                    details = responseContent 
                });
            }

            // Parsear la respuesta para verificar el código y extraer información
            long? refundTransactionId = null;
            string? refundTransactionIdString = null;
            int? responseCode = null;
            bool isSuccess = false;

            try
            {
                var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (responseJson.TryGetProperty("ResponseCode", out var responseCodeElement))
                {
                    responseCode = responseCodeElement.GetInt32();
                    var statusMessage = GetPOSStatusCodeMessage(responseCode.Value);
                    
                    _logger.LogInformation("Devolución POS enviada. Monto: {Amount}, ResponseCode: {ResponseCode}, Mensaje: {Message}, Response: {Response}", 
                        request.Amount, responseCode, statusMessage, responseContent);

                    // Solo considerar exitoso si el código es 0 o 100
                    isSuccess = responseCode == 0 || responseCode == 100;

                    if (isSuccess)
                    {
                        // Extraer TransactionId de la respuesta
                        if (responseJson.TryGetProperty("TransactionId", out var transactionIdElement))
                        {
                            if (transactionIdElement.ValueKind == JsonValueKind.Number)
                            {
                                refundTransactionId = transactionIdElement.GetInt64();
                                refundTransactionIdString = refundTransactionId.Value.ToString();
                            }
                            else if (transactionIdElement.ValueKind == JsonValueKind.String)
                            {
                                refundTransactionIdString = transactionIdElement.GetString();
                                if (long.TryParse(refundTransactionIdString, out var parsedId))
                                {
                                    refundTransactionId = parsedId;
                                }
                            }
                        }
                        
                        // Si no se encontró TransactionId, buscar STransactionId
                        if (refundTransactionId == null && responseJson.TryGetProperty("STransactionId", out var sTransactionIdElement))
                        {
                            refundTransactionIdString = sTransactionIdElement.GetString();
                            if (!string.IsNullOrEmpty(refundTransactionIdString) && long.TryParse(refundTransactionIdString, out var parsedId))
                            {
                                refundTransactionId = parsedId;
                            }
                        }

                        // Guardar información de la devolución en el pedido si existe
                        if (originalOrder != null)
                        {
                            // Buscar todos los pedidos que compartan la misma transacción POS
                            var transactionIdToMatch = originalOrder.POSTransactionId?.ToString() ?? originalOrder.POSTransactionIdString;
                            
                            if (!string.IsNullOrWhiteSpace(transactionIdToMatch))
                            {
                                // Buscar todos los pedidos con la misma transacción POS
                                var ordersWithSameTransaction = await _context.Orders
                                    .Where(o => (o.POSTransactionId != null && o.POSTransactionId.ToString() == transactionIdToMatch) ||
                                                (o.POSTransactionIdString != null && o.POSTransactionIdString == transactionIdToMatch))
                                    .ToListAsync();

                                // Actualizar todos los pedidos que compartan la misma transacción POS
                                foreach (var orderToUpdate in ordersWithSameTransaction)
                                {
                                    orderToUpdate.POSRefundTransactionId = refundTransactionId;
                                    orderToUpdate.POSRefundTransactionIdString = refundTransactionIdString;
                                    orderToUpdate.POSRefundTransactionDateTime = refundTransactionDateTime;
                                    orderToUpdate.POSRefundResponse = responseContent;
                                    orderToUpdate.POSRefundedAt = DateTime.UtcNow;
                                    orderToUpdate.UpdatedAt = DateTime.UtcNow;
                                }

                                await _context.SaveChangesAsync();
                                _logger.LogInformation("Información de devolución guardada en {Count} pedido(s) con transacción POS {TransactionId}", 
                                    ordersWithSameTransaction.Count, transactionIdToMatch);
                            }
                            else
                            {
                                // Si no hay transactionId, solo actualizar el pedido original
                                originalOrder.POSRefundTransactionId = refundTransactionId;
                                originalOrder.POSRefundTransactionIdString = refundTransactionIdString;
                                originalOrder.POSRefundTransactionDateTime = refundTransactionDateTime;
                                originalOrder.POSRefundResponse = responseContent;
                                originalOrder.POSRefundedAt = DateTime.UtcNow;
                                originalOrder.UpdatedAt = DateTime.UtcNow;

                                await _context.SaveChangesAsync();
                                _logger.LogInformation("Información de devolución guardada en pedido {OrderId}", originalOrder.Id);
                            }
                        }
                    }
                    else
                    {
                        return Ok(new { 
                            success = false, 
                            message = $"Devolución POS procesada con código: {responseCode} - {statusMessage}",
                            responseCode = responseCode,
                            response = responseContent 
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo parsear la respuesta del POS. Response: {Response}", responseContent);
            }

            _logger.LogInformation("Devolución POS enviada exitosamente. Monto: {Amount}, RefundTransactionId: {RefundTransactionId}, Response: {Response}", 
                request.Amount, refundTransactionId, responseContent);

            return Ok(new { 
                success = true, 
                message = "Devolución POS enviada exitosamente",
                refundTransactionId = refundTransactionId,
                refundTransactionIdString = refundTransactionIdString,
                refundTransactionDateTime = refundTransactionDateTime,
                responseCode = responseCode,
                response = responseContent 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar devolución POS");
            return StatusCode(500, new { error = "Error al enviar devolución POS", details = ex.Message });
        }
    }

    /// <summary>
    /// Consulta el estado de una transacción POS
    /// </summary>
    [HttpPost("pos/query")]
    public async Task<ActionResult> QueryPOSTransaction([FromBody] POSQueryRequest request)
    {
        try
        {
            if (request.TransactionId == null && string.IsNullOrWhiteSpace(request.STransactionId))
            {
                return BadRequest(new { error = "TransactionId o STransactionId es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.TransactionDateTime))
            {
                return BadRequest(new { error = "TransactionDateTime es requerido" });
            }

            var transactionId = request.TransactionId ?? (long.TryParse(request.STransactionId, out var parsed) ? parsed : 0);
            var sTransactionId = request.STransactionId ?? request.TransactionId?.ToString() ?? "0";

            if (transactionId == 0)
            {
                return BadRequest(new { error = "TransactionId inválido" });
            }

            // Obtener configuración POS del restaurante
            var posConfig = await GetPOSConfigAsync();

            // Crear el JSON para consultar el estado
            var jsonContent = $@"{{
  ""PosID"": ""{posConfig.PosId}"",
  ""SystemId"": ""{posConfig.SystemId}"",
  ""Branch"": ""{posConfig.Branch}"",
  ""ClientAppId"": ""{posConfig.ClientAppId}"",
  ""UserId"": ""1"",
  ""TransactionDateTimeyyyyMMddHHmmssSSS"": ""{request.TransactionDateTime}"",
  ""TransactionId"": {transactionId},
  ""STransactionId"": ""{sTransactionId}""
}}";

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json")
            {
                CharSet = "UTF-8"
            };

            var response = await httpClient.PostAsync(POS_QUERY_API_URL, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Error al consultar transacción POS. Status: {Status}, Response: {Response}", 
                    response.StatusCode, responseContent);
                return StatusCode((int)response.StatusCode, new { 
                    error = "Error al consultar transacción POS", 
                    details = responseContent 
                });
            }

            // Parsear la respuesta para obtener el código de estado
            // La respuesta del POS viene como: {"ResponseCode":10,"RemainingExpirationTime":238.0,...}
            int statusCode = -1;
            string statusMessage = "Error no determinado";
            double? remainingExpirationTime = null;
            try
            {
                var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                
                // Buscar ResponseCode (campo principal según la documentación)
                if (responseJson.TryGetProperty("ResponseCode", out var responseCodeElement))
                {
                    if (responseCodeElement.ValueKind == JsonValueKind.Number)
                        statusCode = responseCodeElement.GetInt32();
                    else if (responseCodeElement.ValueKind == JsonValueKind.String && int.TryParse(responseCodeElement.GetString(), out var parsedCode))
                        statusCode = parsedCode;
                }
                // También buscar con camelCase por si acaso
                else if (responseJson.TryGetProperty("responseCode", out var responseCodeElementCamel))
                {
                    if (responseCodeElementCamel.ValueKind == JsonValueKind.Number)
                        statusCode = responseCodeElementCamel.GetInt32();
                    else if (responseCodeElementCamel.ValueKind == JsonValueKind.String && int.TryParse(responseCodeElementCamel.GetString(), out var parsedCode))
                        statusCode = parsedCode;
                }
                // Fallback a otros nombres posibles
                else if (responseJson.TryGetProperty("Code", out var codeElement))
                {
                    if (codeElement.ValueKind == JsonValueKind.Number)
                        statusCode = codeElement.GetInt32();
                    else if (codeElement.ValueKind == JsonValueKind.String && int.TryParse(codeElement.GetString(), out var parsedCode))
                        statusCode = parsedCode;
                }
                else if (responseJson.TryGetProperty("code", out var codeElementCamel))
                {
                    if (codeElementCamel.ValueKind == JsonValueKind.Number)
                        statusCode = codeElementCamel.GetInt32();
                    else if (codeElementCamel.ValueKind == JsonValueKind.String && int.TryParse(codeElementCamel.GetString(), out var parsedCode))
                        statusCode = parsedCode;
                }
                else if (responseJson.TryGetProperty("StatusCode", out var statusCodeElement))
                {
                    if (statusCodeElement.ValueKind == JsonValueKind.Number)
                        statusCode = statusCodeElement.GetInt32();
                    else if (statusCodeElement.ValueKind == JsonValueKind.String && int.TryParse(statusCodeElement.GetString(), out var parsedCode))
                        statusCode = parsedCode;
                }

                // Buscar RemainingExpirationTime (importante para determinar cuándo hacer reverso)
                if (responseJson.TryGetProperty("RemainingExpirationTime", out var remainingTimeElement))
                {
                    if (remainingTimeElement.ValueKind == JsonValueKind.Number)
                        remainingExpirationTime = remainingTimeElement.GetDouble();
                    else if (remainingTimeElement.ValueKind == JsonValueKind.String && double.TryParse(remainingTimeElement.GetString(), out var parsedTime))
                        remainingExpirationTime = parsedTime;
                }
                else if (responseJson.TryGetProperty("remainingExpirationTime", out var remainingTimeElementCamel))
                {
                    if (remainingTimeElementCamel.ValueKind == JsonValueKind.Number)
                        remainingExpirationTime = remainingTimeElementCamel.GetDouble();
                    else if (remainingTimeElementCamel.ValueKind == JsonValueKind.String && double.TryParse(remainingTimeElementCamel.GetString(), out var parsedTime))
                        remainingExpirationTime = parsedTime;
                }

                // Obtener el mensaje de la codiguera
                statusMessage = GetPOSStatusCodeMessage(statusCode);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo parsear el código de estado de la respuesta POS. ResponseContent: {ResponseContent}", responseContent);
            }

            _logger.LogInformation("Consulta POS realizada. TransactionId: {TransactionId}, StatusCode: {StatusCode}, Message: {Message}", 
                transactionId, statusCode, statusMessage);

            // Determinar el estado según la documentación del POS
            // ResponseCode 0 o 100 = Resultado OK (completada)
            // ResponseCode 10 = Se debe consultar por la transacción (pendiente)
            // ResponseCode 11 = Aguardando por operación en el pinpad (pendiente)
            // ResponseCode 12 = Tiempo de transacción excedido (error)
            // ResponseCode > 100 = Error
            // ResponseCode < 0 = Error
            bool isCompleted = statusCode == 0 || statusCode == 100;
            bool isPending = statusCode == 10 || statusCode == 11;
            bool isError = (statusCode > 100 && statusCode != 999) || statusCode < 0 || statusCode == 12;
            
            // Si statusCode es -1, significa que no se pudo parsear, considerar como error
            if (statusCode == -1)
            {
                isError = true;
                isPending = false;
                isCompleted = false;
            }

            return Ok(new { 
                success = true,
                statusCode = statusCode,
                statusMessage = statusMessage,
                isCompleted = isCompleted,
                isPending = isPending,
                isError = isError,
                remainingExpirationTime = remainingExpirationTime,
                response = responseContent 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar transacción POS");
            return StatusCode(500, new { error = "Error al consultar transacción POS", details = ex.Message });
        }
    }

    /// <summary>
    /// Envía un reverso al POS externo
    /// El reverso se utiliza para dejar sin efecto la última transacción que no ha podido ser completada
    /// (cuando no se recibió el mensaje de respuesta desde el POS)
    /// </summary>
    [HttpPost("pos/reverse")]
    public async Task<ActionResult> SendPOSReverse([FromBody] POSReverseRequest request)
    {
        try
        {
            // Obtener información del pedido original si se proporciona OrderId
            Order? originalOrder = null;
            if (request.OrderId.HasValue)
            {
                var restaurantId = RestaurantHelper.GetRestaurantId(User);
                originalOrder = await _context.Orders
                    .FirstOrDefaultAsync(o => o.Id == request.OrderId.Value && o.RestaurantId == restaurantId);
                
                if (originalOrder == null)
                {
                    return BadRequest(new { error = "Pedido no encontrado" });
                }

                // Verificar si ya existe un reverso para este pedido
                if (originalOrder.POSReverseTransactionId != null || !string.IsNullOrWhiteSpace(originalOrder.POSReverseTransactionIdString))
                {
                    return BadRequest(new { 
                        error = "Este pedido ya tiene un reverso procesado",
                        reverseTransactionId = originalOrder.POSReverseTransactionId ?? (long.TryParse(originalOrder.POSReverseTransactionIdString, out var parsedId) ? parsedId : null),
                        reverseTransactionIdString = originalOrder.POSReverseTransactionIdString,
                        reversedAt = originalOrder.POSReversedAt
                    });
                }

                // Verificar que el pedido tenga una transacción POS original
                if (originalOrder.POSTransactionId == null && string.IsNullOrWhiteSpace(originalOrder.POSTransactionIdString))
                {
                    return BadRequest(new { error = "Este pedido no tiene una transacción POS original para reversar" });
                }
            }

            // Obtener TransactionId y STransactionId
            long? transactionId = null;
            string? sTransactionId = null;
            string? transactionDateTime = null;

            if (request.TransactionId.HasValue || !string.IsNullOrWhiteSpace(request.STransactionId))
            {
                transactionId = request.TransactionId ?? (long.TryParse(request.STransactionId, out var parsed) ? parsed : null);
                sTransactionId = request.STransactionId ?? request.TransactionId?.ToString();
                transactionDateTime = request.TransactionDateTime;
            }
            else if (originalOrder != null)
            {
                transactionId = originalOrder.POSTransactionId;
                sTransactionId = originalOrder.POSTransactionIdString ?? originalOrder.POSTransactionId?.ToString();
                transactionDateTime = originalOrder.POSTransactionDateTime;
            }
            else
            {
                return BadRequest(new { error = "TransactionId o STransactionId es requerido, o proporcione OrderId" });
            }

            if (transactionId == null && string.IsNullOrWhiteSpace(sTransactionId))
            {
                return BadRequest(new { error = "TransactionId inválido" });
            }

            if (string.IsNullOrWhiteSpace(transactionDateTime))
            {
                // Si no se proporciona, usar la fecha del pedido o actual
                if (originalOrder != null)
                {
                    transactionDateTime = originalOrder.POSTransactionDateTime ?? originalOrder.CreatedAt.ToString("yyyyMMddHHmmssfff");
                }
                else
                {
                    transactionDateTime = DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
                }
            }

            // Fecha/hora del reverso (actual)
            var now = DateTime.UtcNow;
            var reverseTransactionDateTime = now.ToString("yyyyMMddHHmmssfff");

            // Obtener configuración POS del restaurante
            var posConfig = await GetPOSConfigAsync();

            // Crear el JSON según la documentación
            var jsonContent = $@"{{
  ""PosID"": ""{posConfig.PosId}"",
  ""SystemId"": ""{posConfig.SystemId}"",
  ""Branch"": ""{posConfig.Branch}"",
  ""ClientAppId"": ""{posConfig.ClientAppId}"",
  ""UserId"": ""1"",
  ""TransactionDateTimeyyyyMMddHHmmssSSS"": ""{reverseTransactionDateTime}"",
  ""TransactionId"": {transactionId ?? 0},
  ""STransactionId"": ""{sTransactionId ?? "0"}""
}}";

            // Log del JSON que se envía al POSLink (ITD) para reverso
            _logger.LogInformation("🔄 [POS] Enviando reverso al POSLink (ITD). URL: {Url}", POS_REVERSE_API_URL);
            _logger.LogInformation("🔄 [POS] JSON de reverso enviado:\n{Json}", jsonContent);
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine("🔄 [POS] ENVIANDO REVERSO AL POSLINK (ITD)");
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine($"URL: {POS_REVERSE_API_URL}");
            Console.WriteLine($"JSON Enviado:\n{jsonContent}");
            Console.WriteLine("═══════════════════════════════════════════════════════════");

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json")
            {
                CharSet = "UTF-8"
            };

            var response = await httpClient.PostAsync(POS_REVERSE_API_URL, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            // Log de la respuesta recibida del POSLink para reverso
            _logger.LogInformation("📥 [POS] Respuesta de reverso recibida del POSLink. Status: {Status}", response.StatusCode);
            _logger.LogInformation("📥 [POS] Respuesta JSON de reverso:\n{Response}", responseContent);
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine("📥 [POS] RESPUESTA DE REVERSO RECIBIDA DEL POSLINK (ITD)");
            Console.WriteLine("═══════════════════════════════════════════════════════════");
            Console.WriteLine($"Status Code: {response.StatusCode}");
            Console.WriteLine($"Respuesta JSON:\n{responseContent}");
            Console.WriteLine("═══════════════════════════════════════════════════════════");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Error al enviar reverso POS. Status: {Status}, Response: {Response}", 
                    response.StatusCode, responseContent);
                return StatusCode((int)response.StatusCode, new { 
                    error = "Error al comunicarse con el POS para reverso", 
                    details = responseContent 
                });
            }

            // Parsear la respuesta para verificar el código
            int? responseCode = null;
            bool isSuccess = false;

            try
            {
                var responseJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (responseJson.TryGetProperty("ResponseCode", out var responseCodeElement))
                {
                    responseCode = responseCodeElement.GetInt32();
                    var statusMessage = GetPOSStatusCodeMessage(responseCode.Value);
                    
                    _logger.LogInformation("Reverso POS enviado. TransactionId: {TransactionId}, ResponseCode: {ResponseCode}, Mensaje: {Message}, Response: {Response}", 
                        transactionId, responseCode, statusMessage, responseContent);

                    // Solo considerar exitoso si el código es 0 o 100
                    isSuccess = responseCode == 0 || responseCode == 100;

                    if (isSuccess)
                    {
                        // Guardar información del reverso en el pedido si existe
                        if (originalOrder != null)
                        {
                            originalOrder.POSReverseTransactionId = transactionId;
                            originalOrder.POSReverseTransactionIdString = sTransactionId;
                            originalOrder.POSReverseResponse = responseContent;
                            originalOrder.POSReversedAt = DateTime.UtcNow;
                            originalOrder.UpdatedAt = DateTime.UtcNow;

                            await _context.SaveChangesAsync();
                            _logger.LogInformation("Información de reverso guardada en pedido {OrderId}", originalOrder.Id);
                        }

                        return Ok(new { 
                            success = true, 
                            message = "Reverso POS enviado exitosamente",
                            responseCode = responseCode,
                            requestJson = jsonContent, // JSON enviado al ITD
                            response = responseContent // Respuesta recibida del ITD
                        });
                    }
                    else
                    {
                        return Ok(new { 
                            success = false, 
                            message = $"Reverso POS procesado con código: {responseCode} - {statusMessage}",
                            responseCode = responseCode,
                            requestJson = jsonContent, // JSON enviado al ITD
                            response = responseContent // Respuesta recibida del ITD
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo parsear la respuesta del POS. Response: {Response}", responseContent);
            }

            _logger.LogInformation("Reverso POS enviado exitosamente. TransactionId: {TransactionId}, Response: {Response}", 
                transactionId, responseContent);

            return Ok(new { 
                success = true, 
                message = "Reverso POS enviado exitosamente",
                responseCode = responseCode,
                requestJson = jsonContent, // JSON enviado al ITD
                response = responseContent // Respuesta recibida del ITD
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar reverso POS");
            return StatusCode(500, new { error = "Error al enviar reverso POS", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el mensaje correspondiente al código de estado del POS según la codiguera
    /// </summary>
    private string GetPOSStatusCodeMessage(int code)
    {
        return code switch
        {
            0 => "Resultado OK",
            100 => "Resultado OK",
            101 => "Número de pinpad inválido",
            102 => "Número de sucursal inválido",
            103 => "Número de caja inválido",
            104 => "Fecha de la transacción inválida",
            105 => "Monto no válido",
            106 => "Cantidad de cuotas inválidas",
            107 => "Número de plan inválido",
            108 => "Número de factura inválido",
            109 => "Moneda ingresada no válida",
            110 => "Número de ticket inválido",
            111 => "No existe transacción",
            112 => "Transacción finalizada",
            113 => "Identificador de sistema inválido",
            10 => "Se debe consultar por la transacción",
            11 => "Aguardando por operación en el pinpad",
            12 => "Tiempo de transacción excedido, envíe datos nuevamente",
            999 => "Error no determinado",
            -100 => "Error no determinado",
            _ => "Formato en campo/s incorrecta; Faltan campos obligatorios"
        };
    }
}

public class VerifyReceiptRequest
{
    public bool IsVerified { get; set; }
}

public class UpdateOrderPaymentMethodRequest
{
    public string PaymentMethod { get; set; } = string.Empty;
    // Información de transacción POS (opcional, solo para pagos POS)
    public long? POSTransactionId { get; set; }
    public string? POSTransactionIdString { get; set; }
    public string? POSTransactionDateTime { get; set; }
    public string? POSResponse { get; set; }
}

public class POSTransactionRequest
{
    public decimal Amount { get; set; }
}

public class POSVoidRequest
{
    public decimal Amount { get; set; }
    public string? OriginalTransactionDateTime { get; set; } // TransactionDateTime de la transacción original (yyyyMMddHHmmssSSS)
    public string? TicketNumber { get; set; } // Número de ticket de la transacción original (requerido)
    public int? OrderId { get; set; } // ID del pedido para obtener información de la transacción original
    public decimal? TaxableAmount { get; set; } // Monto gravado (opcional, se calcula si no se proporciona)
    public decimal? InvoiceAmount { get; set; } // Monto total de factura (opcional, se calcula si no se proporciona)
}

public class POSQueryRequest
{
    public long? TransactionId { get; set; }
    public string? STransactionId { get; set; }
    public string TransactionDateTime { get; set; } = string.Empty;
}

public class POSReverseRequest
{
    public long? TransactionId { get; set; }
    public string? STransactionId { get; set; }
    public string? TransactionDateTime { get; set; } // TransactionDateTime de la transacción original (yyyyMMddHHmmssSSS)
    public int? OrderId { get; set; } // ID del pedido para obtener información de la transacción original
}

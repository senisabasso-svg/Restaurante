using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.Services;
using CornerApp.API.DTOs;
using CornerApp.API.Constants;
using CornerApp.API.Helpers;
using CornerApp.API.Models.Messages;
using System;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/orders")]
[Tags("Pedidos")]
public class OrdersController : ControllerBase
{
    private readonly ILogger<OrdersController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly IDeliveryZoneService _deliveryZoneService;
    private readonly OrderProcessingService _orderProcessingService;
    private readonly IWebhookService? _webhookService;
    private readonly IMessageQueueService? _messageQueue;
    private readonly Hubs.IOrderNotificationService _orderNotificationService;
    private readonly IBusinessHoursService _businessHoursService;

    public OrdersController(
        ILogger<OrdersController> logger, 
        ApplicationDbContext context,
        IDeliveryZoneService deliveryZoneService,
        OrderProcessingService orderProcessingService,
        Hubs.IOrderNotificationService orderNotificationService,
        IBusinessHoursService businessHoursService,
        IWebhookService? webhookService = null,
        IMessageQueueService? messageQueue = null)
    {
        _logger = logger;
        _context = context;
        _deliveryZoneService = deliveryZoneService;
        _orderProcessingService = orderProcessingService;
        _orderNotificationService = orderNotificationService;
        _businessHoursService = businessHoursService;
        _webhookService = webhookService;
        _messageQueue = messageQueue;
    }

    /// <summary>
    /// Valida y limpia coordenadas fuera de los límites geográficos configurados en un pedido
    /// </summary>
    private async Task<bool> ValidateAndCleanOrderCoordinates(Order order)
    {
        bool coordinatesCleaned = false;
        var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
        var cityName = businessInfo?.CityName ?? "Salto, Uruguay";
        
        // Validar coordenadas del repartidor
        if (order.DeliveryLatitude.HasValue && order.DeliveryLongitude.HasValue)
        {
            if (!_deliveryZoneService.IsWithinSaltoUruguay(order.DeliveryLatitude.Value, order.DeliveryLongitude.Value))
            {
                _logger.LogWarning(
                    "Pedido {OrderId}: Coordenadas del repartidor fuera de {CityName} ({Lat}, {Lng}). Limpiando coordenadas.",
                    order.Id,
                    cityName,
                    order.DeliveryLatitude.Value,
                    order.DeliveryLongitude.Value
                );
                order.DeliveryLatitude = null;
                order.DeliveryLongitude = null;
                order.DeliveryLocationUpdatedAt = null;
                coordinatesCleaned = true;
            }
        }
        
        // Validar coordenadas del cliente
        if (order.CustomerLatitude.HasValue && order.CustomerLongitude.HasValue)
        {
            if (!_deliveryZoneService.IsWithinSaltoUruguay(order.CustomerLatitude.Value, order.CustomerLongitude.Value))
            {
                _logger.LogWarning(
                    "Pedido {OrderId}: Coordenadas del cliente fuera de {CityName} ({Lat}, {Lng}). Limpiando coordenadas.",
                    order.Id,
                    cityName,
                    order.CustomerLatitude.Value,
                    order.CustomerLongitude.Value
                );
                order.CustomerLatitude = null;
                order.CustomerLongitude = null;
                coordinatesCleaned = true;
            }
        }
        
        // Guardar cambios si se limpiaron coordenadas
        if (coordinatesCleaned)
        {
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Pedido {OrderId}: Coordenadas inválidas limpiadas y guardadas", order.Id);
        }
        
        return coordinatesCleaned;
    }

    /// <summary>
    /// Obtiene el estado del negocio (abierto/cerrado) y mensaje
    /// </summary>
    [HttpGet("business-status")]
    public async Task<ActionResult> GetBusinessStatus()
    {
        try
        {
            var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
            
            // Verificar horario de pedidos (8 PM a 12 AM)
            var isWithinHours = _businessHoursService.IsWithinOrderHours();
            var hoursMessage = _businessHoursService.GetStatusMessage();
            var timeUntilChange = _businessHoursService.GetTimeUntilNextChange();
            
            // El negocio está abierto si:
            // 1. La configuración manual dice que está abierto (businessInfo.IsOpen)
            // 2. Y estamos dentro del horario de pedidos (8 PM - 12 AM)
            var isOpen = (businessInfo == null || businessInfo.IsOpen) && isWithinHours;
            
            if (businessInfo == null)
            {
                return Ok(new { 
                    isOpen = isOpen,
                    storeName = "CornerApp",
                    message = isOpen ? "¡Bienvenido!" : hoursMessage,
                    isWithinHours = isWithinHours,
                    hoursMessage = hoursMessage,
                    openingTime = "20:00",
                    closingTime = "00:00",
                    timeUntilNextChange = timeUntilChange?.TotalMinutes
                });
            }

            return Ok(new { 
                isOpen = isOpen,
                storeName = businessInfo.StoreName,
                message = isOpen 
                    ? (businessInfo.WelcomeMessage ?? "¡Bienvenido!") 
                    : (businessInfo.ClosedMessage ?? hoursMessage),
                isWithinHours = isWithinHours,
                hoursMessage = hoursMessage,
                openingTime = "20:00",
                closingTime = "00:00",
                timeUntilNextChange = timeUntilChange?.TotalMinutes,
                estimatedDeliveryMinutes = businessInfo.EstimatedDeliveryMinutes,
                minimumOrderAmount = businessInfo.MinimumOrderAmount,
                phone = businessInfo.Phone,
                whatsApp = businessInfo.WhatsApp,
                address = businessInfo.Address
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estado del negocio");
            return StatusCode(500, new { error = "Error al obtener estado del negocio" });
        }
    }

    /// <summary>
    /// Crea un nuevo pedido
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
    {
        try
        {
            // Verificar si el negocio está abierto (configuración manual)
            var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
            if (businessInfo != null && !businessInfo.IsOpen)
            {
                _logger.LogWarning("Pedido rechazado: El negocio está cerrado (configuración manual)");
                return BadRequest(new { 
                    error = businessInfo.ClosedMessage ?? "El negocio está cerrado en este momento. Por favor, intenta más tarde.",
                    isClosed = true
                });
            }

            // Verificar horario de pedidos (8 PM a 12 AM)
            if (!_businessHoursService.IsWithinOrderHours())
            {
                var message = _businessHoursService.GetStatusMessage();
                _logger.LogWarning("Pedido rechazado: Fuera del horario de pedidos. {Message}", message);
                return BadRequest(new { 
                    error = message,
                    isClosed = true,
                    isOutsideHours = true
                });
            }

            // Validar datos
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
                .Include(p => p.Category)
                .Where(p => productIds.Contains(p.Id))
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts.Select(p => p.Id)).ToList();
            if (missingProductIds.Any())
            {
                _logger.LogWarning("Intento de crear pedido con productos inexistentes: {ProductIds}", string.Join(", ", missingProductIds));
                return BadRequest(new { 
                    error = $"Los siguientes productos no existen: {string.Join(", ", missingProductIds)}" 
                });
            }

            // Validar comprobante de transferencia si se proporciona
            if (!string.IsNullOrWhiteSpace(request.ReceiptImage))
            {
                var (isValid, errorMessage) = FileValidationHelper.ValidateReceiptImage(
                    request.ReceiptImage, 
                    AppConstants.MAX_PRODUCT_IMAGE_SIZE_BYTES // Usar mismo límite que imágenes de productos
                );

                if (!isValid)
                {
                    return BadRequest(new { error = $"Comprobante inválido: {errorMessage}" });
                }
            }

            // Obtener coordenadas del cliente (prioridad: GPS directo > geocodificación de dirección)
            double? customerLatitude = null;
            double? customerLongitude = null;
            
            // Si el cliente envió coordenadas GPS directamente, usarlas
            if (request.CustomerLatitude.HasValue && request.CustomerLongitude.HasValue)
            {
                customerLatitude = request.CustomerLatitude.Value;
                customerLongitude = request.CustomerLongitude.Value;
                
                _logger.LogInformation(
                    "Coordenadas GPS del cliente recibidas directamente: ({Lat}, {Lng})",
                    customerLatitude,
                    customerLongitude
                );
                
                // Primero validar que las coordenadas estén dentro de los límites geográficos configurados
                if (!_deliveryZoneService.IsWithinSaltoUruguay(customerLatitude.Value, customerLongitude.Value))
                {
                    var cityNameForError = businessInfo?.CityName ?? "Salto, Uruguay";
                    
                    _logger.LogWarning(
                        "Pedido rechazado - Coordenadas GPS fuera de {CityName}: ({Lat}, {Lng})",
                        cityNameForError,
                        customerLatitude,
                        customerLongitude
                    );
                    
                    return BadRequest(new 
                    { 
                        error = $"Las coordenadas GPS deben estar dentro de {cityNameForError}. Por favor, verifica tu ubicación." 
                    });
                }
                
                // Luego validar que las coordenadas estén dentro de la zona de delivery
                if (!string.IsNullOrWhiteSpace(request.CustomerAddress))
                {
                    var storeLat = _deliveryZoneService.GetStoreLatitude();
                    var storeLon = _deliveryZoneService.GetStoreLongitude();
                    
                    if (storeLat.HasValue && storeLon.HasValue)
                    {
                        var distanceKm = _deliveryZoneService.CalculateDistanceKm(
                            storeLat.Value, storeLon.Value,
                            customerLatitude.Value, customerLongitude.Value
                        );
                        
                        var maxRadius = _deliveryZoneService.GetMaxDeliveryRadiusKm();
                        if (distanceKm > maxRadius)
                        {
                            _logger.LogWarning(
                                "Pedido rechazado - Coordenadas GPS fuera de zona de delivery: ({Lat}, {Lng}). Distancia: {Distance} km, Radio máximo: {MaxRadius} km",
                                customerLatitude,
                                customerLongitude,
                                distanceKm.ToString("F2"),
                                maxRadius
                            );
                            
                            return BadRequest(new 
                            { 
                                error = $"La ubicación está fuera del área de cobertura. Distancia: {distanceKm:F2} km. Radio máximo: {maxRadius} km." 
                            });
                        }
                        
                        _logger.LogInformation(
                            "Coordenadas GPS validadas - Dentro de Salto, Uruguay y zona de delivery. Distancia: {Distance} km, Radio máximo: {MaxRadius} km",
                            distanceKm.ToString("F2"),
                            maxRadius
                        );
                    }
                }
                else
                {
                    _logger.LogInformation(
                        "Coordenadas GPS validadas - Dentro de Salto, Uruguay (sin validación de zona de delivery por falta de dirección)"
                    );
                }
            }
            // Si no hay coordenadas GPS, intentar geocodificar la dirección
            else if (!string.IsNullOrWhiteSpace(request.CustomerAddress))
            {
                var zoneValidation = await _deliveryZoneService.ValidateDeliveryZoneAsync(request.CustomerAddress);
                
                if (!zoneValidation.IsWithinZone)
                {
                    _logger.LogWarning(
                        "Pedido rechazado - Dirección fuera de zona: {Address}. Error: {Error}",
                        request.CustomerAddress,
                        zoneValidation.ErrorMessage
                    );
                    
                    return BadRequest(new 
                    { 
                        error = zoneValidation.ErrorMessage ?? "La dirección está fuera del área de cobertura" 
                    });
                }

                // Guardar las coordenadas geocodificadas del cliente
                if (zoneValidation.CustomerLatitude.HasValue && zoneValidation.CustomerLongitude.HasValue)
                {
                    customerLatitude = zoneValidation.CustomerLatitude.Value;
                    customerLongitude = zoneValidation.CustomerLongitude.Value;
                    
                    _logger.LogInformation(
                        "Coordenadas del cliente obtenidas por geocodificación: {Address} -> ({Lat}, {Lng})",
                        request.CustomerAddress,
                        customerLatitude,
                        customerLongitude
                    );
                }

                _logger.LogInformation(
                    "Pedido validado - Dirección dentro de zona: {Address}. Distancia: {Distance} km",
                    request.CustomerAddress,
                    zoneValidation.DistanceKm?.ToString("F2")
                );
            }

            // Calcular total (manejar productos gratis con precio 0)
            var total = request.Items.Sum(item => 
            {
                var price = item.Price >= 0 ? item.Price : 0; // Asegurar que el precio no sea negativo
                return price * item.Quantity;
            });

            // Calcular tiempo estimado basado en coordenadas del cliente
            // Si hay coordenadas del cliente, calcular distancia desde el negocio
            var estimatedMinutes = 30; // Por defecto
            if (customerLatitude.HasValue && customerLongitude.HasValue)
            {
                // Obtener coordenadas del negocio desde configuración
                var storeLat = _deliveryZoneService.GetStoreLatitude();
                var storeLon = _deliveryZoneService.GetStoreLongitude();
                
                // Verificar que las coordenadas del negocio estén configuradas
                if (storeLat.HasValue && storeLon.HasValue)
                {
                    var distanceKm = _deliveryZoneService.CalculateDistanceKm(
                        storeLat.Value, storeLon.Value,
                        customerLatitude.Value, customerLongitude.Value
                    );
                    
                    // Calcular tiempo: asumiendo velocidad promedio configurada
                    // Tiempo = distancia / velocidad (en horas) * 60 (a minutos)
                    // Agregar tiempo base para preparación
                    estimatedMinutes = (int)Math.Ceiling((distanceKm / AppConstants.AVERAGE_DELIVERY_SPEED_KMH) * 60) + AppConstants.PREPARATION_TIME_MINUTES;
                    
                    // Limitar entre mínimo y máximo configurados
                    estimatedMinutes = Math.Max(AppConstants.MIN_DELIVERY_TIME_MINUTES, Math.Min(AppConstants.MAX_DELIVERY_TIME_MINUTES, estimatedMinutes));
                    
                    _logger.LogInformation(
                        "Tiempo estimado calculado: {Distance} km -> {Minutes} minutos (desde negocio: {StoreLat}, {StoreLon} a cliente: {CustomerLat}, {CustomerLon})",
                        distanceKm.ToString("F2"),
                        estimatedMinutes,
                        storeLat.Value,
                        storeLon.Value,
                        customerLatitude.Value,
                        customerLongitude.Value
                    );
                }
                else
                {
                    _logger.LogWarning(
                        "No se pudo calcular tiempo estimado: coordenadas del negocio no configuradas o son 0. StoreLat: {StoreLat}, StoreLon: {StoreLon}",
                        storeLat?.ToString() ?? "null",
                        storeLon?.ToString() ?? "null"
                    );
                }
            }
            else
            {
                _logger.LogWarning(
                    $"No se pudo calcular tiempo estimado: coordenadas del cliente no disponibles. Usando tiempo por defecto de {AppConstants.DEFAULT_DELIVERY_TIME_MINUTES} minutos."
                );
            }

            // Obtener o crear cliente basado en teléfono/email
            int? customerId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out int userId))
                {
                    customerId = userId;
                    // Si el cliente está autenticado, usar sus datos por defecto
                    var customer = await _context.Customers.FindAsync(userId);
                    if (customer != null)
                    {
                        // Usar datos del cliente autenticado si no se proporcionan
                        if (string.IsNullOrEmpty(request.CustomerName))
                            request.CustomerName = customer.Name;
                        if (string.IsNullOrEmpty(request.CustomerEmail))
                            request.CustomerEmail = customer.Email;
                        if (string.IsNullOrEmpty(request.CustomerPhone))
                            request.CustomerPhone = customer.Phone;
                        if (string.IsNullOrEmpty(request.CustomerAddress) && !string.IsNullOrEmpty(customer.DefaultAddress))
                            request.CustomerAddress = customer.DefaultAddress;
                    }
                }
            }
            else
            {
                // Si no está autenticado, buscar cliente existente por teléfono o email
                // para evitar duplicados en la base de datos
                if (!string.IsNullOrWhiteSpace(request.CustomerPhone) || !string.IsNullOrWhiteSpace(request.CustomerEmail))
                {
                    Customer? existingCustomer = null;
                    
                    // Buscar por teléfono primero (más confiable)
                    if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
                    {
                        existingCustomer = await _context.Customers
                            .FirstOrDefaultAsync(c => c.Phone == request.CustomerPhone);
                    }
                    
                    // Si no se encontró por teléfono, buscar por email
                    if (existingCustomer == null && !string.IsNullOrWhiteSpace(request.CustomerEmail))
                    {
                        existingCustomer = await _context.Customers
                            .FirstOrDefaultAsync(c => c.Email == request.CustomerEmail);
                    }
                    
                    if (existingCustomer != null)
                    {
                        // Cliente existente encontrado, usar su ID
                        customerId = existingCustomer.Id;
                        
                        // Actualizar datos del cliente si hay información nueva
                        bool updated = false;
                        if (!string.IsNullOrWhiteSpace(request.CustomerName) && existingCustomer.Name != request.CustomerName)
                        {
                            existingCustomer.Name = request.CustomerName;
                            updated = true;
                        }
                        if (!string.IsNullOrWhiteSpace(request.CustomerEmail) && existingCustomer.Email != request.CustomerEmail)
                        {
                            existingCustomer.Email = request.CustomerEmail;
                            updated = true;
                        }
                        if (!string.IsNullOrWhiteSpace(request.CustomerPhone) && existingCustomer.Phone != request.CustomerPhone)
                        {
                            existingCustomer.Phone = request.CustomerPhone;
                            updated = true;
                        }
                        if (!string.IsNullOrWhiteSpace(request.CustomerAddress) && existingCustomer.DefaultAddress != request.CustomerAddress)
                        {
                            existingCustomer.DefaultAddress = request.CustomerAddress;
                            updated = true;
                        }
                        
                        if (updated)
                        {
                            existingCustomer.UpdatedAt = DateTime.UtcNow;
                            await _context.SaveChangesAsync();
                            _logger.LogInformation("Cliente {CustomerId} actualizado con nueva información", existingCustomer.Id);
                        }
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
                        
                        // Crear nuevo cliente si no existe
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
                            
                            // Si es un error de duplicado, intentar buscar el cliente existente
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
                                }
                                else
                                {
                                    throw;
                                }
                            }
                            else
                            {
                                throw;
                            }
                        }
                        
                        _logger.LogInformation(
                            "Nuevo cliente creado automáticamente: {CustomerId}, Nombre: {Name}, Teléfono: {Phone}",
                            newCustomer.Id,
                            newCustomer.Name,
                            newCustomer.Phone
                        );
                    }
                }
            }

            // Validar método de pago (case-insensitive)
            var paymentMethodName = request.PaymentMethod ?? PaymentConstants.METHOD_CASH;
            var paymentMethodNameLower = paymentMethodName.ToLower();
            var paymentMethod = await _context.PaymentMethods
                .FirstOrDefaultAsync(pm => pm.Name != null && pm.Name.ToLower() == paymentMethodNameLower && pm.IsActive);
            
            if (paymentMethod == null)
            {
                // Si el método no existe o no está activo, usar el método por defecto
                var cashMethodLower = PaymentConstants.METHOD_CASH.ToLower();
                paymentMethod = await _context.PaymentMethods
                    .FirstOrDefaultAsync(pm => pm.Name != null && pm.Name.ToLower() == cashMethodLower && pm.IsActive);
                
                if (paymentMethod == null)
                {
                    // Si ni siquiera existe cash, crear métodos por defecto
                    // Nota: EnsurePaymentMethodsExistAsync está disponible en IAdminDashboardService
                    // En su lugar, verificamos y creamos directamente aquí para evitar dependencia circular
                    if (!await _context.PaymentMethods.AnyAsync())
                    {
                        var defaultMethods = new List<PaymentMethod>
                        {
                            new PaymentMethod { Name = PaymentConstants.METHOD_CASH, DisplayName = "Efectivo", Icon = "💵", Description = "Pago al entregar", RequiresReceipt = false, IsActive = true, DisplayOrder = 1 },
                            new PaymentMethod { Name = PaymentConstants.METHOD_POS, DisplayName = "POS a domicilio", Icon = "💳", Description = "Pago con tarjeta al entregar", RequiresReceipt = false, IsActive = true, DisplayOrder = 2 },
                            new PaymentMethod { Name = PaymentConstants.METHOD_TRANSFER, DisplayName = "Transferencia", Icon = "🏦", Description = "Transferencia bancaria", RequiresReceipt = true, IsActive = true, DisplayOrder = 3 },
                        };
                        _context.PaymentMethods.AddRange(defaultMethods);
                        await _context.SaveChangesAsync();
                    }
                    paymentMethod = await _context.PaymentMethods
                        .FirstOrDefaultAsync(pm => pm.Name != null && pm.Name.ToLower() == cashMethodLower && pm.IsActive);
                }
                
                if (paymentMethod != null)
                {
                    paymentMethodName = paymentMethod.Name;
                    _logger.LogWarning("Método de pago '{RequestMethod}' no encontrado o inactivo. Usando método por defecto: {DefaultMethod}", 
                        request.PaymentMethod, paymentMethodName);
                }
            }
            else
            {
                paymentMethodName = paymentMethod.Name;
            }

            // Crear orden
            var order = new Order
            {
                CustomerId = customerId,
                CustomerName = request.CustomerName,
                CustomerPhone = request.CustomerPhone ?? string.Empty,
                CustomerAddress = request.CustomerAddress ?? string.Empty,
                CustomerEmail = request.CustomerEmail ?? string.Empty,
                CustomerLatitude = customerLatitude, // Guardar coordenadas geocodificadas
                CustomerLongitude = customerLongitude, // Guardar coordenadas geocodificadas
                Total = total,
                PaymentMethod = paymentMethodName,
                Status = OrderConstants.STATUS_PENDING,
                EstimatedDeliveryMinutes = estimatedMinutes,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                // Validar comprobante si existe
                TransferReceiptImage = !string.IsNullOrWhiteSpace(request.ReceiptImage) 
                    ? (FileValidationHelper.ValidateReceiptImage(request.ReceiptImage, AppConstants.MAX_PRODUCT_IMAGE_SIZE_BYTES).IsValid ? request.ReceiptImage : null)
                    : null,
                Comments = request.Comments, // Guardar comentarios si existen
                Items = request.Items.Select(item => 
                {
                    // Buscar el producto para obtener su categoría
                    var product = existingProducts.FirstOrDefault(p => p.Id == item.Id);
                    
                    return new OrderItem
                    {
                        ProductId = item.Id,
                        ProductName = item.Name ?? "Producto sin nombre",
                        CategoryId = product?.CategoryId,
                        CategoryName = product?.Category?.Name,
                        UnitPrice = item.Price >= 0 ? item.Price : 0, // Asegurar precio no negativo
                        Quantity = item.Quantity > 0 ? item.Quantity : 1 // Asegurar cantidad mínima de 1
                    };
                }).ToList()
            };

            // Guardar en base de datos
            _context.Orders.Add(order);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                // Capturar el inner exception para obtener más detalles
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
                
                _logger.LogError(dbEx, "Error de base de datos al crear pedido: {ErrorDetails}", errorDetails);
                
                // Verificar si es un error de restricción de clave foránea
                if (innerException != null && (
                    innerException.Message.Contains("FOREIGN KEY") ||
                    innerException.Message.Contains("The INSERT statement conflicted") ||
                    innerException.Message.Contains("Cannot insert") ||
                    innerException.Message.Contains("violates foreign key constraint")))
                {
                    return BadRequest(new { 
                        error = "Error al crear el pedido: Uno o más productos no son válidos",
                        details = innerException.Message
                    });
                }
                
                // Re-lanzar para que se capture en el catch general
                throw new Exception($"Error de base de datos: {errorDetails}", dbEx);
            }

            // Sumar punto al cliente si tiene un CustomerId asignado (autenticado o creado automáticamente)
            if (customerId.HasValue)
            {
                var customer = await _context.Customers.FindAsync(customerId.Value);
                if (customer != null)
                {
                    customer.Points += 1;
                    customer.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    _logger.LogInformation(
                        "Punto agregado al cliente {CustomerId}. Total de puntos: {Points}",
                        customerId.Value,
                        customer.Points
                    );
                }
            }
            else if (!string.IsNullOrWhiteSpace(request.CustomerPhone) || !string.IsNullOrWhiteSpace(request.CustomerEmail))
            {
                // Si no hay customerId pero hay teléfono/email, buscar el cliente que acabamos de crear
                // o que ya existía para asignarle el punto
                Customer? customerToUpdate = null;
                
                if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
                {
                    customerToUpdate = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Phone == request.CustomerPhone);
                }
                
                if (customerToUpdate == null && !string.IsNullOrWhiteSpace(request.CustomerEmail))
                {
                    customerToUpdate = await _context.Customers
                        .FirstOrDefaultAsync(c => c.Email == request.CustomerEmail);
                }
                
                if (customerToUpdate != null)
                {
                    // Actualizar el pedido con el CustomerId encontrado
                    order.CustomerId = customerToUpdate.Id;
                    await _context.SaveChangesAsync();
                    
                    // Sumar punto
                    customerToUpdate.Points += 1;
                    customerToUpdate.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    
                    _logger.LogInformation(
                        "Punto agregado al cliente {CustomerId} (encontrado por teléfono/email). Total de puntos: {Points}",
                        customerToUpdate.Id,
                        customerToUpdate.Points
                    );
                }
            }

            _logger.LogInformation(
                "Pedido creado: {OrderId}, Cliente: {CustomerName}, Total: {Total}",
                order.Id,
                order.CustomerName,
                order.Total
            );

            // Procesar pedido en segundo plano (actualizar inventario, notificaciones, etc.)
            try
            {
                await _orderProcessingService.QueueOrderProcessingAsync(order.Id);
            }
            catch (Exception ex)
            {
                // No fallar la creación del pedido si el procesamiento en segundo plano falla
                _logger.LogWarning(ex, "No se pudo encolar procesamiento en segundo plano para pedido {OrderId}", order.Id);
            }

            // Disparar webhook para evento de pedido creado
            if (_webhookService != null)
            {
                try
                {
                    await _webhookService.TriggerWebhookAsync("order.created", new
                    {
                        orderId = order.Id,
                        customerName = order.CustomerName,
                        total = order.Total,
                        status = order.Status,
                        createdAt = order.CreatedAt
                    });
                }
                catch (Exception ex)
                {
                    // No fallar la creación del pedido si el webhook falla
                    _logger.LogWarning(ex, "No se pudo disparar webhook para pedido {OrderId}", order.Id);
                }
            }

            // Publicar mensaje en cola para procesamiento asíncrono
            if (_messageQueue != null)
            {
                try
                {
                    var orderMessage = new OrderCreatedMessage
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

                    await _messageQueue.PublishAsync("orders.created", orderMessage);
                    _logger.LogInformation("Mensaje de orden creada publicado en cola para pedido {OrderId}", order.Id);
                }
                catch (Exception ex)
                {
                    // No fallar la creación del pedido si la publicación del mensaje falla
                    _logger.LogWarning(ex, "No se pudo publicar mensaje en cola para pedido {OrderId}", order.Id);
                }
            }

            // Notificar a los clientes conectados via SignalR
            try
            {
                // Recargar el pedido completo con Items desde la base de datos para asegurar que todos los datos estén incluidos
                var orderWithItems = await _context.Orders
                    .AsNoTracking()
                    .Include(o => o.Items)
                    .Include(o => o.DeliveryPerson)
                    .FirstOrDefaultAsync(o => o.Id == order.Id);
                
                if (orderWithItems != null)
                {
                    await _orderNotificationService.NotifyOrderCreated(orderWithItems);
                    _logger.LogInformation("Notificación SignalR enviada para nuevo pedido {OrderId}", order.Id);
                }
                else
                {
                    _logger.LogWarning("No se pudo recargar el pedido {OrderId} para notificación SignalR", order.Id);
                }
            }
            catch (Exception ex)
            {
                // No fallar la creación del pedido si la notificación falla
                _logger.LogWarning(ex, "No se pudo enviar notificación SignalR para pedido {OrderId}", order.Id);
            }

            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
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
            
            _logger.LogError(ex, "Error al crear pedido: {ExceptionType} - {Message}\n{StackTrace}\n{InnerException}", 
                ex.GetType().Name, 
                ex.Message, 
                ex.StackTrace,
                innerException?.ToString() ?? "No inner exception");
            
            return StatusCode(500, new { 
                error = "Error al crear el pedido", 
                details = errorMessage,
                exceptionType = ex.GetType().Name
            });
        }
    }

    /// <summary>
    /// Obtiene un pedido por ID (incluye pedidos archivados)
    /// Si el usuario está autenticado, verifica que el pedido le pertenece
    /// Si no está autenticado, permite ver el pedido (útil para pedidos sin cuenta)
    /// </summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == id);
            
        if (order == null)
        {
            _logger.LogWarning("Pedido {OrderId} no encontrado en la base de datos", id);
            return NotFound(new { error = "Pedido no encontrado", orderId = id });
        }

        // Si el usuario está autenticado, verificar que el pedido le pertenece
        if (User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (int.TryParse(userIdClaim, out int userId))
            {
                // Si el pedido tiene un CustomerId y no coincide con el usuario autenticado, rechazar
                if (order.CustomerId.HasValue && order.CustomerId.Value != userId)
                {
                    _logger.LogWarning(
                        "Intento de acceso no autorizado: Usuario {UserId} intentó ver pedido {OrderId} que pertenece a {OrderCustomerId}",
                        userId,
                        id,
                        order.CustomerId
                    );
                    return StatusCode(403, new { error = "No tienes permiso para ver este pedido" });
                }
            }
        }
        // Si no está autenticado, permitir ver el pedido (útil para pedidos sin cuenta)
        // El pedido puede tener un CustomerId creado automáticamente, pero aún así se permite verlo

        // Validar y limpiar coordenadas fuera de Salto, Uruguay
        await ValidateAndCleanOrderCoordinates(order);

        // El pedido puede estar archivado, pero aún se devuelve
        // La app del cliente puede decidir si mostrarlo o no
        _logger.LogInformation("Pedido {OrderId} obtenido. Archivado: {IsArchived}, CustomerId: {CustomerId}", 
            id, 
            order.IsArchived,
            order.CustomerId?.ToString() ?? "Ninguno");
        
        return Ok(order);
    }

    /// <summary>
    /// Obtiene todos los pedidos con paginación (útil para administración)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<Order>>> GetOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        var query = _context.Orders
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(query, normalizedPage, normalizedPageSize);
        
        // Validar y limpiar coordenadas inválidas solo en los pedidos de la página actual
        foreach (var order in pagedResponse.Data)
        {
            await ValidateAndCleanOrderCoordinates(order);
        }

        _logger.LogInformation("Obtenidos {Count} pedidos de {Total} (página {Page})", 
            pagedResponse.Data.Count, pagedResponse.TotalCount, normalizedPage);
            
        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene los pedidos del cliente autenticado con paginación
    /// </summary>
    [HttpGet("my-orders")]
    [Authorize]
    public async Task<ActionResult<PagedResponse<Order>>> GetMyOrders(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Usuario no autenticado" });
        }

        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        var query = _context.Orders
            .Include(o => o.Items)
            .Where(o => o.CustomerId == userId && !o.IsArchived)
            .OrderByDescending(o => o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(query, normalizedPage, normalizedPageSize);
        
        // Validar y limpiar coordenadas inválidas solo en los pedidos de la página actual
        foreach (var order in pagedResponse.Data)
        {
            await ValidateAndCleanOrderCoordinates(order);
        }

        _logger.LogInformation("Cliente {UserId} obtuvo {Count} pedidos de {Total} (página {Page})", 
            userId, pagedResponse.Data.Count, pagedResponse.TotalCount, normalizedPage);
            
        return Ok(pagedResponse);
    }

    /// <summary>
    /// Actualiza el estado de un pedido
    /// </summary>
    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult> UpdateOrderStatus(int id, [FromBody] UpdateOrderStatusRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound();
        }

        var previousStatus = order.Status;
        order.Status = request.Status;
        order.UpdatedAt = DateTime.UtcNow;
        
        // Registrar en historial de estados
        try
        {
            var historyEntry = new OrderStatusHistory
            {
                OrderId = order.Id,
                FromStatus = previousStatus,
                ToStatus = request.Status,
                ChangedBy = "system", // Este endpoint es público, no tiene autenticación
                Note = request.Note,
                ChangedAt = DateTime.UtcNow
            };
            _context.OrderStatusHistory.Add(historyEntry);
            _logger.LogInformation(
                "Registrando historial para pedido {OrderId}: {PreviousStatus} -> {NewStatus}",
                id,
                previousStatus,
                request.Status
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear entrada de historial para pedido {OrderId}", id);
            // Continuar aunque falle el historial, el cambio de estado es más importante
        }
        
        // Si el pedido se cancela y tiene un cliente asociado, restar el punto
        if (request.Status == OrderConstants.STATUS_CANCELLED && previousStatus != OrderConstants.STATUS_CANCELLED && order.CustomerId.HasValue)
        {
            var customer = await _context.Customers.FindAsync(order.CustomerId.Value);
            if (customer != null && customer.Points > 0)
            {
                customer.Points -= 1;
                customer.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation(
                    "Punto restado al cliente {CustomerId} por cancelación del pedido {OrderId}. Total de puntos: {Points}",
                    order.CustomerId.Value,
                    id,
                    customer.Points
                );
            }
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Estado del pedido {OrderId} actualizado a: {Status}. Historial guardado.", id, request.Status);

        // Notificar a los clientes conectados via SignalR
        try
        {
            await _orderNotificationService.NotifyOrderStatusChanged(id, request.Status);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo enviar notificación SignalR para actualización de pedido {OrderId}", id);
        }

        return Ok(order);
    }

    /// <summary>
    /// Asigna un repartidor a un pedido
    /// </summary>
    [HttpPatch("{id:int}/assign-delivery")]
    public async Task<ActionResult> AssignDeliveryPerson(int id, [FromBody] AssignDeliveryPersonRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        if (request.DeliveryPersonId.HasValue)
        {
            var deliveryPerson = await _context.DeliveryPersons
                .FirstOrDefaultAsync(d => d.Id == request.DeliveryPersonId.Value && d.IsActive);
            
            if (deliveryPerson == null)
            {
                return BadRequest(new { error = "Repartidor no encontrado o inactivo" });
            }

            order.DeliveryPersonId = request.DeliveryPersonId.Value;
        }
        else
        {
            // Desasignar repartidor
            order.DeliveryPersonId = null;
            order.DeliveryLatitude = null;
            order.DeliveryLongitude = null;
        }

        // Recalcular tiempo estimado basado en las coordenadas disponibles
        if (order.CustomerLatitude.HasValue && order.CustomerLongitude.HasValue)
        {
            double startLat, startLon;

            // Si hay coordenadas del repartidor, usar esas; si no, usar coordenadas del negocio
            if (order.DeliveryLatitude.HasValue && order.DeliveryLongitude.HasValue)
            {
                startLat = order.DeliveryLatitude.Value;
                startLon = order.DeliveryLongitude.Value;
            }
            else
            {
                var storeLat = _deliveryZoneService.GetStoreLatitude();
                var storeLon = _deliveryZoneService.GetStoreLongitude();
                
                if (storeLat.HasValue && storeLon.HasValue)
                {
                    startLat = storeLat.Value;
                    startLon = storeLon.Value;
                }
                else
                {
                    // Si no hay coordenadas del negocio, usar tiempo por defecto
                    order.EstimatedDeliveryMinutes = AppConstants.DEFAULT_DELIVERY_TIME_MINUTES;
                    order.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    
                    _logger.LogInformation(
                        $"Repartidor {{DeliveryPersonId}} asignado al pedido {{OrderId}}. Tiempo estimado: {AppConstants.DEFAULT_DELIVERY_TIME_MINUTES} minutos (coordenadas del negocio no configuradas)",
                        request.DeliveryPersonId,
                        id
                    );
                    
                    return Ok(order);
                }
            }

            var distanceKm = _deliveryZoneService.CalculateDistanceKm(
                startLat, startLon,
                order.CustomerLatitude.Value, order.CustomerLongitude.Value
            );
            
            var estimatedMinutes = (int)Math.Ceiling((distanceKm / AppConstants.AVERAGE_DELIVERY_SPEED_KMH) * 60) + AppConstants.PREPARATION_TIME_MINUTES;
            estimatedMinutes = Math.Max(AppConstants.MIN_DELIVERY_TIME_MINUTES, Math.Min(AppConstants.MAX_DELIVERY_TIME_MINUTES, estimatedMinutes));
            
            order.EstimatedDeliveryMinutes = estimatedMinutes;
            
            _logger.LogInformation(
                "Tiempo estimado recalculado para pedido {OrderId}: {Distance} km -> {Minutes} minutos",
                id,
                distanceKm.ToString("F2"),
                estimatedMinutes
            );
        }

        order.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Repartidor {DeliveryPersonId} asignado al pedido {OrderId}",
            request.DeliveryPersonId,
            id
        );

        return Ok(order);
    }

    /// <summary>
    /// Obtiene todos los repartidores activos
    /// </summary>
    [HttpGet("delivery-persons")]
    public async Task<ActionResult> GetDeliveryPersons()
    {
        var deliveryPersons = await _context.DeliveryPersons
            .Where(d => d.IsActive)
            .Select(d => new
            {
                id = d.Id,
                name = d.Name,
                phone = d.Phone,
                email = d.Email,
                username = d.Username
            })
            .ToListAsync();

        return Ok(deliveryPersons);
    }

    /// <summary>
    /// Obtiene todos los métodos de pago activos
    /// </summary>
    [HttpGet("payment-methods")]
    public async Task<ActionResult> GetPaymentMethods()
    {
        var paymentMethods = await _context.PaymentMethods
            .Where(pm => pm.IsActive)
            .OrderBy(pm => pm.DisplayOrder)
            .Select(pm => new
            {
                id = pm.Id,
                name = pm.Name,
                displayName = pm.DisplayName,
                icon = pm.Icon,
                isActive = pm.IsActive,
                bankName = pm.BankName,
                accountNumber = pm.AccountNumber,
                accountHolder = pm.AccountHolder,
                accountType = pm.AccountType,
                accountAlias = pm.AccountAlias
            })
            .ToListAsync();

        return Ok(paymentMethods);
    }

    /// <summary>
    /// Actualiza el tiempo estimado de entrega de un pedido
    /// </summary>
    [HttpPatch("{id:int}/estimated-time")]
    public async Task<ActionResult> UpdateEstimatedDeliveryTime(int id, [FromBody] UpdateEstimatedTimeRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        if (request.Minutes < 1 || request.Minutes > 120)
        {
            return BadRequest(new { error = "El tiempo estimado debe estar entre 1 y 120 minutos" });
        }

        order.EstimatedDeliveryMinutes = request.Minutes;
        order.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Tiempo estimado del pedido {OrderId} actualizado a: {Minutes} minutos", id, request.Minutes);

        return Ok(order);
    }


    /// <summary>
    /// Archiva un pedido (soft delete - mantiene historial)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> ArchiveOrder(int id)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == id);
            
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            // Archivar el pedido en lugar de eliminarlo
            order.IsArchived = true;
            order.ArchivedAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Pedido archivado: {OrderId}", id);
            
            return Ok(new { 
                success = true,
                message = "Pedido archivado correctamente",
                orderId = id,
                archivedAt = order.ArchivedAt 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al archivar pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al archivar el pedido", details = ex.Message });
        }
    }

    /// <summary>
    /// Restaura un pedido archivado
    /// </summary>
    [HttpPatch("{id:int}/restore")]
    public async Task<ActionResult> RestoreOrder(int id)
    {
        try
        {
            var order = await _context.Orders.FindAsync(id);
            
            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            order.IsArchived = false;
            order.ArchivedAt = null;
            order.UpdatedAt = DateTime.UtcNow;
            
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Pedido restaurado: {OrderId}", id);
            
            return Ok(new { message = "Pedido restaurado correctamente", order });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al restaurar pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al restaurar el pedido", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza la ubicación del repartidor para un pedido
    /// </summary>
    [HttpPatch("{id:int}/delivery-location")]
    public async Task<ActionResult> UpdateDeliveryLocation(int id, [FromBody] UpdateDeliveryLocationRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        // Validar coordenadas
        if (request.Latitude < -90 || request.Latitude > 90)
        {
            return BadRequest(new { error = "Latitud inválida" });
        }
        if (request.Longitude < -180 || request.Longitude > 180)
        {
            return BadRequest(new { error = "Longitud inválida" });
        }

        // Validar que las coordenadas estén dentro de los límites geográficos configurados
        var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
        var cityName = businessInfo?.CityName ?? "Salto, Uruguay";
        
        if (!_deliveryZoneService.IsWithinSaltoUruguay(request.Latitude, request.Longitude))
        {
            _logger.LogWarning(
                "Intento de actualizar ubicación del repartidor fuera de {CityName}: ({Lat}, {Lng}) para pedido {OrderId}",
                cityName,
                request.Latitude,
                request.Longitude,
                id
            );
            
            return BadRequest(new 
            { 
                error = $"Las coordenadas del repartidor deben estar dentro de {cityName}. Por favor, verifica tu ubicación." 
            });
        }

        order.DeliveryLatitude = request.Latitude;
        order.DeliveryLongitude = request.Longitude;
        order.DeliveryLocationUpdatedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;
        
        // Recalcular tiempo estimado si hay coordenadas del cliente
        if (order.CustomerLatitude.HasValue && order.CustomerLongitude.HasValue)
        {
            var distanceKm = _deliveryZoneService.CalculateDistanceKm(
                request.Latitude, request.Longitude,
                order.CustomerLatitude.Value, order.CustomerLongitude.Value
            );
            
            // Calcular tiempo: velocidad promedio configurada + tiempo base de preparación
            var estimatedMinutes = (int)Math.Ceiling((distanceKm / AppConstants.AVERAGE_DELIVERY_SPEED_KMH) * 60) + AppConstants.PREPARATION_TIME_MINUTES;
            estimatedMinutes = Math.Max(AppConstants.MIN_DELIVERY_TIME_MINUTES, Math.Min(AppConstants.MAX_DELIVERY_TIME_MINUTES, estimatedMinutes));
            
            order.EstimatedDeliveryMinutes = estimatedMinutes;
            
            _logger.LogInformation(
                "Tiempo estimado recalculado para pedido {OrderId}: {Distance} km -> {Minutes} minutos",
                id,
                distanceKm.ToString("F2"),
                estimatedMinutes
            );
        }
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation(
            "Ubicación del repartidor actualizada para pedido {OrderId}: Lat={Latitude}, Lng={Longitude}",
            id,
            request.Latitude,
            request.Longitude
        );

        return Ok(new
        {
            success = true,
            orderId = id,
            deliveryLocation = new
            {
                latitude = order.DeliveryLatitude,
                longitude = order.DeliveryLongitude,
                updatedAt = order.DeliveryLocationUpdatedAt
            }
        });
    }

    /// <summary>
    /// Actualiza la ubicación del cliente para calcular la ruta
    /// Permite actualización sin autenticación para pedidos sin cuenta
    /// </summary>
    [HttpPatch("{id:int}/customer-location")]
    public async Task<ActionResult> UpdateCustomerLocation(int id, [FromBody] UpdateCustomerLocationRequest request)
    {
        var order = await _context.Orders.FindAsync(id);
        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado" });
        }

        // Si el usuario está autenticado, verificar que el pedido le pertenece
        if (User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out int userId))
            {
                // Si el pedido tiene un CustomerId y no coincide con el usuario autenticado, rechazar
                if (order.CustomerId.HasValue && order.CustomerId.Value != userId)
                {
                    _logger.LogWarning(
                        "Intento de actualizar ubicación de cliente: Pedido {OrderId} no pertenece al usuario {UserId}. CustomerId del pedido: {OrderCustomerId}",
                        id,
                        userId,
                        order.CustomerId
                    );
                    return StatusCode(403, new { error = "No tienes permiso para actualizar este pedido" });
                }
            }
        }
        // Si no está autenticado, permitir actualización solo si el pedido no tiene CustomerId asignado
        // (pedidos sin cuenta)
        else if (order.CustomerId.HasValue)
        {
            _logger.LogWarning(
                "Intento de actualizar ubicación sin autenticación para pedido {OrderId} con CustomerId {CustomerId}",
                id,
                order.CustomerId
            );
            // Permitir actualización incluso si hay CustomerId, ya que puede ser un pedido sin cuenta
            // que fue creado automáticamente
        }

        // Validar coordenadas
        if (request.Latitude < -90 || request.Latitude > 90)
        {
            return BadRequest(new { error = "Latitud inválida" });
        }
        if (request.Longitude < -180 || request.Longitude > 180)
        {
            return BadRequest(new { error = "Longitud inválida" });
        }

        order.CustomerLatitude = request.Latitude;
        order.CustomerLongitude = request.Longitude;
        order.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        _logger.LogInformation(
            "Ubicación del cliente actualizada para pedido {OrderId}: Lat={Latitude}, Lng={Longitude}",
            id,
            request.Latitude,
            request.Longitude
        );

        return Ok(new
        {
            success = true,
            orderId = id,
            customerLocation = new
            {
                latitude = order.CustomerLatitude,
                longitude = order.CustomerLongitude
            }
        });
    }

    /// <summary>
    /// Elimina permanentemente un pedido (solo si está archivado)
    /// </summary>
    [HttpDelete("{id:int}/permanent")]
    public async Task<ActionResult> DeleteOrderPermanently(int id)
    {
        try
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
                return BadRequest(new { error = "No se puede eliminar permanentemente un pedido activo. Debe archivarlo primero." });
            }

            // Eliminar el pedido (los items se eliminarán automáticamente por cascada)
            _context.Orders.Remove(order);
            await _context.SaveChangesAsync();
            
            _logger.LogWarning("Pedido eliminado permanentemente: {OrderId}", id);
            
            return Ok(new { 
                success = true,
                message = "Pedido eliminado permanentemente",
                orderId = id
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar permanentemente el pedido {OrderId}", id);
            return StatusCode(500, new { error = "Error al eliminar el pedido", details = ex.Message });
        }
    }
}





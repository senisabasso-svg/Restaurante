using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;
using CornerApp.API.Constants;
using CornerApp.API.Hubs;
using BCrypt.Net;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Tags("Repartidores")]
public class DeliveryPersonController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeliveryPersonController> _logger;
    private readonly IDeliveryZoneService _deliveryZoneService;
    private readonly IOrderNotificationService _orderNotificationService;
    private readonly IEmailService _emailService;

    public DeliveryPersonController(
        ApplicationDbContext context, 
        IConfiguration configuration,
        ILogger<DeliveryPersonController> logger,
        IDeliveryZoneService deliveryZoneService,
        IOrderNotificationService orderNotificationService,
        IEmailService emailService)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
        _deliveryZoneService = deliveryZoneService;
        _orderNotificationService = orderNotificationService;
        _emailService = emailService;
    }

    /// <summary>
    /// Valida y limpia coordenadas fuera de Salto, Uruguay en un pedido
    /// </summary>
    private async Task<bool> ValidateAndCleanOrderCoordinates(Order order)
    {
        bool coordinatesCleaned = false;
        
        // Validar coordenadas del repartidor
        if (order.DeliveryLatitude.HasValue && order.DeliveryLongitude.HasValue)
        {
            var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
            var cityName = businessInfo?.CityName ?? "Salto, Uruguay";
            
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
            var businessInfo = await _context.BusinessInfo.FirstOrDefaultAsync();
            var cityName = businessInfo?.CityName ?? "Salto, Uruguay";
            
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
    /// Login para repartidores
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] DeliveryPersonLoginRequest? request)
    {
        // Validar ModelState (validación automática de [ApiController])
        if (!ModelState.IsValid)
        {
            var errors = ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .SelectMany(x => x.Value!.Errors.Select(e => $"{x.Key}: {e.ErrorMessage}"))
                .ToList();
            
            _logger.LogWarning("Intento de login con modelo inválido. Errores: {Errors}", string.Join(", ", errors));
            return BadRequest(new { error = "Datos inválidos", details = errors });
        }

        if (request == null)
        {
            _logger.LogWarning("Intento de login con request body nulo");
            return BadRequest(new { error = "El cuerpo de la solicitud es requerido" });
        }

        // Validar y sanitizar entrada
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            _logger.LogWarning("Intento de login con campos vacíos. Username: {HasUsername}, Password: {HasPassword}", 
                !string.IsNullOrWhiteSpace(request.Username), 
                !string.IsNullOrWhiteSpace(request.Password));
            return BadRequest(new { error = "Usuario y contraseña son requeridos" });
        }

        // Sanitizar username: eliminar espacios y limitar longitud
        var username = request.Username.Trim();
        if (username.Length > 100)
        {
            _logger.LogWarning("Intento de login con username demasiado largo: {Length} caracteres", username.Length);
            return BadRequest(new { error = "El nombre de usuario es inválido" });
        }

        // Validar longitud mínima de contraseña
        if (request.Password.Length < 1)
        {
            _logger.LogWarning("Intento de login con contraseña vacía");
            return BadRequest(new { error = "La contraseña es requerida" });
        }

        // EF Core no puede traducir StringComparison.OrdinalIgnoreCase a SQL
        // Usar ToLower() en ambos lados para comparación case-insensitive que EF Core puede traducir
        var usernameLower = username.ToLower();
        
        // Buscar el usuario - cargar y comparar en memoria para manejar espacios correctamente
        // Esto es necesario porque EF Core no puede traducir Trim() a SQL
        var allActivePersons = await _context.DeliveryPersons
            .Where(d => d.Username != null && d.IsActive)
            .ToListAsync();
        
        var matchedPerson = allActivePersons
            .FirstOrDefault(d => d.Username != null && 
                                 d.Username.Trim().ToLower() == usernameLower);

        if (matchedPerson == null)
        {
            // Log más detallado para debugging
            var allUsernames = allActivePersons
                .Select(d => new { d.Username, d.IsActive, d.Id })
                .ToList();
            
            _logger.LogWarning(
                "Intento de login con usuario no encontrado. Username buscado: '{Username}' (normalizado: '{UsernameLower}'). " +
                "Usuarios activos existentes: {ExistingUsernames}",
                request.Username, 
                usernameLower,
                string.Join(", ", allUsernames.Select(u => $"Id:{u.Id} User:'{u.Username}' Active:{u.IsActive}"))
            );
            return Unauthorized(new { error = "Usuario o contraseña incorrectos" });
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, matchedPerson.PasswordHash))
        {
            _logger.LogWarning("Intento de login con contraseña incorrecta para usuario: {Username}", request.Username);
            return Unauthorized(new { error = "Usuario o contraseña incorrectos" });
        }

        var token = GenerateJwtToken(matchedPerson);
        
        _logger.LogInformation("Repartidor {DeliveryPersonId} ({Username}) inició sesión", matchedPerson.Id, matchedPerson.Username);

        return Ok(new
        {
            token,
            deliveryPerson = new
            {
                id = matchedPerson.Id,
                name = matchedPerson.Name,
                email = matchedPerson.Email,
                phone = matchedPerson.Phone,
                username = matchedPerson.Username
            }
        });
    }

    /// <summary>
    /// Verificar token y obtener información del repartidor
    /// </summary>
    [HttpPost("verify")]
    [Authorize]
    public async Task<IActionResult> VerifyToken()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == userId && d.IsActive);
        
        if (deliveryPerson == null)
        {
            return Unauthorized(new { error = "Repartidor no encontrado o inactivo" });
        }

        return Ok(new
        {
            deliveryPerson = new
            {
                id = deliveryPerson.Id,
                name = deliveryPerson.Name,
                email = deliveryPerson.Email,
                phone = deliveryPerson.Phone,
                username = deliveryPerson.Username
            }
        });
    }

    /// <summary>
    /// Obtener pedidos asignados al repartidor autenticado
    /// </summary>
    [HttpGet("orders")]
    [Authorize]
    public async Task<IActionResult> GetMyOrders()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var orders = await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.DeliveryPersonId == userId && !o.IsArchived)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        // Validar y limpiar coordenadas inválidas en todos los pedidos
        foreach (var order in orders)
        {
            await ValidateAndCleanOrderCoordinates(order);
        }

        return Ok(orders);
    }

    /// <summary>
    /// Obtener un pedido específico asignado al repartidor
    /// </summary>
    [HttpGet("orders/{orderId}")]
    [Authorize]
    public async Task<IActionResult> GetOrder(int orderId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeliveryPersonId == userId);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado o no asignado a este repartidor" });
        }

        // Validar y limpiar coordenadas inválidas
        await ValidateAndCleanOrderCoordinates(order);

        return Ok(order);
    }

    /// <summary>
    /// Actualizar ubicación del repartidor para un pedido
    /// </summary>
    [HttpPatch("orders/{orderId}/location")]
    [Authorize]
    public async Task<IActionResult> UpdateLocation(int orderId, [FromBody] UpdateLocationRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            _logger.LogWarning("Intento de actualizar ubicación sin token válido para pedido {OrderId}", orderId);
            return Unauthorized(new { error = "Token inválido o expirado. Por favor inicia sesión nuevamente." });
        }

        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null)
        {
            _logger.LogWarning("Intento de actualizar ubicación para pedido inexistente {OrderId} por repartidor {DeliveryPersonId}", orderId, userId);
            return NotFound(new { error = "Pedido no encontrado" });
        }

        // Verificar que el pedido esté asignado a este repartidor
        if (!order.DeliveryPersonId.HasValue || order.DeliveryPersonId.Value != userId)
        {
            _logger.LogWarning(
                "Intento de actualizar ubicación: Pedido {OrderId} no está asignado al repartidor {DeliveryPersonId}. Asignado a: {AssignedTo}",
                orderId,
                userId,
                order.DeliveryPersonId?.ToString() ?? "Ninguno"
            );
            return Unauthorized(new { error = "Este pedido no está asignado a ti. Asigna el pedido primero desde el dashboard." });
        }

        if (request.Latitude < -90 || request.Latitude > 90)
        {
            return BadRequest(new { error = "Latitud inválida" });
        }
        if (request.Longitude < -180 || request.Longitude > 180)
        {
            return BadRequest(new { error = "Longitud inválida" });
        }

        // Validar que las coordenadas estén dentro de Salto, Uruguay
        if (!_deliveryZoneService.IsWithinSaltoUruguay(request.Latitude, request.Longitude))
        {
            _logger.LogWarning(
                "Intento de actualizar ubicación del repartidor fuera de Salto, Uruguay: ({Lat}, {Lng}) para pedido {OrderId} por repartidor {DeliveryPersonId}",
                request.Latitude,
                request.Longitude,
                orderId,
                userId
            );
            
            return BadRequest(new 
            { 
                error = "Las coordenadas del repartidor deben estar dentro de Salto, Uruguay. Por favor, verifica tu ubicación." 
            });
        }

        order.DeliveryLatitude = request.Latitude;
        order.DeliveryLongitude = request.Longitude;
        order.DeliveryLocationUpdatedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Repartidor {DeliveryPersonId} actualizó ubicación para pedido {OrderId}: Lat={Latitude}, Lng={Longitude}",
            userId,
            orderId,
            request.Latitude,
            request.Longitude
        );

        return Ok(new
        {
            success = true,
            orderId = orderId,
            deliveryLocation = new
            {
                latitude = order.DeliveryLatitude,
                longitude = order.DeliveryLongitude,
                updatedAt = order.DeliveryLocationUpdatedAt
            }
        });
    }

    /// <summary>
    /// Actualizar estado del pedido (solo para estados permitidos)
    /// </summary>
    [HttpPatch("orders/{orderId}/status")]
    [Authorize]
    public async Task<IActionResult> UpdateOrderStatus(int orderId, [FromBody] UpdateDeliveryOrderStatusRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var order = await _context.Orders
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeliveryPersonId == userId);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado o no asignado a este repartidor" });
        }

        // Permitir cambiar a estados de entrega o cancelar
        var allowedStatuses = new[] { OrderConstants.STATUS_DELIVERING, OrderConstants.STATUS_COMPLETED, OrderConstants.STATUS_CANCELLED };
        if (!allowedStatuses.Contains(request.Status))
        {
            return BadRequest(new { error = $"Solo se puede cambiar a: {string.Join(", ", allowedStatuses)}" });
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
                ChangedBy = $"delivery-{userId}",
                Note = $"Cambio de estado por repartidor",
                ChangedAt = DateTime.UtcNow
            };
            _context.OrderStatusHistory.Add(historyEntry);
            _logger.LogInformation(
                "Registrando historial para pedido {OrderId}: {PreviousStatus} -> {NewStatus}",
                orderId,
                previousStatus,
                request.Status
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear entrada de historial para pedido {OrderId}", orderId);
            // Continuar aunque falle el historial, el cambio de estado es más importante
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Repartidor {DeliveryPersonId} cambió estado del pedido {OrderId} de {PreviousStatus} a {NewStatus}. Historial guardado.",
            userId,
            orderId,
            previousStatus,
            request.Status
        );

        // Notificar a los clientes conectados via SignalR
        try
        {
            // Recargar el pedido completo con Items y DeliveryPerson para enviarlo completo
            var orderWithDetails = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Items)
                .Include(o => o.DeliveryPerson)
                .FirstOrDefaultAsync(o => o.Id == orderId);
            
            if (orderWithDetails != null)
            {
                await _orderNotificationService.NotifyOrderUpdated(orderWithDetails);
                await _orderNotificationService.NotifyOrderStatusChanged(orderId, request.Status);
                
                // Enviar recibo por email si el pedido se completó
                if (request.Status == OrderConstants.STATUS_COMPLETED)
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _emailService.SendOrderReceiptAsync(orderWithDetails);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error al enviar recibo por email para el pedido {OrderId}", orderId);
                        }
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo enviar notificación SignalR para actualización de pedido {OrderId}", orderId);
        }

        return Ok(order);
    }

    /// <summary>
    /// Elimina permanentemente un pedido completado (solo si está completado y asignado al repartidor)
    /// </summary>
    [HttpDelete("orders/{orderId}")]
    [Authorize]
    public async Task<IActionResult> DeleteOrder(int orderId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Token inválido" });
        }

        var order = await _context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId && o.DeliveryPersonId == userId);

        if (order == null)
        {
            return NotFound(new { error = "Pedido no encontrado o no asignado a este repartidor" });
        }

        // Solo permitir eliminar pedidos completados
        if (order.Status != OrderConstants.STATUS_COMPLETED)
        {
            return BadRequest(new { error = "Solo se pueden eliminar pedidos completados" });
        }

        try
        {
            // Eliminar el pedido (los items se eliminarán automáticamente por cascade delete)
            _context.Orders.Remove(order);
            
            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Repartidor {DeliveryPersonId} eliminó permanentemente el pedido {OrderId}",
                userId,
                orderId
            );

            return Ok(new { success = true, message = "Pedido eliminado permanentemente" });
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "Error eliminando pedido {OrderId}", orderId);
            return StatusCode(500, new { error = "Error al eliminar el pedido. Puede tener dependencias." });
        }
    }

    private string GenerateJwtToken(DeliveryPerson deliveryPerson)
    {
        // Prioridad: Variable de entorno > appsettings.json > valor por defecto (solo desarrollo)
        var jwtKey = _configuration["JWT_SECRET_KEY"] 
            ?? _configuration["Jwt:Key"] 
            ?? (_configuration.GetValue<string>("ASPNETCORE_ENVIRONMENT") == "Development"
                ? "your-secret-key-that-is-at-least-32-characters-long-for-security-development-only"
                : throw new InvalidOperationException("JWT Secret Key no configurado"));

        var jwtIssuer = _configuration["JWT_ISSUER"] 
            ?? _configuration["Jwt:Issuer"] 
            ?? "CornerApp";

        var jwtAudience = _configuration["JWT_AUDIENCE"] 
            ?? _configuration["Jwt:Audience"] 
            ?? "CornerApp";

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, deliveryPerson.Id.ToString()),
            new Claim(ClaimTypes.Name, deliveryPerson.Name),
            new Claim("role", "DeliveryPerson"),
            new Claim("username", deliveryPerson.Username)
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}



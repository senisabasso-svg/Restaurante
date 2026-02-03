using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Constants;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de repartidores en administración
/// </summary>
[ApiController]
[Route("admin/api/delivery-persons")]
[Tags("Administración - Repartidores")]
[Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden ver repartidores
public class AdminDeliveryPersonsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminDeliveryPersonsController> _logger;

    public AdminDeliveryPersonsController(
        ApplicationDbContext context,
        ILogger<AdminDeliveryPersonsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los repartidores (activos e inactivos) del restaurante del usuario
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAllDeliveryPersons()
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPersons = await _context.DeliveryPersons
            .Where(d => d.RestaurantId == restaurantId)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Phone,
                d.Email,
                d.Username,
                d.IsActive,
                d.CreatedAt,
                d.UpdatedAt,
                ActiveOrders = d.Orders
                    .Where(o => !o.IsArchived && 
                               o.Status != OrderConstants.STATUS_COMPLETED && 
                               o.Status != OrderConstants.STATUS_CANCELLED)
                    .Select(o => new {
                        id = o.Id,
                        customerName = o.CustomerName,
                        customerAddress = o.CustomerAddress,
                        status = o.Status,
                        total = o.Total,
                        createdAt = o.CreatedAt,
                        assignedAt = (o.StatusHistory
                            .Where(h => h.ToStatus == OrderConstants.STATUS_DELIVERING)
                            .OrderByDescending(h => h.ChangedAt)
                            .Select(h => (DateTime?)h.ChangedAt)
                            .FirstOrDefault() ?? o.UpdatedAt ?? o.CreatedAt).ToString("yyyy-MM-ddTHH:mm:ssZ")
                    })
                    .OrderByDescending(o => o.createdAt)
                    .ToList()
            })
            .OrderByDescending(d => d.IsActive)
            .ThenBy(d => d.Name)
            .ToListAsync();

        return Ok(deliveryPersons);
    }

    /// <summary>
    /// Obtiene un repartidor por ID (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetDeliveryPerson(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .Where(d => d.Id == id && d.RestaurantId == restaurantId)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.Phone,
                d.Email,
                d.Username,
                d.IsActive,
                d.CreatedAt,
                d.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado" });
        }

        return Ok(deliveryPerson);
    }

    /// <summary>
    /// Crea un nuevo repartidor
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateDeliveryPerson([FromBody] CreateDeliveryPersonRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Username) || 
                string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { error = "Nombre, usuario y contraseña son requeridos" });
            }

            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            // Verificar si el username ya existe en el mismo restaurante (comparación case-insensitive)
            var usernameLower = request.Username.Trim().ToLower();
            var existingByUsername = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.RestaurantId == restaurantId && 
                                         d.Username != null && 
                                         d.Username.ToLower() == usernameLower);
            if (existingByUsername != null)
            {
                return BadRequest(new { error = "Este usuario ya existe en tu restaurante" });
            }

            // Verificar si el email ya existe en el mismo restaurante (comparación case-insensitive)
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var emailLower = request.Email.Trim().ToLower();
                var existingByEmail = await _context.DeliveryPersons
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.RestaurantId == restaurantId && 
                                             d.Email != null && 
                                             d.Email.ToLower() == emailLower);
                if (existingByEmail != null)
                {
                    return BadRequest(new { error = "Este email ya está registrado en tu restaurante" });
                }
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            var deliveryPerson = new DeliveryPerson
            {
                RestaurantId = restaurantId,
                Name = request.Name?.Trim() ?? string.Empty,
                Phone = request.Phone?.Trim() ?? string.Empty,
                Email = !string.IsNullOrWhiteSpace(request.Email) ? request.Email.Trim().ToLower() : null,
                Username = request.Username.Trim().ToLower(),
                PasswordHash = passwordHash,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.DeliveryPersons.Add(deliveryPerson);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Repartidor creado: {DeliveryPersonId} - {Name}", deliveryPerson.Id, deliveryPerson.Name);

            return Ok(new
            {
                id = deliveryPerson.Id,
                name = deliveryPerson.Name,
                phone = deliveryPerson.Phone,
                email = deliveryPerson.Email,
                username = deliveryPerson.Username,
                isActive = deliveryPerson.IsActive
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear repartidor");
            return StatusCode(500, new { error = "Error interno del servidor" });
        }
    }

    /// <summary>
    /// Actualiza un repartidor
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateDeliveryPerson(int id, [FromBody] UpdateDeliveryPersonRequest request)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId);
        
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado o no pertenece a tu restaurante" });
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            deliveryPerson.Name = request.Name;
        }
        if (request.Phone != null)
        {
            deliveryPerson.Phone = request.Phone;
        }
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.ToLower();
            var existingByEmail = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Email != null && d.Email.ToLower() == emailLower && d.Id != id);
            if (existingByEmail != null)
            {
                return BadRequest(new { error = "Este email ya está registrado" });
            }
            deliveryPerson.Email = request.Email.ToLower();
        }
        else
        {
            deliveryPerson.Email = null;
        }
        if (!string.IsNullOrWhiteSpace(request.Username))
        {
            var usernameLower = request.Username.ToLower();
            var existingByUsername = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Username != null && d.Username.ToLower() == usernameLower && d.Id != id);
            if (existingByUsername != null)
            {
                return BadRequest(new { error = "Este usuario ya existe" });
            }
            deliveryPerson.Username = request.Username.ToLower();
        }
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            deliveryPerson.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
        }
        if (request.IsActive.HasValue)
        {
            deliveryPerson.IsActive = request.IsActive.Value;
        }

        deliveryPerson.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Repartidor actualizado: {DeliveryPersonId}", deliveryPerson.Id);

        return Ok(new
        {
            id = deliveryPerson.Id,
            name = deliveryPerson.Name,
            phone = deliveryPerson.Phone,
            email = deliveryPerson.Email,
            username = deliveryPerson.Username,
            isActive = deliveryPerson.IsActive
        });
    }

    /// <summary>
    /// Elimina o desactiva un repartidor
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteDeliveryPerson(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId);
        
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado o no pertenece a tu restaurante" });
        }

        // Verificar si tiene pedidos asignados del mismo restaurante
        var hasOrders = await _context.Orders
            .AsNoTracking()
            .AnyAsync(o => o.DeliveryPersonId == id && 
                         o.RestaurantId == restaurantId &&
                         !o.IsArchived && 
                         o.Status != OrderConstants.STATUS_COMPLETED && 
                         o.Status != OrderConstants.STATUS_CANCELLED);
        
        if (hasOrders)
        {
            deliveryPerson.IsActive = false;
            deliveryPerson.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Repartidor desactivado: {DeliveryPersonId}", deliveryPerson.Id);
            return Ok(new { message = "Repartidor desactivado (tiene pedidos activos)", isActive = false });
        }

        _context.DeliveryPersons.Remove(deliveryPerson);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Repartidor eliminado: {DeliveryPersonId}", deliveryPerson.Id);

        return Ok(new { message = "Repartidor eliminado correctamente" });
    }

    /// <summary>
    /// Obtiene estadísticas de repartidores
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var total = await _context.DeliveryPersons.CountAsync(d => d.RestaurantId == restaurantId);
        var active = await _context.DeliveryPersons.CountAsync(d => d.RestaurantId == restaurantId && d.IsActive);
        
        var activeOrdersByPerson = await _context.Orders
            .Where(o => o.RestaurantId == restaurantId &&
                       o.DeliveryPersonId.HasValue && !o.IsArchived && 
                       o.Status != OrderConstants.STATUS_COMPLETED && 
                       o.Status != OrderConstants.STATUS_CANCELLED)
            .GroupBy(o => o.DeliveryPersonId)
            .Select(g => new { DeliveryPersonId = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new
        {
            total,
            active,
            inactive = total - active,
            activeOrdersByPerson
        });
    }

    /// <summary>
    /// Obtiene el estado de la caja de un repartidor (para admin)
    /// </summary>
    [HttpGet("{id}/cash-register/status")]
    public async Task<ActionResult> GetDeliveryPersonCashRegisterStatus(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId);
        
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado o no pertenece a tu restaurante" });
        }

        var openCashRegister = await _context.DeliveryCashRegisters
            .Include(dcr => dcr.DeliveryPerson)
            .Where(c => c.DeliveryPersonId == id && c.RestaurantId == restaurantId && c.IsOpen)
            .OrderByDescending(c => c.OpenedAt)
            .FirstOrDefaultAsync();

        if (openCashRegister == null)
        {
            return Ok(new { isOpen = false, cashRegister = (object?)null });
        }

        // Obtener pedidos asignados a este repartidor durante esta sesión
        var orders = await _context.Orders
            .Where(o => o.DeliveryPersonId == id
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
                initialAmount = openCashRegister.InitialAmount,
                activeOrders = activeOrders,
                completedOrders = completedOrders,
                totalOrders = orders.Count
            }
        });
    }

    /// <summary>
    /// Abre la caja de un repartidor (para admin)
    /// </summary>
    [HttpPost("{id}/cash-register/open")]
    public async Task<ActionResult> OpenDeliveryPersonCashRegister(int id, [FromBody] OpenDeliveryCashRegisterRequest? request)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId && d.IsActive);

        if (deliveryPerson == null)
        {
            return BadRequest(new { error = "Repartidor no encontrado, inactivo o no pertenece a tu restaurante" });
        }

        if (request == null || request.InitialAmount < 0)
        {
            return BadRequest(new { error = "El monto inicial es requerido y debe ser mayor o igual a 0" });
        }

        // Verificar que no haya una caja abierta para este repartidor (del mismo restaurante)
        var existingOpenCashRegister = await _context.DeliveryCashRegisters
            .Where(c => c.DeliveryPersonId == id && c.RestaurantId == restaurantId && c.IsOpen)
            .FirstOrDefaultAsync();

        if (existingOpenCashRegister != null)
        {
            return BadRequest(new { error = "Este repartidor ya tiene una caja abierta" });
        }

        var cashRegister = new DeliveryCashRegister
        {
            RestaurantId = restaurantId, // Asignar RestaurantId
            DeliveryPersonId = id,
            OpenedAt = DateTime.UtcNow,
            IsOpen = true,
            InitialAmount = request.InitialAmount,
            CreatedAt = DateTime.UtcNow
        };

        _context.DeliveryCashRegisters.Add(cashRegister);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Caja de repartidor abierta por admin: ID {CashRegisterId}, Repartidor: {DeliveryPersonId} ({Name}), Monto inicial: {InitialAmount}",
            cashRegister.Id, id, deliveryPerson.Name, request.InitialAmount);

        return Ok(cashRegister);
    }

    /// <summary>
    /// Cierra la caja de un repartidor (para admin)
    /// </summary>
    [HttpPost("{id}/cash-register/close")]
    public async Task<ActionResult> CloseDeliveryPersonCashRegister(int id, [FromBody] CloseDeliveryCashRegisterRequest? request)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId);
        
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado o no pertenece a tu restaurante" });
        }

        // Obtener la caja abierta de este repartidor (del mismo restaurante)
        var cashRegister = await _context.DeliveryCashRegisters
            .Where(c => c.DeliveryPersonId == id && c.RestaurantId == restaurantId && c.IsOpen)
            .OrderByDescending(c => c.OpenedAt)
            .FirstOrDefaultAsync();

        if (cashRegister == null)
        {
            return BadRequest(new { error = "Este repartidor no tiene una caja abierta" });
        }

        // Verificar que no haya pedidos activos asignados a este repartidor
        var pendingOrders = await _context.Orders
            .Where(o => o.DeliveryPersonId == id
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
                error = "No se puede cerrar la caja porque este repartidor tiene pedidos activos asignados",
                pendingOrders = pendingOrders.Count
            });
        }

        // Obtener todos los pedidos completados de esta sesión de caja
        var orders = await _context.Orders
            .Include(o => o.Items)
            .Where(o => o.DeliveryPersonId == id
                && o.CreatedAt >= cashRegister.OpenedAt
                && o.Status == OrderConstants.STATUS_COMPLETED
                && !o.IsArchived)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();

        // Calcular totales
        var totalSales = orders.Sum(o => o.Total);
        var totalCash = orders.Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
            .Sum(o => o.Total);
        var totalPOS = orders.Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_POS.ToLower())
            .Sum(o => o.Total);
        var totalTransfer = orders.Where(o => o.PaymentMethod?.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
            .Sum(o => o.Total);

        // Calcular monto final (inicial + ventas en efectivo)
        var finalAmount = cashRegister.InitialAmount + totalCash;

        // Actualizar caja
        cashRegister.ClosedAt = DateTime.UtcNow;
        cashRegister.IsOpen = false;
        cashRegister.FinalAmount = finalAmount;
        cashRegister.TotalSales = totalSales;
        cashRegister.TotalCash = totalCash;
        cashRegister.TotalPOS = totalPOS;
        cashRegister.TotalTransfer = totalTransfer;
        cashRegister.Notes = request?.Notes;
        cashRegister.UpdatedAt = DateTime.UtcNow;

        _context.DeliveryCashRegisters.Update(cashRegister);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Caja de repartidor cerrada por admin: ID {CashRegisterId}, Repartidor: {DeliveryPersonId}, Total ventas: {TotalSales}",
            cashRegister.Id, id, totalSales);

        // Preparar movimientos para la respuesta
        var movements = orders.Select(o => new
        {
            id = o.Id,
            customerName = o.CustomerName,
            customerPhone = o.CustomerPhone,
            customerAddress = o.CustomerAddress,
            total = o.Total,
            paymentMethod = o.PaymentMethod,
            status = o.Status,
            createdAt = o.CreatedAt,
            items = o.Items.Select(i => new
            {
                productName = i.ProductName,
                quantity = i.Quantity,
                unitPrice = i.UnitPrice,
                subtotal = i.Subtotal
            }).ToList()
        }).ToList();

        return Ok(new
        {
            cashRegister = new
            {
                id = cashRegister.Id,
                deliveryPersonId = cashRegister.DeliveryPersonId,
                openedAt = cashRegister.OpenedAt,
                closedAt = cashRegister.ClosedAt,
                initialAmount = cashRegister.InitialAmount,
                finalAmount = cashRegister.FinalAmount,
                totalSales = cashRegister.TotalSales,
                totalCash = cashRegister.TotalCash,
                totalPOS = cashRegister.TotalPOS,
                totalTransfer = cashRegister.TotalTransfer,
                notes = cashRegister.Notes
            },
            movements = movements,
            summary = new
            {
                totalOrders = orders.Count,
                totalSales = totalSales,
                totalCash = totalCash,
                totalPOS = totalPOS,
                totalTransfer = totalTransfer
            }
        });
    }

    /// <summary>
    /// Obtiene los pedidos asignados a un repartidor (para admin)
    /// Si hay una caja abierta, muestra todos los pedidos de esa sesión (incluyendo completados)
    /// </summary>
    [HttpGet("{id}/orders")]
    public async Task<ActionResult> GetDeliveryPersonOrders(int id, [FromQuery] bool includeCompleted = false)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var deliveryPerson = await _context.DeliveryPersons
            .FirstOrDefaultAsync(d => d.Id == id && d.RestaurantId == restaurantId);
        
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado o no pertenece a tu restaurante" });
        }

        // Verificar si hay una caja abierta (del mismo restaurante)
        var openCashRegister = await _context.DeliveryCashRegisters
            .Where(c => c.DeliveryPersonId == id && c.RestaurantId == restaurantId && c.IsOpen)
            .OrderByDescending(c => c.OpenedAt)
            .FirstOrDefaultAsync();

        var query = _context.Orders
            .Include(o => o.Items)
            .Include(o => o.Customer)
            .Where(o => o.DeliveryPersonId == id && 
                       o.RestaurantId == restaurantId &&
                       !o.IsArchived);

        // Si hay caja abierta, filtrar por pedidos de esa sesión
        if (openCashRegister != null)
        {
            query = query.Where(o => o.CreatedAt >= openCashRegister.OpenedAt);
        }

        // Si includeCompleted es false, solo mostrar activos
        if (!includeCompleted && openCashRegister == null)
        {
            query = query.Where(o => 
                o.Status != OrderConstants.STATUS_COMPLETED && 
                o.Status != OrderConstants.STATUS_CANCELLED);
        }

        var orders = await query
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
}

// DTOs para caja de repartidor
public class OpenDeliveryCashRegisterRequest
{
    public decimal InitialAmount { get; set; }
}

public class CloseDeliveryCashRegisterRequest
{
    public string? Notes { get; set; }
}

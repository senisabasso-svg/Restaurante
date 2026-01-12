using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;
using CornerApp.API.Constants;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/tables")]
[Tags("Mesas")]
[Authorize]
public class TablesController : ControllerBase
{
    private readonly ILogger<TablesController> _logger;
    private readonly ApplicationDbContext _context;

    public TablesController(ILogger<TablesController> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// Obtiene todas las mesas activas
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Table>>> GetTables([FromQuery] string? status = null)
    {
        var query = _context.Tables
            .AsNoTracking()
            .Where(t => t.IsActive);

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(t => t.Status == status);
        }

        var tables = await query
            .Include(t => t.Space)
            .OrderBy(t => t.Number)
            .ToListAsync();

        return Ok(tables);
    }

    /// <summary>
    /// Obtiene una mesa por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Table>> GetTable(int id)
    {
        var table = await _context.Tables
            .AsNoTracking()
            .Include(t => t.Orders.Where(o => !o.IsArchived))
            .FirstOrDefaultAsync(t => t.Id == id);

        if (table == null)
        {
            return NotFound(new { error = "Mesa no encontrada" });
        }

        return Ok(table);
    }

    /// <summary>
    /// Crea una nueva mesa
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Table>> CreateTable([FromBody] CreateTableRequest request)
    {
        try
        {
            // Validar que el número de mesa no exista
            var existingTable = await _context.Tables
                .FirstOrDefaultAsync(t => t.Number.ToLower() == request.Number.ToLower() && t.IsActive);

            if (existingTable != null)
            {
                return BadRequest(new { error = "Ya existe una mesa con ese número" });
            }

            var table = new Table
            {
                Number = request.Number.Trim(),
                Capacity = request.Capacity,
                Location = request.Location?.Trim(),
                Status = request.Status ?? "Available",
                Notes = request.Notes?.Trim(),
                SpaceId = request.SpaceId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Tables.Add(table);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa creada: {TableId} - {TableNumber}", table.Id, table.Number);
            return CreatedAtAction(nameof(GetTable), new { id = table.Id }, table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear mesa");
            return StatusCode(500, new { error = "Error al crear la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza una mesa
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Table>> UpdateTable(int id, [FromBody] UpdateTableRequest request)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            // Validar que el número de mesa no exista en otra mesa
            if (!string.IsNullOrEmpty(request.Number))
            {
                var existingTable = await _context.Tables
                    .FirstOrDefaultAsync(t => t.Number.ToLower() == request.Number.ToLower() 
                        && t.Id != id 
                        && t.IsActive);

                if (existingTable != null)
                {
                    return BadRequest(new { error = "Ya existe una mesa con ese número" });
                }

                table.Number = request.Number.Trim();
            }

            if (request.Capacity.HasValue)
            {
                table.Capacity = request.Capacity.Value;
            }

            if (request.Location != null)
            {
                table.Location = request.Location.Trim();
            }

            if (request.SpaceId.HasValue)
            {
                table.SpaceId = request.SpaceId.Value;
            }
            else if (request.SpaceId == null)
            {
                // Permitir establecer SpaceId a null explícitamente
                table.SpaceId = null;
            }

            if (request.PositionX.HasValue)
            {
                table.PositionX = request.PositionX.Value;
            }

            if (request.PositionY.HasValue)
            {
                table.PositionY = request.PositionY.Value;
            }

            if (!string.IsNullOrEmpty(request.Status))
            {
                table.Status = request.Status;
            }

            if (request.Notes != null)
            {
                table.Notes = request.Notes.Trim();
            }

            if (request.IsActive.HasValue)
            {
                table.IsActive = request.IsActive.Value;
            }

            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa actualizada: {TableId} - {TableNumber}", table.Id, table.Number);
            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar mesa");
            return StatusCode(500, new { error = "Error al actualizar la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina (desactiva) una mesa
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTable(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            // Verificar si hay pedidos activos en esta mesa
            var hasActiveOrders = await _context.Orders
                .AnyAsync(o => o.TableId == id 
                    && !o.IsArchived 
                    && (o.Status == "Pending" || o.Status == "Preparing" || o.Status == "Ready"));

            if (hasActiveOrders)
            {
                return BadRequest(new { error = "No se puede eliminar la mesa porque tiene pedidos activos" });
            }

            // Soft delete - solo desactivar
            table.IsActive = false;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Mesa eliminada (desactivada): {TableId} - {TableNumber}", table.Id, table.Number);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar mesa");
            return StatusCode(500, new { error = "Error al eliminar la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Cambia el estado de una mesa
    /// </summary>
    [HttpPatch("{id}/status")]
    public async Task<ActionResult<Table>> UpdateTableStatus(int id, [FromBody] UpdateTableStatusRequest request)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            table.Status = request.Status;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Estado de mesa actualizado: {TableId} - {TableNumber} -> {Status}", 
                table.Id, table.Number, request.Status);
            return Ok(table);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar estado de mesa");
            return StatusCode(500, new { error = "Error al actualizar el estado de la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Crea un pedido desde una mesa
    /// </summary>
    [HttpPost("{id}/create-order")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> CreateOrderFromTable(int id, [FromBody] CreateOrderFromTableRequest request)
    {
        try
        {
            // Verificar que la caja esté abierta
            var openCashRegister = await _context.CashRegisters
                .Where(c => c.IsOpen)
                .FirstOrDefaultAsync();

            if (openCashRegister == null)
            {
                return BadRequest(new { error = "Debe abrir la caja antes de crear pedidos desde mesas" });
            }

            // Verificar que la mesa existe
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            if (!table.IsActive)
            {
                return BadRequest(new { error = "La mesa no está activa" });
            }

            // Crear el request para AdminOrdersController
            var orderRequest = new CreateOrderRequest
            {
                CustomerName = $"Mesa {table.Number}",
                CustomerPhone = null,
                CustomerEmail = null,
                CustomerAddress = null,
                PaymentMethod = request.PaymentMethod ?? PaymentConstants.METHOD_CASH,
                Items = request.Items,
                Comments = request.Comments,
                TableId = id
            };

            // Llamar al método de creación de pedido del AdminOrdersController
            // Necesitamos inyectar los servicios necesarios o crear el pedido directamente aquí
            // Por ahora, vamos a crear el pedido directamente en este método
            
            if (orderRequest.Items == null || !orderRequest.Items.Any())
            {
                return BadRequest(new { error = "El pedido debe contener al menos un item" });
            }

            // Validar productos
            var productIds = orderRequest.Items.Select(item => item.Id).Distinct().ToList();
            var existingProducts = await _context.Products
                .Where(p => productIds.Contains(p.Id))
                .Select(p => p.Id)
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts).ToList();
            if (missingProductIds.Any())
            {
                return BadRequest(new { 
                    error = $"Los siguientes productos no existen: {string.Join(", ", missingProductIds)}" 
                });
            }

            // Calcular total
            var total = orderRequest.Items.Sum(item => 
            {
                var price = item.Price >= 0 ? item.Price : 0;
                return price * item.Quantity;
            });

            // Obtener método de pago
            var paymentMethodName = orderRequest.PaymentMethod ?? PaymentConstants.METHOD_CASH;
            var paymentMethod = await _context.PaymentMethods
                .FirstOrDefaultAsync(pm => pm.Name != null && 
                    pm.Name.ToLower() == paymentMethodName.ToLower() && pm.IsActive);
            
            if (paymentMethod == null)
            {
                paymentMethodName = PaymentConstants.METHOD_CASH;
            }
            else
            {
                paymentMethodName = paymentMethod.Name ?? PaymentConstants.METHOD_CASH;
            }

            // Crear items del pedido
            var orderItems = orderRequest.Items.Select(item => 
            {
                var orderItem = new OrderItem
                {
                    ProductId = item.Id,
                    ProductName = (item.Name ?? "Producto sin nombre").Length > 200 
                        ? (item.Name ?? "Producto sin nombre").Substring(0, 200) 
                        : (item.Name ?? "Producto sin nombre"),
                    UnitPrice = item.Price >= 0 ? item.Price : 0,
                    Quantity = item.Quantity > 0 ? item.Quantity : 1
                };
                
                // Agregar subproductos si existen
                if (item.SubProducts != null && item.SubProducts.Any())
                {
                    orderItem.SubProducts = item.SubProducts.Select(sp => new Models.OrderItemSubProduct
                    {
                        Id = sp.Id,
                        Name = sp.Name ?? string.Empty,
                        Price = sp.Price
                    }).ToList();
                }
                
                return orderItem;
            }).ToList();

            // Crear el pedido
            var order = new Order
            {
                CustomerName = orderRequest.CustomerName,
                CustomerPhone = string.Empty,
                CustomerEmail = string.Empty,
                CustomerAddress = string.Empty,
                Total = total,
                PaymentMethod = paymentMethodName,
                Status = OrderConstants.STATUS_PENDING,
                EstimatedDeliveryMinutes = 30, // Tiempo estimado por defecto para mesas
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                Comments = orderRequest.Comments,
                TableId = id,
                Items = orderItems
            };

            _context.Orders.Add(order);
            await _context.SaveChangesAsync();

            // Actualizar estado de la mesa solo si está disponible
            // Si ya está ocupada o tiene pedidos, mantener el estado actual
            if (table.Status == "Available")
            {
                table.Status = "Occupied";
            }
            // Actualizar OrderPlacedAt para mostrar el último pedido
            table.OrderPlacedAt = DateTime.UtcNow;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Pedido {OrderId} creado desde mesa {TableId} - {TableNumber}", 
                order.Id, table.Id, table.Number);

            return Ok(new { 
                id = order.Id, 
                message = "Pedido creado exitosamente",
                order = order,
                table = table
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido desde mesa {TableId}", id);
            return StatusCode(500, new { 
                error = "Error al crear el pedido", 
                details = ex.Message 
            });
        }
    }
}

// DTOs
public class CreateTableRequest
{
    public string Number { get; set; } = string.Empty;
    public int Capacity { get; set; } = 4;
    public string? Location { get; set; }
    public string? Status { get; set; } = "Available";
    public string? Notes { get; set; }
    public int? SpaceId { get; set; }
}

public class UpdateTableRequest
{
    public string? Number { get; set; }
    public int? Capacity { get; set; }
    public string? Location { get; set; }
    public double? PositionX { get; set; }
    public double? PositionY { get; set; }
    public string? Status { get; set; }
    public string? Notes { get; set; }
    public bool? IsActive { get; set; }
    public int? SpaceId { get; set; }
}

public class UpdateTableStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

public class CreateOrderFromTableRequest
{
    public List<OrderItemRequest> Items { get; set; } = new();
    public string? PaymentMethod { get; set; }
    public string? Comments { get; set; }
}


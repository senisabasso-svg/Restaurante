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
    private readonly CornerApp.API.Hubs.IOrderNotificationService _orderNotificationService;

    public TablesController(
        ILogger<TablesController> logger, 
        ApplicationDbContext context,
        CornerApp.API.Hubs.IOrderNotificationService orderNotificationService)
    {
        _logger = logger;
        _context = context;
        _orderNotificationService = orderNotificationService;
    }

    /// <summary>
    /// Obtiene todas las mesas activas
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Table>>> GetTables([FromQuery] string? status = null)
    {
        var query = _context.Tables
            .Where(t => t.IsActive);

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(t => t.Status == status);
        }

        var tables = await query
            .Include(t => t.Space)
            .OrderBy(t => t.Number)
            .ToListAsync();

        _logger.LogInformation("📊 Sincronizando estado de {Count} mesas con pedidos activos", tables.Count);

        // Sincronizar estado de mesas con pedidos activos
        foreach (var table in tables)
        {
            await SyncTableStatusWithOrders(table);
        }

        // Guardar cambios si hubo actualizaciones
        var changesSaved = await _context.SaveChangesAsync();
        _logger.LogInformation("💾 Cambios guardados en base de datos: {ChangesCount} entidades modificadas", changesSaved);

        // Recargar las mesas desde la base de datos para asegurar que tenemos el estado actualizado
        // Esto es importante porque SaveChanges puede haber actualizado el estado
        var tableIds = tables.Select(t => t.Id).ToList();
        var updatedTables = await _context.Tables
            .AsNoTracking()
            .Include(t => t.Space)
            .Where(t => tableIds.Contains(t.Id))
            .OrderBy(t => t.Number)
            .ToListAsync();

        // Devolver las mesas actualizadas
        var result = updatedTables;

        return Ok(result);
    }

    /// <summary>
    /// Sincroniza el estado de una mesa basándose en sus pedidos activos
    /// </summary>
    private async Task SyncTableStatusWithOrders(Table table)
    {
        try
        {
            // Verificar si la mesa tiene pedidos activos (cualquier estado que no sea completed o cancelled)
            var activeOrders = await _context.Orders
                .Where(o => o.TableId == table.Id 
                    && !o.IsArchived 
                    && o.Status != OrderConstants.STATUS_COMPLETED 
                    && o.Status != OrderConstants.STATUS_CANCELLED)
                .ToListAsync();

            var hasActiveOrders = activeOrders.Any();
            var oldStatus = table.Status;

            _logger.LogInformation("Sincronizando mesa {TableId} - {TableNumber}: Estado actual={Status}, Pedidos activos={Count} (IDs: {OrderIds})", 
                table.Id, table.Number, oldStatus, activeOrders.Count, string.Join(", ", activeOrders.Select(o => o.Id)));

            // Si tiene pedidos activos pero está marcada como Available, actualizar a Occupied
            if (hasActiveOrders && table.Status == "Available")
            {
                table.Status = "Occupied";
                table.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("✅ Mesa {TableId} - {TableNumber} sincronizada: {OldStatus} -> Occupied (tiene {Count} pedidos activos)", 
                    table.Id, table.Number, oldStatus, activeOrders.Count);
            }
            // Si no tiene pedidos activos pero está marcada como Occupied u OrderPlaced, actualizar a Available
            else if (!hasActiveOrders && (table.Status == "Occupied" || table.Status == "OrderPlaced"))
            {
                table.Status = "Available";
                table.UpdatedAt = DateTime.UtcNow;
                _logger.LogInformation("✅ Mesa {TableId} - {TableNumber} sincronizada: {OldStatus} -> Available (sin pedidos activos)", 
                    table.Id, table.Number, oldStatus);
            }
            else
            {
                _logger.LogInformation("ℹ️ Mesa {TableId} - {TableNumber} no requiere sincronización: Estado={Status}, Tiene pedidos activos={HasActive}", 
                    table.Id, table.Number, oldStatus, hasActiveOrders);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error al sincronizar estado de mesa {TableId} - {TableNumber}", table.Id, table.Number);
        }
    }

    /// <summary>
    /// Endpoint para sincronizar manualmente el estado de una mesa
    /// </summary>
    [HttpPost("{id}/sync-status")]
    [Authorize]
    public async Task<ActionResult<Table>> SyncTableStatus(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            var oldStatus = table.Status;
            await SyncTableStatusWithOrders(table);
            await _context.SaveChangesAsync();

            if (oldStatus != table.Status)
            {
                _logger.LogInformation("Estado de mesa {TableId} - {TableNumber} sincronizado manualmente: {OldStatus} -> {NewStatus}", 
                    table.Id, table.Number, oldStatus, table.Status);
                return Ok(new { 
                    message = "Estado de mesa sincronizado",
                    oldStatus = oldStatus,
                    newStatus = table.Status,
                    table = table
                });
            }
            else
            {
                return Ok(new { 
                    message = "El estado de la mesa ya está sincronizado",
                    status = table.Status,
                    table = table
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al sincronizar estado de mesa {TableId}", id);
            return StatusCode(500, new { error = "Error al sincronizar el estado de la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene una mesa por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Table>> GetTable(int id)
    {
        var table = await _context.Tables
            .Include(t => t.Orders.Where(o => !o.IsArchived))
            .FirstOrDefaultAsync(t => t.Id == id);

        if (table == null)
        {
            return NotFound(new { error = "Mesa no encontrada" });
        }

        // Sincronizar estado de la mesa con pedidos activos
        await SyncTableStatusWithOrders(table);
        await _context.SaveChangesAsync();

        // Devolver como AsNoTracking después de sincronizar
        var result = new Table
        {
            Id = table.Id,
            Number = table.Number,
            Capacity = table.Capacity,
            Location = table.Location,
            SpaceId = table.SpaceId,
            PositionX = table.PositionX,
            PositionY = table.PositionY,
            Status = table.Status,
            IsActive = table.IsActive,
            Notes = table.Notes,
            OrderPlacedAt = table.OrderPlacedAt,
            CreatedAt = table.CreatedAt,
            UpdatedAt = table.UpdatedAt,
            Orders = table.Orders
        };

        return Ok(result);
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
    /// Transfiere pedidos activos de una mesa a otra
    /// </summary>
    [HttpPost("{id}/transfer-to/{targetTableId}")]
    [Authorize]
    public async Task<ActionResult> TransferTableOrders(int id, int targetTableId)
    {
        try
        {
            // Verificar que ambas mesas existan
            var sourceTable = await _context.Tables.FindAsync(id);
            if (sourceTable == null)
            {
                return NotFound(new { error = "Mesa origen no encontrada" });
            }

            var targetTable = await _context.Tables.FindAsync(targetTableId);
            if (targetTable == null)
            {
                return NotFound(new { error = "Mesa destino no encontrada" });
            }

            // Verificar que la mesa destino esté disponible
            if (targetTable.Status != "Available")
            {
                return BadRequest(new { error = "La mesa destino debe estar disponible para transferir pedidos" });
            }

            // Verificar que la mesa origen tenga pedidos activos
            var activeOrders = await _context.Orders
                .Where(o => o.TableId == id 
                    && !o.IsArchived 
                    && o.Status != OrderConstants.STATUS_COMPLETED 
                    && o.Status != OrderConstants.STATUS_CANCELLED)
                .ToListAsync();

            if (activeOrders.Count == 0)
            {
                return BadRequest(new { error = "La mesa origen no tiene pedidos activos para transferir" });
            }

            // Transferir todos los pedidos activos a la mesa destino
            foreach (var order in activeOrders)
            {
                order.TableId = targetTableId;
                order.UpdatedAt = DateTime.UtcNow;
                
                // Actualizar CustomerName si contiene "Mesa X" para reflejar la nueva mesa
                if (!string.IsNullOrEmpty(order.CustomerName) && order.CustomerName.Contains("Mesa"))
                {
                    // Reemplazar el número de mesa anterior con el nuevo
                    order.CustomerName = System.Text.RegularExpressions.Regex.Replace(
                        order.CustomerName, 
                        @"Mesa\s*\d+", 
                        $"Mesa {targetTable.Number}",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                    );
                }
            }

            // Actualizar estados de las mesas
            sourceTable.Status = "Available";
            sourceTable.OrderPlacedAt = null;
            sourceTable.UpdatedAt = DateTime.UtcNow;

            targetTable.Status = "Occupied";
            targetTable.OrderPlacedAt = activeOrders
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefault()?.CreatedAt ?? DateTime.UtcNow;
            targetTable.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Notificar via SignalR que los pedidos fueron actualizados (cambio de mesa)
            // Recargar los pedidos con sus relaciones para enviarlos completos
            // IMPORTANTE: Recargar DESPUÉS de SaveChanges para obtener los valores actualizados
            var orderIds = activeOrders.Select(o => o.Id).ToList();
            var ordersWithDetails = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Items)
                .Include(o => o.Table)
                .Include(o => o.DeliveryPerson)
                .Where(o => orderIds.Contains(o.Id))
                .ToListAsync();

            _logger.LogInformation("📤 Enviando notificaciones SignalR para {Count} pedidos transferidos", ordersWithDetails.Count);

            foreach (var order in ordersWithDetails)
            {
                try
                {
                    _logger.LogInformation("📤 Enviando notificación SignalR para pedido {OrderId} - TableId: {TableId}, TableNumber: {TableNumber}", 
                        order.Id, order.TableId, order.Table?.Number ?? "null");
                    
                    await _orderNotificationService.NotifyOrderUpdated(order);
                    
                    _logger.LogInformation("✅ Notificación SignalR enviada exitosamente para pedido transferido {OrderId} (Mesa {TableId} - {TableNumber})", 
                        order.Id, order.TableId, order.Table?.Number ?? "N/A");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "❌ No se pudo enviar notificación SignalR para pedido transferido {OrderId}", order.Id);
                }
            }

            _logger.LogInformation("Transferidos {Count} pedidos de mesa {SourceTableId} ({SourceNumber}) a mesa {TargetTableId} ({TargetNumber})", 
                activeOrders.Count, sourceTable.Id, sourceTable.Number, targetTable.Id, targetTable.Number);

            return Ok(new { 
                message = $"Se transfirieron {activeOrders.Count} pedido(s) de la Mesa {sourceTable.Number} a la Mesa {targetTable.Number}",
                transferredOrdersCount = activeOrders.Count,
                sourceTable = new { id = sourceTable.Id, number = sourceTable.Number, status = sourceTable.Status },
                targetTable = new { id = targetTable.Id, number = targetTable.Number, status = targetTable.Status }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al transferir pedidos de mesa {SourceTableId} a mesa {TargetTableId}", id, targetTableId);
            return StatusCode(500, new { error = "Error al transferir los pedidos", details = ex.Message });
        }
    }

    /// <summary>
    /// Libera una mesa si no tiene pedidos activos
    /// </summary>
    [HttpPost("{id}/free")]
    public async Task<ActionResult<Table>> FreeTable(int id)
    {
        try
        {
            var table = await _context.Tables.FindAsync(id);
            if (table == null)
            {
                return NotFound(new { error = "Mesa no encontrada" });
            }

            // Sincronizar estado primero para asegurar que esté actualizado
            await SyncTableStatusWithOrders(table);
            await _context.SaveChangesAsync();

            // Verificar nuevamente si la mesa tiene pedidos activos después de sincronizar
            var hasActiveOrders = await _context.Orders
                .AnyAsync(o => o.TableId == id 
                    && !o.IsArchived 
                    && o.Status != OrderConstants.STATUS_COMPLETED 
                    && o.Status != OrderConstants.STATUS_CANCELLED);

            if (hasActiveOrders)
            {
                return BadRequest(new { error = "No se puede liberar la mesa porque tiene pedidos activos" });
            }

            // Si la mesa está ocupada pero no tiene pedidos, liberarla
            if (table.Status == "Occupied" || table.Status == "OrderPlaced")
            {
                table.Status = "Available";
                table.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Mesa liberada manualmente: {TableId} - {TableNumber}", table.Id, table.Number);
                return Ok(new { 
                    message = "Mesa liberada exitosamente",
                    table = table
                });
            }
            else
            {
                // La mesa ya está disponible o en otro estado
                return Ok(new { 
                    message = "La mesa ya está disponible",
                    table = table
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al liberar mesa {TableId}", id);
            return StatusCode(500, new { error = "Error al liberar la mesa", details = ex.Message });
        }
    }

    /// <summary>
    /// Crea un pedido desde una mesa (Admin y Employee pueden crear pedidos)
    /// </summary>
    [HttpPost("{id}/create-order")]
    [Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden crear pedidos desde mesas
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

            // Validar productos y obtener información de categorías
            var productIds = orderRequest.Items.Select(item => item.Id).Distinct().ToList();
            var existingProducts = await _context.Products
                .Include(p => p.Category)
                .Where(p => productIds.Contains(p.Id))
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts.Select(p => p.Id)).ToList();
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
                // Buscar el producto para obtener su categoría
                var product = existingProducts.FirstOrDefault(p => p.Id == item.Id);
                
                var orderItem = new OrderItem
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

            // Actualizar estado de la mesa a Occupied si tiene pedidos activos
            // Sincronizar estado basándose en pedidos activos
            await SyncTableStatusWithOrders(table);
            
            // Si después de sincronizar sigue en Available, cambiarla a Occupied
            if (table.Status == "Available")
            {
                table.Status = "Occupied";
            }
            
            // Actualizar OrderPlacedAt para mostrar el último pedido
            table.OrderPlacedAt = DateTime.UtcNow;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Recargar el pedido con la información de la mesa para la notificación
            var orderWithTable = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Table)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == order.Id);

            // Notificar via SignalR
            try
            {
                if (orderWithTable != null)
                {
                    _logger.LogInformation("Enviando notificación SignalR para pedido {OrderId} con TableId={TableId}, TableNumber={TableNumber}", 
                        orderWithTable.Id, orderWithTable.TableId, orderWithTable.Table?.Number);
                    await _orderNotificationService.NotifyOrderCreated(orderWithTable);
                }
                else
                {
                    _logger.LogWarning("No se pudo recargar pedido {OrderId} con información de mesa, enviando sin Table", order.Id);
                    await _orderNotificationService.NotifyOrderCreated(order);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al enviar notificación SignalR para pedido {OrderId}", order.Id);
            }

            _logger.LogInformation("Pedido {OrderId} creado desde mesa {TableId} - {TableNumber}", 
                order.Id, table.Id, table.Number);

            // Usar el pedido recargado con la información de la mesa si está disponible
            var orderToReturn = orderWithTable ?? order;

            return Ok(new { 
                id = orderToReturn.Id, 
                message = "Pedido creado exitosamente",
                order = orderToReturn,
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

    /// <summary>
    /// Endpoint público para mozos: Obtiene todas las mesas (sin autenticación)
    /// </summary>
    [HttpGet("waiter")]
    [AllowAnonymous]
    public async Task<ActionResult> GetTablesForWaiter()
    {
        try
        {
            var tables = await _context.Tables
                .Where(t => t.IsActive)
                .OrderBy(t => t.Number)
                .Select(t => new
                {
                    id = t.Id,
                    number = t.Number,
                    capacity = t.Capacity,
                    status = t.Status,
                    location = t.Location,
                    spaceId = t.SpaceId,
                    positionX = t.PositionX,
                    positionY = t.PositionY,
                    orderPlacedAt = t.OrderPlacedAt
                })
                .ToListAsync();

            return Ok(tables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener mesas para mozo");
            return StatusCode(500, new { error = "Error al obtener mesas", details = ex.Message });
        }
    }

    /// <summary>
    /// Endpoint público para mozos: Crea un pedido desde una mesa (sin autenticación)
    /// </summary>
    [HttpPost("waiter/{id}/create-order")]
    [AllowAnonymous]
    public async Task<ActionResult> CreateOrderFromTableForWaiter(int id, [FromBody] CreateOrderFromTableRequest request)
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

            if (orderRequest.Items == null || !orderRequest.Items.Any())
            {
                return BadRequest(new { error = "El pedido debe contener al menos un item" });
            }

            // Validar productos y obtener información de categorías
            var productIds = orderRequest.Items.Select(item => item.Id).Distinct().ToList();
            var existingProducts = await _context.Products
                .Include(p => p.Category)
                .Where(p => productIds.Contains(p.Id))
                .ToListAsync();
            
            var missingProductIds = productIds.Except(existingProducts.Select(p => p.Id)).ToList();
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
                .FirstOrDefaultAsync(pm => pm.Name.ToLower() == paymentMethodName.ToLower() && pm.IsActive);
            
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
                var product = existingProducts.FirstOrDefault(p => p.Id == item.Id);
                var unitPrice = item.Price >= 0 ? item.Price : (product?.Price ?? 0);
                var orderItem = new OrderItem
                {
                    ProductId = item.Id,
                    ProductName = item.Name ?? product?.Name ?? "Producto",
                    Quantity = item.Quantity,
                    UnitPrice = unitPrice
                    // Subtotal se calcula automáticamente como UnitPrice * Quantity
                };

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

            // Actualizar estado de la mesa
            await SyncTableStatusWithOrders(table);
            
            if (table.Status == "Available")
            {
                table.Status = "Occupied";
            }
            
            table.OrderPlacedAt = DateTime.UtcNow;
            table.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Notificar via SignalR
            try
            {
                await _orderNotificationService.NotifyOrderCreated(order);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo enviar notificación SignalR para pedido {OrderId}", order.Id);
            }

            _logger.LogInformation("Pedido {OrderId} creado desde mesa {TableId} - {TableNumber} (por mozo)", 
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
            _logger.LogError(ex, "Error al crear pedido desde mesa {TableId} (por mozo)", id);
            return StatusCode(500, new { 
                error = "Error al crear el pedido", 
                details = ex.Message 
            });
        }
    }

    /// <summary>
    /// Elimina un item de un pedido de mesa
    /// </summary>
    [HttpDelete("orders/{orderId}/items/{itemId}")]
    [Authorize(Roles = "Admin,Employee")]
    public async Task<ActionResult> DeleteOrderItem(int orderId, int itemId)
    {
        try
        {
            var order = await _context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == orderId);

            if (order == null)
            {
                return NotFound(new { error = "Pedido no encontrado" });
            }

            // Verificar que el pedido pertenece a una mesa
            if (!order.TableId.HasValue)
            {
                return BadRequest(new { error = "Este pedido no está asociado a una mesa" });
            }

            // Verificar que el pedido no esté completado o cancelado
            if (order.Status == OrderConstants.STATUS_COMPLETED || order.Status == OrderConstants.STATUS_CANCELLED)
            {
                return BadRequest(new { error = "No se pueden eliminar items de pedidos completados o cancelados" });
            }

            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
            if (item == null)
            {
                return NotFound(new { error = "Item no encontrado en el pedido" });
            }

            // Eliminar el item
            order.Items.Remove(item);

            // Recalcular el total del pedido
            order.Total = order.Items.Sum(i => i.Subtotal);
            order.UpdatedAt = DateTime.UtcNow;

            // Si no quedan items, cancelar el pedido
            if (order.Items.Count == 0)
            {
                order.Status = OrderConstants.STATUS_CANCELLED;
                _logger.LogInformation("Pedido {OrderId} cancelado automáticamente al eliminar todos sus items", orderId);
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Item {ItemId} eliminado del pedido {OrderId}", itemId, orderId);

            return Ok(new { 
                success = true,
                message = "Item eliminado correctamente",
                order = order
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar item {ItemId} del pedido {OrderId}", itemId, orderId);
            return StatusCode(500, new { 
                error = "Error al eliminar el item", 
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


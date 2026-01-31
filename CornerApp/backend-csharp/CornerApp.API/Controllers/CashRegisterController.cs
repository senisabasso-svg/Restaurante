using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.Constants;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de caja
/// </summary>
[ApiController]
[Route("admin/api/cash-register")]
[Tags("Administración - Caja")]
[Authorize(Roles = "Admin")]
public class CashRegisterController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<CashRegisterController> _logger;

    public CashRegisterController(
        ApplicationDbContext context,
        ILogger<CashRegisterController> logger)
    {
        _context = context;
        _logger = logger;
        _logger.LogInformation("CashRegisterController instanciado");
    }

    /// <summary>
    /// Obtiene el estado actual de la caja (si está abierta o cerrada)
    /// </summary>
    [HttpGet("status")]
    [Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden ver el estado
    public async Task<ActionResult> GetCashRegisterStatus()
    {
        _logger.LogInformation("=== GetCashRegisterStatus INICIADO ===");
        try
        {
            _logger.LogInformation("Iniciando consulta de estado de caja");
            
            CashRegister? openCashRegister = null;
            try
            {
                openCashRegister = await _context.CashRegisters
                    .Where(c => c.IsOpen)
                    .OrderByDescending(c => c.OpenedAt)
                    .FirstOrDefaultAsync();
            }
            catch (Exception dbEx)
            {
                _logger.LogError(dbEx, "Error al consultar cajas abiertas: {Message}", dbEx.Message);
                throw;
            }

            if (openCashRegister == null)
            {
                _logger.LogInformation("No hay caja abierta");
                return Ok(new { isOpen = false, cashRegister = (object?)null });
            }

            _logger.LogInformation("Caja abierta encontrada: ID {CashRegisterId}, Abierta en {OpenedAt}", 
                openCashRegister.Id, openCashRegister.OpenedAt);

            // Calcular totales desde los pedidos de ESTA sesión de caja específica
            // Solo contar pedidos creados DESPUÉS de que se abrió esta caja
            List<Order> orders = new();
            try
            {
                orders = await _context.Orders
                    .Where(o => o.CreatedAt >= openCashRegister.OpenedAt
                        && o.Status == OrderConstants.STATUS_COMPLETED
                        && !o.IsArchived)
                    .ToListAsync();
            }
            catch (Exception dbEx)
            {
                _logger.LogError(dbEx, "Error al consultar pedidos: {Message}", dbEx.Message);
                throw;
            }

            _logger.LogInformation("Pedidos encontrados: {Count}", orders.Count);

            // Calcular totales de forma segura
            decimal totalSales = 0m;
            decimal totalCash = 0m;
            decimal totalPOS = 0m;
            decimal totalTransfer = 0m;

            try
            {
                totalSales = orders.Count > 0 ? orders.Sum(o => o.Total) : 0m;
                
                if (orders.Count > 0)
                {
                    var cashMethod = PaymentConstants.METHOD_CASH.ToLower();
                    var posMethod = PaymentConstants.METHOD_POS.ToLower();
                    var transferMethod = PaymentConstants.METHOD_TRANSFER.ToLower();

                    totalCash = orders
                        .Where(o => !string.IsNullOrEmpty(o.PaymentMethod) && o.PaymentMethod.ToLower() == cashMethod)
                        .Sum(o => o.Total);
                    
                    totalPOS = orders
                        .Where(o => !string.IsNullOrEmpty(o.PaymentMethod) && o.PaymentMethod.ToLower() == posMethod)
                        .Sum(o => o.Total);
                    
                    totalTransfer = orders
                        .Where(o => !string.IsNullOrEmpty(o.PaymentMethod) && o.PaymentMethod.ToLower() == transferMethod)
                        .Sum(o => o.Total);
                }
            }
            catch (Exception calcEx)
            {
                _logger.LogError(calcEx, "Error al calcular totales: {Message}", calcEx.Message);
                throw;
            }

            _logger.LogInformation("Totales calculados - Ventas: {TotalSales}, Efectivo: {TotalCash}, POS: {TotalPOS}, Transferencia: {TotalTransfer}",
                totalSales, totalCash, totalPOS, totalTransfer);

            try
            {
                var response = new
                {
                    isOpen = true,
                    cashRegister = new
                    {
                        id = openCashRegister.Id,
                        openedAt = openCashRegister.OpenedAt,
                        initialAmount = openCashRegister.InitialAmount,
                        totalSales = totalSales,
                        totalCash = totalCash,
                        totalPOS = totalPOS,
                        totalTransfer = totalTransfer,
                        createdBy = openCashRegister.CreatedBy
                    }
                };

                return Ok(response);
            }
            catch (Exception serializationEx)
            {
                _logger.LogError(serializationEx, "Error al serializar respuesta: {Message}", serializationEx.Message);
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estado de caja: {Message}\n{StackTrace}\nInnerException: {InnerException}", 
                ex.Message, ex.StackTrace ?? "N/A", ex.InnerException?.Message ?? "N/A");
            return StatusCode(500, new { error = "Error al obtener el estado de la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Abre una nueva sesión de caja (solo Admin)
    /// </summary>
    [HttpPost("open")]
    [Authorize(Roles = "Admin")] // Solo Admin puede abrir caja
    public async Task<ActionResult<CashRegister>> OpenCashRegister([FromBody] OpenCashRegisterRequest request)
    {
        try
        {
            // Verificar que no haya una caja abierta
            var existingOpenCashRegister = await _context.CashRegisters
                .Where(c => c.IsOpen)
                .FirstOrDefaultAsync();

            if (existingOpenCashRegister != null)
            {
                return BadRequest(new { error = "Ya existe una caja abierta. Debe cerrarla antes de abrir una nueva." });
            }

            if (request.InitialAmount < 0)
            {
                return BadRequest(new { error = "El monto inicial no puede ser negativo" });
            }

            var cashRegister = new CashRegister
            {
                OpenedAt = DateTime.UtcNow,
                InitialAmount = request.InitialAmount,
                IsOpen = true,
                CreatedBy = User.Identity?.Name ?? "Admin",
                CreatedAt = DateTime.UtcNow
            };

            _context.CashRegisters.Add(cashRegister);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Caja abierta: ID {CashRegisterId}, Monto inicial: {InitialAmount}, Usuario: {User}",
                cashRegister.Id, cashRegister.InitialAmount, cashRegister.CreatedBy);

            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al abrir caja");
            return StatusCode(500, new { error = "Error al abrir la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Cierra la caja actual (solo Admin)
    /// </summary>
    [HttpPost("close")]
    [Authorize(Roles = "Admin")] // Solo Admin puede cerrar caja
    public async Task<ActionResult<CashRegister>> CloseCashRegister([FromBody] CloseCashRegisterRequest? request)
    {
        try
        {
            // Obtener la caja abierta
            var cashRegister = await _context.CashRegisters
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpenedAt)
                .FirstOrDefaultAsync();

            if (cashRegister == null)
            {
                return BadRequest(new { error = "No hay una caja abierta para cerrar" });
            }

            // Verificar que no haya mesas con pedidos pendientes de ESTA sesión de caja
            var pendingTableOrders = await _context.Orders
                .Where(o => o.TableId != null
                    && o.CreatedAt >= cashRegister.OpenedAt  // Solo pedidos de esta sesión
                    && o.Status != OrderConstants.STATUS_COMPLETED
                    && o.Status != OrderConstants.STATUS_CANCELLED
                    && !o.IsArchived)
                .Select(o => new { o.TableId, o.Id, o.Status })
                .ToListAsync();

            if (pendingTableOrders.Any())
            {
                var tableIds = pendingTableOrders.Select(o => o.TableId).Distinct().ToList();
                var tables = await _context.Tables
                    .Where(t => tableIds.Contains(t.Id))
                    .Select(t => t.Number)
                    .ToListAsync();

                return BadRequest(new
                {
                    error = "No se puede cerrar la caja porque hay mesas con pedidos pendientes",
                    pendingTables = tables,
                    pendingOrders = pendingTableOrders.Count
                });
            }

            // Calcular totales desde los pedidos de ESTA sesión de caja específica
            // Solo contar pedidos creados DESPUÉS de que se abrió esta caja
            // Incluir pedidos archivados que fueron completados durante esta sesión (fueron cobrados)
            var orders = await _context.Orders
                .Where(o => o.CreatedAt >= cashRegister.OpenedAt  // Desde que se abrió esta caja
                    && o.Status == OrderConstants.STATUS_COMPLETED)
                    // Removido: && !o.IsArchived - Ahora incluimos pedidos archivados que fueron cobrados
                .ToListAsync();

            var totalSales = orders.Sum(o => o.Total);
            var totalCash = orders.Where(o => o.PaymentMethod != null && o.PaymentMethod.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
                .Sum(o => o.Total);
            var totalPOS = orders.Where(o => o.PaymentMethod != null && o.PaymentMethod.ToLower() == PaymentConstants.METHOD_POS.ToLower())
                .Sum(o => o.Total);
            var totalTransfer = orders.Where(o => o.PaymentMethod != null && o.PaymentMethod.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
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
            cashRegister.ClosedBy = User.Identity?.Name ?? "Admin";
            cashRegister.Notes = request?.Notes;
            cashRegister.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Caja cerrada: ID {CashRegisterId}, Total ventas: {TotalSales}, Monto final: {FinalAmount}, Usuario: {User}",
                cashRegister.Id, totalSales, finalAmount, cashRegister.ClosedBy);

            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cerrar caja");
            return StatusCode(500, new { error = "Error al cerrar la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el historial de cajas
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult> GetCashRegisterHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = _context.CashRegisters
                .OrderByDescending(c => c.OpenedAt)
                .AsQueryable();

            var total = await query.CountAsync();

            var cashRegisters = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                cashRegisters,
                total,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(total / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener historial de cajas");
            return StatusCode(500, new { error = "Error al obtener el historial de cajas", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene los movimientos (pedidos) de una caja específica
    /// </summary>
    [HttpGet("{id}/movements")]
    public async Task<ActionResult> GetCashRegisterMovements(int id)
    {
        try
        {
            var cashRegister = await _context.CashRegisters.FindAsync(id);
            if (cashRegister == null)
            {
                return NotFound(new { error = "Caja no encontrada" });
            }

            var now = DateTime.UtcNow;

            // Obtener todos los pedidos completados durante esta sesión de caja específica
            // Solo pedidos creados DESPUÉS de que se abrió esta caja y ANTES de que se cerró (o ahora si está abierta)
            // Incluir pedidos archivados que fueron completados durante esta sesión (fueron cobrados)
            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Items)
                .Where(o => o.CreatedAt >= cashRegister.OpenedAt  // Desde que se abrió esta caja
                    && (cashRegister.ClosedAt == null || o.CreatedAt <= cashRegister.ClosedAt.Value)  // Hasta que se cerró (o ahora si está abierta)
                    && o.Status == OrderConstants.STATUS_COMPLETED)
                    // Removido: && !o.IsArchived - Ahora incluimos pedidos archivados que fueron cobrados
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new
                {
                    id = o.Id,
                    customerName = o.CustomerName,
                    customerPhone = o.CustomerPhone,
                    tableId = o.TableId,
                    paymentMethod = o.PaymentMethod,
                    total = o.Total,
                    createdAt = o.CreatedAt,
                    itemsCount = o.Items.Count,
                    // Información de transacción POS (si aplica)
                    posTransactionId = o.POSTransactionId,
                    posTransactionIdString = o.POSTransactionIdString,
                    posTransactionDateTime = o.POSTransactionDateTime,
                    posResponse = o.POSResponse,
                    items = o.Items.Select(i => new
                    {
                        productName = i.ProductName,
                        quantity = i.Quantity,
                        unitPrice = i.UnitPrice,
                        subtotal = i.Subtotal
                    }).ToList()
                })
                .ToListAsync();

            // Agrupar por método de pago
            var byPaymentMethod = orders
                .GroupBy(o => o.paymentMethod ?? "unknown")
                .Select(g => new
                {
                    paymentMethod = g.Key,
                    count = g.Count(),
                    total = g.Sum(o => o.total)
                })
                .ToList();

            return Ok(new
            {
                cashRegister = new
                {
                    id = cashRegister.Id,
                    openedAt = cashRegister.OpenedAt,
                    closedAt = cashRegister.ClosedAt,
                    initialAmount = cashRegister.InitialAmount,
                    finalAmount = cashRegister.FinalAmount,
                    isOpen = cashRegister.IsOpen,
                    createdBy = cashRegister.CreatedBy,
                    closedBy = cashRegister.ClosedBy,
                    notes = cashRegister.Notes
                },
                orders,
                summary = new
                {
                    totalOrders = orders.Count,
                    totalSales = orders.Sum(o => o.total),
                    totalCash = orders.Where(o => o.paymentMethod?.ToLower() == PaymentConstants.METHOD_CASH.ToLower()).Sum(o => o.total),
                    totalPOS = orders.Where(o => o.paymentMethod?.ToLower() == PaymentConstants.METHOD_POS.ToLower()).Sum(o => o.total),
                    totalTransfer = orders.Where(o => o.paymentMethod?.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower()).Sum(o => o.total),
                    byPaymentMethod
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener movimientos de caja {CashRegisterId}", id);
            return StatusCode(500, new { error = "Error al obtener movimientos de la caja", details = ex.Message });
        }
    }
}

// DTOs
public class OpenCashRegisterRequest
{
    public decimal InitialAmount { get; set; }
}

public class CloseCashRegisterRequest
{
    public string? Notes { get; set; }
}

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
    }

    /// <summary>
    /// Obtiene el estado actual de la caja (si está abierta o cerrada)
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult> GetCashRegisterStatus()
    {
        try
        {
            var openCashRegister = await _context.CashRegisters
                .Where(c => c.IsOpen)
                .OrderByDescending(c => c.OpenedAt)
                .FirstOrDefaultAsync();

            if (openCashRegister == null)
            {
                return Ok(new { isOpen = false, cashRegister = (object?)null });
            }

            // Calcular totales desde los pedidos del día
            var today = openCashRegister.OpenedAt.Date;
            var orders = await _context.Orders
                .Where(o => o.CreatedAt >= today 
                    && o.Status == OrderConstants.STATUS_COMPLETED
                    && !o.IsArchived)
                .ToListAsync();

            var totalSales = orders.Sum(o => o.Total);
            var totalCash = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
                .Sum(o => o.Total);
            var totalPOS = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_POS.ToLower())
                .Sum(o => o.Total);
            var totalTransfer = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
                .Sum(o => o.Total);

            return Ok(new
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
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estado de caja");
            return StatusCode(500, new { error = "Error al obtener el estado de la caja", details = ex.Message });
        }
    }

    /// <summary>
    /// Abre una nueva sesión de caja
    /// </summary>
    [HttpPost("open")]
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
    /// Cierra la caja actual
    /// </summary>
    [HttpPost("close")]
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

            // Verificar que no haya mesas con pedidos pendientes
            var today = cashRegister.OpenedAt.Date;
            var pendingTableOrders = await _context.Orders
                .Where(o => o.TableId != null
                    && o.CreatedAt >= today
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

            // Calcular totales desde los pedidos del día
            var orders = await _context.Orders
                .Where(o => o.CreatedAt >= today
                    && o.Status == OrderConstants.STATUS_COMPLETED
                    && !o.IsArchived)
                .ToListAsync();

            var totalSales = orders.Sum(o => o.Total);
            var totalCash = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
                .Sum(o => o.Total);
            var totalPOS = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_POS.ToLower())
                .Sum(o => o.Total);
            var totalTransfer = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
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

using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para configuraciones y métodos de pago en administración
/// </summary>
[ApiController]
[Route("admin/api")]
[Tags("Administración - Configuraciones")]
[Authorize(Roles = "Admin")]
public class AdminSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminSettingsController> _logger;
    private readonly IAdminDashboardService _adminDashboardService;

    public AdminSettingsController(
        ApplicationDbContext context,
        ILogger<AdminSettingsController> logger,
        IAdminDashboardService adminDashboardService)
    {
        _context = context;
        _logger = logger;
        _adminDashboardService = adminDashboardService;
    }

    /// <summary>
    /// Obtiene todos los métodos de pago (Admin y Employee pueden ver)
    /// </summary>
    [HttpGet("payment-methods")]
    [Authorize(Roles = "Admin,Employee")] // Permitir a Employee ver métodos de pago
    public async Task<ActionResult> GetPaymentMethods()
    {
        await _adminDashboardService.EnsurePaymentMethodsExistAsync();

        var paymentMethods = await _context.PaymentMethods
            .AsNoTracking()
            .OrderBy(pm => pm.DisplayOrder)
            .Select(pm => new
            {
                pm.Id,
                pm.Name,
                pm.DisplayName,
                pm.Icon,
                pm.Description,
                pm.RequiresReceipt,
                pm.IsActive,
                pm.DisplayOrder,
                pm.BankName,
                pm.AccountNumber,
                pm.AccountHolder,
                pm.AccountType,
                pm.AccountAlias,
                pm.CreatedAt
            })
            .ToListAsync();

        return Ok(paymentMethods);
    }

    /// <summary>
    /// Crea un método de pago
    /// </summary>
    [HttpPost("payment-methods")]
    public async Task<ActionResult<PaymentMethod>> CreatePaymentMethod([FromBody] CreatePaymentMethodRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre interno es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.DisplayName))
            {
                return BadRequest(new { error = "El nombre para mostrar es requerido" });
            }

            var existing = await _context.PaymentMethods
                .AsNoTracking()
                .FirstOrDefaultAsync(pm => pm.Name != null && pm.Name.Equals(request.Name, StringComparison.OrdinalIgnoreCase));
            
            if (existing != null)
            {
                return BadRequest(new { error = "Ya existe un método con ese nombre" });
            }

            var paymentMethod = new PaymentMethod
            {
                Name = request.Name.ToLower().Trim(),
                DisplayName = request.DisplayName.Trim(),
                Icon = request.Icon?.Trim(),
                Description = request.Description?.Trim(),
                RequiresReceipt = request.RequiresReceipt,
                IsActive = request.IsActive ?? true,
                DisplayOrder = request.DisplayOrder ?? 0,
                BankName = request.BankName?.Trim(),
                AccountNumber = request.AccountNumber?.Trim(),
                AccountHolder = request.AccountHolder?.Trim(),
                AccountType = request.AccountType?.Trim(),
                AccountAlias = request.AccountAlias?.Trim(),
                CreatedAt = DateTime.UtcNow,
            };

            _context.PaymentMethods.Add(paymentMethod);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Método de pago creado: {PaymentMethodId}", paymentMethod.Id);

            return Ok(paymentMethod);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear método de pago");
            return StatusCode(500, new { error = "Error al crear el método de pago" });
        }
    }

    /// <summary>
    /// Actualiza un método de pago
    /// </summary>
    [HttpPut("payment-methods/{id}")]
    public async Task<ActionResult<PaymentMethod>> UpdatePaymentMethod(int id, [FromBody] UpdatePaymentMethodRequest request)
    {
        try
        {
            var paymentMethod = await _context.PaymentMethods.FindAsync(id);
            if (paymentMethod == null)
            {
                return NotFound(new { error = "Método de pago no encontrado" });
            }

            if (!string.IsNullOrWhiteSpace(request.Name) && paymentMethod.Name != null && 
                !request.Name.Equals(paymentMethod.Name, StringComparison.OrdinalIgnoreCase))
            {
                var existing = await _context.PaymentMethods
                    .AsNoTracking()
                    .FirstOrDefaultAsync(pm => pm.Name != null && 
                        pm.Name.Equals(request.Name, StringComparison.OrdinalIgnoreCase) && pm.Id != id);
                
                if (existing != null)
                {
                    return BadRequest(new { error = "Ya existe otro método con ese nombre" });
                }
                paymentMethod.Name = request.Name.ToLower().Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.DisplayName))
                paymentMethod.DisplayName = request.DisplayName.Trim();

            if (request.Icon != null)
                paymentMethod.Icon = request.Icon.Trim();

            if (request.Description != null)
                paymentMethod.Description = request.Description.Trim();

            if (request.RequiresReceipt.HasValue)
                paymentMethod.RequiresReceipt = request.RequiresReceipt.Value;

            if (request.IsActive.HasValue)
                paymentMethod.IsActive = request.IsActive.Value;

            if (request.DisplayOrder.HasValue)
                paymentMethod.DisplayOrder = request.DisplayOrder.Value;

            // Campos bancarios
            if (request.BankName != null)
                paymentMethod.BankName = request.BankName.Trim();

            if (request.AccountNumber != null)
                paymentMethod.AccountNumber = request.AccountNumber.Trim();

            if (request.AccountHolder != null)
                paymentMethod.AccountHolder = request.AccountHolder.Trim();

            if (request.AccountType != null)
                paymentMethod.AccountType = request.AccountType.Trim();

            if (request.AccountAlias != null)
                paymentMethod.AccountAlias = request.AccountAlias.Trim();

            paymentMethod.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Método de pago actualizado: {PaymentMethodId}", paymentMethod.Id);

            return Ok(paymentMethod);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar método de pago {PaymentMethodId}", id);
            return StatusCode(500, new { error = "Error al actualizar el método de pago" });
        }
    }

    /// <summary>
    /// Elimina un método de pago
    /// </summary>
    [HttpDelete("payment-methods/{id}")]
    public async Task<ActionResult> DeletePaymentMethod(int id)
    {
        try
        {
            var paymentMethod = await _context.PaymentMethods.FindAsync(id);
            if (paymentMethod == null)
            {
                return NotFound(new { error = "Método de pago no encontrado" });
            }

            var hasOrders = await _context.Orders
                .AsNoTracking()
                .AnyAsync(o => o.PaymentMethod == paymentMethod.Name);
            
            if (hasOrders)
            {
                paymentMethod.IsActive = false;
                paymentMethod.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Método de pago desactivado: {PaymentMethodId}", paymentMethod.Id);
                return Ok(new { message = "Método desactivado (tiene pedidos)", isActive = false });
            }

            _context.PaymentMethods.Remove(paymentMethod);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Método de pago eliminado: {PaymentMethodId}", paymentMethod.Id);

            return Ok(new { message = "Método de pago eliminado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar método de pago {PaymentMethodId}", id);
            return StatusCode(500, new { error = "Error al eliminar el método de pago" });
        }
    }
}

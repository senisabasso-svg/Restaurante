using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Constants;
using CornerApp.API.DTOs;

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
    /// Obtiene todos los repartidores (activos e inactivos)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetAllDeliveryPersons()
    {
        var deliveryPersons = await _context.DeliveryPersons
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
    /// Obtiene un repartidor por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetDeliveryPerson(int id)
    {
        var deliveryPerson = await _context.DeliveryPersons
            .Where(d => d.Id == id)
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

            // Verificar si el username ya existe
            var existingByUsername = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Username != null && d.Username.Equals(request.Username, StringComparison.OrdinalIgnoreCase));
            if (existingByUsername != null)
            {
                return BadRequest(new { error = "Este usuario ya existe" });
            }

            // Verificar si el email ya existe
            if (!string.IsNullOrWhiteSpace(request.Email))
            {
                var existingByEmail = await _context.DeliveryPersons
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.Email != null && d.Email.Equals(request.Email, StringComparison.OrdinalIgnoreCase));
                if (existingByEmail != null)
                {
                    return BadRequest(new { error = "Este email ya está registrado" });
                }
            }

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);
            var deliveryPerson = new DeliveryPerson
            {
                Name = request.Name,
                Phone = request.Phone ?? string.Empty,
                Email = !string.IsNullOrWhiteSpace(request.Email) ? request.Email.ToLower() : null,
                Username = request.Username.ToLower(),
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
        var deliveryPerson = await _context.DeliveryPersons.FindAsync(id);
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado" });
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
            var existingByEmail = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Email != null && d.Email.Equals(request.Email, StringComparison.OrdinalIgnoreCase) && d.Id != id);
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
            var existingByUsername = await _context.DeliveryPersons
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Username != null && d.Username.Equals(request.Username, StringComparison.OrdinalIgnoreCase) && d.Id != id);
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
        var deliveryPerson = await _context.DeliveryPersons.FindAsync(id);
        if (deliveryPerson == null)
        {
            return NotFound(new { error = "Repartidor no encontrado" });
        }

        // Verificar si tiene pedidos asignados
        var hasOrders = await _context.Orders
            .AsNoTracking()
            .AnyAsync(o => o.DeliveryPersonId == id && !o.IsArchived && 
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
        var total = await _context.DeliveryPersons.CountAsync();
        var active = await _context.DeliveryPersons.CountAsync(d => d.IsActive);
        
        var activeOrdersByPerson = await _context.Orders
            .Where(o => o.DeliveryPersonId.HasValue && !o.IsArchived && 
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
}

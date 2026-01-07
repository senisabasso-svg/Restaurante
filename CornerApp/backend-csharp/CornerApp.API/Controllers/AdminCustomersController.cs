using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Constants;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de clientes en administración
/// </summary>
[ApiController]
[Route("admin/api/customers")]
[Tags("Administración - Clientes")]
[Authorize(Roles = "Admin")]
public class AdminCustomersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminCustomersController> _logger;

    public AdminCustomersController(
        ApplicationDbContext context,
        ILogger<AdminCustomersController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los clientes con paginación
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetCustomers(
        [FromQuery] string sortBy = "createdAt",
        [FromQuery] string sortOrder = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string search = "")
    {
        try
        {
            var query = _context.Customers
                .AsNoTracking()
                .Include(c => c.Orders)
                .AsQueryable();
            
            // Filtro de búsqueda
            if (!string.IsNullOrWhiteSpace(search))
            {
                var searchLower = search.Trim().ToLowerInvariant();
                query = query.Where(c => 
                    (c.Name != null && c.Name.Contains(searchLower, StringComparison.OrdinalIgnoreCase)) ||
                    (c.Phone != null && c.Phone.Contains(searchLower, StringComparison.OrdinalIgnoreCase)) ||
                    (c.Email != null && c.Email.Contains(searchLower, StringComparison.OrdinalIgnoreCase)) ||
                    (c.DefaultAddress != null && c.DefaultAddress.Contains(searchLower, StringComparison.OrdinalIgnoreCase))
                );
            }
            
            // Ordenamiento
            query = sortBy.ToLower() switch
            {
                "name" => sortOrder == "asc" ? query.OrderBy(c => c.Name) : query.OrderByDescending(c => c.Name),
                "points" => sortOrder == "asc" ? query.OrderBy(c => c.Points) : query.OrderByDescending(c => c.Points),
                "orders" => sortOrder == "asc" ? query.OrderBy(c => c.Orders.Count) : query.OrderByDescending(c => c.Orders.Count),
                _ => sortOrder == "asc" ? query.OrderBy(c => c.CreatedAt) : query.OrderByDescending(c => c.CreatedAt)
            };

            var totalCount = await query.CountAsync();

            var customers = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.Email,
                    c.Phone,
                    c.DefaultAddress,
                    c.Points,
                    c.CreatedAt,
                    OrdersCount = c.Orders.Count,
                    TotalSpent = c.Orders
                        .Where(o => o.Status == OrderConstants.STATUS_COMPLETED && !o.IsArchived)
                        .Sum(o => o.Total)
                })
                .ToListAsync();

            return Ok(new
            {
                data = customers,
                totalCount,
                page,
                pageSize,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cargar clientes");
            return StatusCode(500, new { error = "Error al cargar clientes" });
        }
    }

    /// <summary>
    /// Obtiene un cliente por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetCustomer(int id)
    {
        var customer = await _context.Customers
            .AsNoTracking()
            .Include(c => c.Orders)
            .Where(c => c.Id == id)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Email,
                c.Phone,
                c.DefaultAddress,
                c.Points,
                c.CreatedAt,
                c.UpdatedAt,
                OrdersCount = c.Orders.Count,
                TotalSpent = c.Orders
                    .Where(o => o.Status == OrderConstants.STATUS_COMPLETED && !o.IsArchived)
                    .Sum(o => o.Total),
                RecentOrders = c.Orders
                    .OrderByDescending(o => o.CreatedAt)
                    .Take(5)
                    .Select(o => new
                    {
                        o.Id,
                        o.Status,
                        o.Total,
                        o.CreatedAt
                    })
            })
            .FirstOrDefaultAsync();

        if (customer == null)
        {
            return NotFound(new { error = "Cliente no encontrado" });
        }

        return Ok(customer);
    }

    /// <summary>
    /// Elimina un cliente
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCustomer(int id)
    {
        try
        {
            var customer = await _context.Customers
                .Include(c => c.Orders)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (customer == null)
            {
                return NotFound(new { error = "Cliente no encontrado" });
            }

            if (customer.Orders.Any())
            {
                return BadRequest(new { 
                    error = "No se puede eliminar: tiene pedidos asociados" 
                });
            }

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Cliente eliminado: {CustomerId}", customer.Id);

            return Ok(new { message = "Cliente eliminado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar cliente {CustomerId}", id);
            return StatusCode(500, new { error = "Error al eliminar el cliente" });
        }
    }

    /// <summary>
    /// Obtiene estadísticas de clientes
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        var totalCustomers = await _context.Customers.CountAsync();
        var totalPoints = await _context.Customers.SumAsync(c => c.Points);
        var customersWithOrders = await _context.Customers
            .CountAsync(c => c.Orders.Any());
        var topCustomers = await _context.Customers
            .AsNoTracking()
            .Include(c => c.Orders)
            .OrderByDescending(c => c.Orders.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).Sum(o => o.Total))
            .Take(5)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Points,
                TotalSpent = c.Orders
                    .Where(o => o.Status == OrderConstants.STATUS_COMPLETED)
                    .Sum(o => o.Total)
            })
            .ToListAsync();

        return Ok(new
        {
            totalCustomers,
            totalPoints,
            customersWithOrders,
            topCustomers
        });
    }
}

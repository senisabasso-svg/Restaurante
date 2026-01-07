using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/customers")]
[Tags("Clientes")]
public class CustomersController : ControllerBase
{
    private readonly ILogger<CustomersController> _logger;
    private readonly ApplicationDbContext _context;

    public CustomersController(ILogger<CustomersController> logger, ApplicationDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    /// <summary>
    /// Obtiene todos los clientes con paginación
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResponse<Customer>>> GetCustomers(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        var query = _context.Customers
            .Include(c => c.Orders)
            .OrderByDescending(c => c.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(query, normalizedPage, normalizedPageSize);

        _logger.LogInformation("Obtenidos {Count} clientes de {Total} (página {Page})", 
            pagedResponse.Data.Count, pagedResponse.TotalCount, normalizedPage);

        return Ok(pagedResponse);
    }

    /// <summary>
    /// Obtiene un cliente por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Customer>> GetCustomer(int id)
    {
        var customer = await _context.Customers
            .Include(c => c.Orders.OrderByDescending(o => o.CreatedAt))
            .FirstOrDefaultAsync(c => c.Id == id);

        if (customer == null)
        {
            return NotFound();
        }

        return Ok(customer);
    }

    /// <summary>
    /// Busca un cliente por teléfono o email
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<Customer>> SearchCustomer([FromQuery] string? phone, [FromQuery] string? email)
    {
        var query = _context.Customers.AsQueryable();

        if (!string.IsNullOrEmpty(phone))
        {
            query = query.Where(c => c.Phone == phone);
        }

        if (!string.IsNullOrEmpty(email))
        {
            query = query.Where(c => c.Email == email);
        }

        var customer = await query.FirstOrDefaultAsync();

        if (customer == null)
        {
            return NotFound();
        }

        return Ok(customer);
    }

    /// <summary>
    /// Crea un nuevo cliente
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Customer>> CreateCustomer([FromBody] CreateCustomerRequest request)
    {
        try
        {
            // Verificar si ya existe un cliente con el mismo teléfono o email
            var existingCustomer = await _context.Customers
                .FirstOrDefaultAsync(c => c.Phone == request.Phone || c.Email == request.Email);

            if (existingCustomer != null)
            {
                // Actualizar cliente existente
                existingCustomer.Name = request.Name;
                existingCustomer.Email = request.Email;
                existingCustomer.Phone = request.Phone;
                existingCustomer.DefaultAddress = request.DefaultAddress;
                existingCustomer.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Ok(existingCustomer);
            }

            var customer = new Customer
            {
                Name = request.Name,
                Phone = request.Phone,
                Email = request.Email,
                DefaultAddress = request.DefaultAddress,
                CreatedAt = DateTime.UtcNow
            };

            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear cliente");
            return StatusCode(500, new { error = "Error al crear el cliente", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el historial de pedidos de un cliente con paginación
    /// </summary>
    [HttpGet("{id}/orders")]
    public async Task<ActionResult<PagedResponse<Order>>> GetCustomerOrders(
        int id,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        var customer = await _context.Customers.FindAsync(id);
        if (customer == null)
        {
            return NotFound();
        }

        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        var query = _context.Orders
            .Where(o => o.CustomerId == id)
            .Include(o => o.Items)
            .OrderByDescending(o => o.CreatedAt);

        var pagedResponse = await PaginationHelper.ToPagedResponseAsync(query, normalizedPage, normalizedPageSize);

        _logger.LogInformation("Obtenidos {Count} pedidos del cliente {CustomerId} de {Total} (página {Page})", 
            pagedResponse.Data.Count, id, pagedResponse.TotalCount, normalizedPage);

        return Ok(pagedResponse);
    }
}



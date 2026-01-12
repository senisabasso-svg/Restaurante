using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de productos en administración
/// </summary>
[ApiController]
[Route("admin/api/products")]
[Tags("Administración - Productos")]
[Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden ver productos
public class AdminProductsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminProductsController> _logger;
    private readonly IAdminDashboardService _adminDashboardService;

    public AdminProductsController(
        ApplicationDbContext context,
        ILogger<AdminProductsController> logger,
        IAdminDashboardService adminDashboardService)
    {
        _context = context;
        _logger = logger;
        _adminDashboardService = adminDashboardService;
    }

    /// <summary>
    /// Obtiene todos los productos
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetProducts()
    {
        var products = await _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .OrderBy(p => p.DisplayOrder)
            .ThenBy(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                p.Image,
                p.CategoryId,
                Category = p.Category != null ? p.Category.Name : "",
                CategoryIcon = p.Category != null ? p.Category.Icon : "",
                p.IsAvailable,
                p.DisplayOrder,
                p.CreatedAt
            })
            .ToListAsync();

        return Ok(products);
    }

    /// <summary>
    /// Obtiene un producto por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetProduct(int id)
    {
        var product = await _context.Products
            .AsNoTracking()
            .Include(p => p.Category)
            .Where(p => p.Id == id)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.Price,
                p.Image,
                p.CategoryId,
                Category = p.Category != null ? p.Category.Name : "",
                p.IsAvailable,
                p.DisplayOrder,
                p.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (product == null)
        {
            return NotFound(new { error = "Producto no encontrado" });
        }

        return Ok(product);
    }

    /// <summary>
    /// Crea un nuevo producto
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Product>> CreateProduct([FromBody] CreateProductRequest request)
    {
        try
        {
            if (request == null)
            {
                return BadRequest(new { error = "El request no puede ser nulo" });
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre del producto es requerido" });
            }

            if (request.Price <= 0)
            {
                return BadRequest(new { error = "El precio debe ser mayor a 0" });
            }

            if (request.CategoryId <= 0)
            {
                return BadRequest(new { error = "Debe seleccionar una categoría válida" });
            }

            var product = await _adminDashboardService.CreateProductAsync(
                request.Name,
                request.Description,
                request.Price,
                request.Image,
                request.CategoryId,
                request.DisplayOrder,
                request.IsAvailable);

            return Ok(new
            {
                id = product.Id,
                name = product.Name,
                description = product.Description,
                price = product.Price,
                image = product.Image,
                categoryId = product.CategoryId,
                category = product.Category?.Name ?? "",
                isAvailable = product.IsAvailable,
                displayOrder = product.DisplayOrder
            });
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear producto");
            return StatusCode(500, new { error = "Error al crear el producto" });
        }
    }

    /// <summary>
    /// Actualiza un producto
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Product>> UpdateProduct(int id, [FromBody] UpdateProductRequest request)
    {
        try
        {
            var product = await _adminDashboardService.UpdateProductAsync(
                id,
                request.Name,
                request.Description,
                request.Price,
                request.Image,
                request.CategoryId,
                request.DisplayOrder,
                request.IsAvailable);

            return Ok(new
            {
                id = product.Id,
                name = product.Name,
                description = product.Description,
                price = product.Price,
                image = product.Image,
                categoryId = product.CategoryId,
                category = product.Category?.Name ?? "",
                isAvailable = product.IsAvailable,
                displayOrder = product.DisplayOrder
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar producto");
            return StatusCode(500, new { error = "Error al actualizar el producto" });
        }
    }

    /// <summary>
    /// Elimina un producto
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteProduct(int id)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return NotFound(new { error = "Producto no encontrado" });
            }

            _context.Products.Remove(product);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Producto eliminado: {ProductId}", id);
            return Ok(new { message = "Producto eliminado" });
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Error al eliminar producto {ProductId}", id);
            
            var innerMessage = dbEx.InnerException?.Message ?? "";
            if (innerMessage.Contains("FOREIGN KEY") || innerMessage.Contains("OrderItems"))
            {
                return BadRequest(new { error = "No se puede eliminar: está en pedidos existentes" });
            }
            
            return StatusCode(500, new { error = "Error al eliminar el producto" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar producto {ProductId}", id);
            return StatusCode(500, new { error = "Error al eliminar el producto" });
        }
    }

    /// <summary>
    /// Cambia la disponibilidad de un producto
    /// </summary>
    [HttpPatch("{id}/availability")]
    public async Task<ActionResult> ToggleAvailability(int id, [FromBody] bool isAvailable)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            return NotFound(new { error = "Producto no encontrado" });
        }

        product.IsAvailable = isAvailable;
        product.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { id = product.Id, isAvailable = product.IsAvailable });
    }
}

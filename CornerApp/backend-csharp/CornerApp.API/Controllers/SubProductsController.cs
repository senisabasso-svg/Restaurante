using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de subproductos (guarniciones)
/// </summary>
[ApiController]
[Route("admin/api/subproducts")]
[Tags("Administración - SubProductos")]
[Authorize(Roles = "Admin")]
public class SubProductsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SubProductsController> _logger;

    public SubProductsController(
        ApplicationDbContext context,
        ILogger<SubProductsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los subproductos de un producto específico
    /// </summary>
    [HttpGet("product/{productId}")]
    public async Task<ActionResult> GetSubProductsByProduct(int productId)
    {
        var subProducts = await _context.SubProducts
            .AsNoTracking()
            .Where(sp => sp.ProductId == productId)
            .OrderBy(sp => sp.DisplayOrder)
            .ThenBy(sp => sp.Name)
            .Select(sp => new
            {
                sp.Id,
                sp.Name,
                sp.Description,
                sp.Price,
                sp.ProductId,
                sp.DisplayOrder,
                sp.IsAvailable,
                sp.CreatedAt,
                sp.UpdatedAt
            })
            .ToListAsync();

        return Ok(subProducts);
    }

    /// <summary>
    /// Obtiene un subproducto por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetSubProduct(int id)
    {
        var subProduct = await _context.SubProducts
            .AsNoTracking()
            .Where(sp => sp.Id == id)
            .Select(sp => new
            {
                sp.Id,
                sp.Name,
                sp.Description,
                sp.Price,
                sp.ProductId,
                sp.DisplayOrder,
                sp.IsAvailable,
                sp.CreatedAt,
                sp.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (subProduct == null)
        {
            return NotFound(new { error = "Subproducto no encontrado" });
        }

        return Ok(subProduct);
    }

    /// <summary>
    /// Crea un nuevo subproducto
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SubProduct>> CreateSubProduct([FromBody] CreateSubProductRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre del subproducto es requerido" });
            }

            // Verificar que el producto existe
            var product = await _context.Products.FindAsync(request.ProductId);
            if (product == null)
            {
                return NotFound(new { error = "El producto especificado no existe" });
            }

            var subProduct = new SubProduct
            {
                Name = request.Name.Trim(),
                Description = request.Description?.Trim(),
                Price = request.Price,
                ProductId = request.ProductId,
                DisplayOrder = request.DisplayOrder,
                IsAvailable = request.IsAvailable,
                CreatedAt = DateTime.UtcNow
            };

            _context.SubProducts.Add(subProduct);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Subproducto creado: {SubProductId} - {SubProductName} para Producto {ProductId}", 
                subProduct.Id, subProduct.Name, request.ProductId);

            return Ok(new
            {
                id = subProduct.Id,
                name = subProduct.Name,
                description = subProduct.Description,
                price = subProduct.Price,
                productId = subProduct.ProductId,
                displayOrder = subProduct.DisplayOrder,
                isAvailable = subProduct.IsAvailable,
                createdAt = subProduct.CreatedAt
            });
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Error de base de datos al crear subproducto");
            var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;
            if (innerMessage.Contains("SubProducts") || innerMessage.Contains("table") || innerMessage.Contains("no existe"))
            {
                return StatusCode(500, new { 
                    error = "La tabla SubProducts no existe en la base de datos. Por favor, reinicia el backend para crear la tabla automáticamente.",
                    details = innerMessage 
                });
            }
            return StatusCode(500, new { error = "Error al crear el subproducto", details = innerMessage });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear subproducto");
            return StatusCode(500, new { error = "Error al crear el subproducto", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza un subproducto
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<SubProduct>> UpdateSubProduct(int id, [FromBody] UpdateSubProductRequest request)
    {
        try
        {
            var subProduct = await _context.SubProducts.FindAsync(id);
            if (subProduct == null)
            {
                return NotFound(new { error = "Subproducto no encontrado" });
            }

            // Si se cambia el ProductId, verificar que el nuevo producto existe
            if (request.ProductId.HasValue && request.ProductId.Value != subProduct.ProductId)
            {
                var product = await _context.Products.FindAsync(request.ProductId.Value);
                if (product == null)
                {
                    return NotFound(new { error = "El producto especificado no existe" });
                }
                subProduct.ProductId = request.ProductId.Value;
            }

            if (request.Name != null)
            {
                subProduct.Name = request.Name.Trim();
            }

            if (request.Description != null)
            {
                subProduct.Description = request.Description.Trim();
            }

            if (request.Price.HasValue)
            {
                subProduct.Price = request.Price.Value;
            }

            if (request.DisplayOrder.HasValue)
            {
                subProduct.DisplayOrder = request.DisplayOrder.Value;
            }

            if (request.IsAvailable.HasValue)
            {
                subProduct.IsAvailable = request.IsAvailable.Value;
            }

            subProduct.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Subproducto actualizado: {SubProductId}", subProduct.Id);

            return Ok(new
            {
                id = subProduct.Id,
                name = subProduct.Name,
                description = subProduct.Description,
                price = subProduct.Price,
                productId = subProduct.ProductId,
                displayOrder = subProduct.DisplayOrder,
                isAvailable = subProduct.IsAvailable,
                createdAt = subProduct.CreatedAt,
                updatedAt = subProduct.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar subproducto {SubProductId}", id);
            return StatusCode(500, new { error = "Error al actualizar el subproducto", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina un subproducto
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteSubProduct(int id)
    {
        try
        {
            var subProduct = await _context.SubProducts.FindAsync(id);
            if (subProduct == null)
            {
                return NotFound(new { error = "Subproducto no encontrado" });
            }

            _context.SubProducts.Remove(subProduct);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Subproducto eliminado: {SubProductId}", id);
            return Ok(new { message = "Subproducto eliminado correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar subproducto {SubProductId}", id);
            return StatusCode(500, new { error = "Error al eliminar el subproducto", details = ex.Message });
        }
    }
}


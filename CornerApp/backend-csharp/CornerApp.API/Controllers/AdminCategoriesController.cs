using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de categorías en administración
/// </summary>
[ApiController]
[Route("admin/api/categories")]
[Tags("Administración - Categorías")]
[Authorize(Roles = "Admin,Employee")] // Admin y Employee pueden ver categorías
public class AdminCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminCategoriesController> _logger;
    private readonly IAdminDashboardService _adminDashboardService;

    public AdminCategoriesController(
        ApplicationDbContext context,
        ILogger<AdminCategoriesController> logger,
        IAdminDashboardService adminDashboardService)
    {
        _context = context;
        _logger = logger;
        _adminDashboardService = adminDashboardService;
    }

    /// <summary>
    /// Endpoint público para mozos: Obtiene todas las categorías activas (sin autenticación)
    /// </summary>
    [HttpGet("waiter")]
    [AllowAnonymous]
    public async Task<ActionResult> GetCategoriesForWaiter()
    {
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                description = c.Description,
                icon = c.Icon,
                displayOrder = c.DisplayOrder,
                isActive = c.IsActive
            })
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Obtiene todas las categorías
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetCategories()
    {
        await _adminDashboardService.EnsureCategoriesExistAsync();

        var categories = await _context.Categories
            .AsNoTracking()
            .OrderBy(c => c.DisplayOrder)
            .ThenBy(c => c.IsActive ? 0 : 1)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Icon,
                c.DisplayOrder,
                c.IsActive,
                c.CreatedAt,
                ProductsCount = c.Products.Count
            })
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Obtiene una categoría por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetCategory(int id)
    {
        var category = await _context.Categories
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Icon,
                c.DisplayOrder,
                c.IsActive,
                c.CreatedAt,
                ProductsCount = c.Products.Count
            })
            .FirstOrDefaultAsync();

        if (category == null)
        {
            return NotFound(new { error = "Categoría no encontrada" });
        }

        return Ok(category);
    }

    /// <summary>
    /// Crea una nueva categoría
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Category>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre de la categoría es requerido" });
            }

            var category = await _adminDashboardService.CreateCategoryAsync(
                request.Name, 
                request.Description, 
                request.Icon);

            return Ok(new
            {
                id = category.Id,
                name = category.Name,
                description = category.Description,
                icon = category.Icon,
                displayOrder = category.DisplayOrder,
                isActive = category.IsActive
            });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear categoría");
            return StatusCode(500, new { error = "Error al crear la categoría" });
        }
    }

    /// <summary>
    /// Actualiza una categoría
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Category>> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        try
        {
            var category = await _adminDashboardService.UpdateCategoryAsync(
                id,
                request.Name,
                request.Description,
                request.Icon,
                request.DisplayOrder,
                request.IsActive);

            return Ok(new
            {
                id = category.Id,
                name = category.Name,
                description = category.Description,
                icon = category.Icon,
                displayOrder = category.DisplayOrder,
                isActive = category.IsActive
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar categoría");
            return StatusCode(500, new { error = "Error al actualizar la categoría" });
        }
    }

    /// <summary>
    /// Elimina una categoría (soft delete si tiene productos)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCategory(int id)
    {
        try
        {
            var category = await _context.Categories
                .Include(c => c.Products)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            var productsCount = await _context.Products
                .AsNoTracking()
                .CountAsync(p => p.CategoryId == id);

            if (productsCount > 0)
            {
                category.IsActive = false;
                await _context.SaveChangesAsync();
                _logger.LogInformation("Categoría desactivada: {CategoryId}", category.Id);
                return Ok(new { message = "Categoría desactivada (tiene productos)", isActive = false });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Categoría eliminada: {CategoryId}", category.Id);
            return Ok(new { message = "Categoría eliminada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría" });
        }
    }

    /// <summary>
    /// Elimina permanentemente una categoría
    /// </summary>
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteCategoryPermanent(int id)
    {
        try
        {
            var category = await _context.Categories.FirstOrDefaultAsync(c => c.Id == id);

            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            var productsCount = await _context.Products
                .AsNoTracking()
                .CountAsync(p => p.CategoryId == id);

            if (productsCount > 0)
            {
                return BadRequest(new { error = $"No se puede eliminar: tiene {productsCount} producto(s)" });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Categoría eliminada permanentemente: {CategoryId}", category.Id);
            return Ok(new { message = "Categoría eliminada permanentemente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría" });
        }
    }
}

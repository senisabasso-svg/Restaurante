using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;

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
    private readonly ICacheService? _cache;

    public AdminCategoriesController(
        ApplicationDbContext context,
        ILogger<AdminCategoriesController> logger,
        IAdminDashboardService adminDashboardService,
        ICacheService? cache = null)
    {
        _context = context;
        _logger = logger;
        _adminDashboardService = adminDashboardService;
        _cache = cache;
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
    /// Obtiene todas las categorías del restaurante del usuario autenticado
    /// </summary>
    [HttpGet]
    public async Task<ActionResult> GetCategories()
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        // Nota: EnsureCategoriesExistAsync no se usa aquí porque cada restaurante debe crear sus propias categorías

        // IMPORTANTE: Solo devolver categorías que tengan RestaurantId válido y coincida con el del usuario
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.RestaurantId == restaurantId && c.RestaurantId > 0)
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
                ProductsCount = c.Products.Count(p => p.RestaurantId == restaurantId)
            })
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Obtiene una categoría por ID (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> GetCategory(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        var category = await _context.Categories
            .AsNoTracking()
            .Where(c => c.Id == id && c.RestaurantId == restaurantId)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                c.Icon,
                c.DisplayOrder,
                c.IsActive,
                c.CreatedAt,
                ProductsCount = c.Products.Count(p => p.RestaurantId == restaurantId)
            })
            .FirstOrDefaultAsync();

        if (category == null)
        {
            return NotFound(new { error = "Categoría no encontrada" });
        }

        return Ok(category);
    }

    /// <summary>
    /// Crea una nueva categoría (asignada automáticamente al restaurante del usuario)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Category>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre de la categoría es requerido" });
            }

            // Verificar que no exista una categoría con el mismo nombre en el mismo restaurante
            var existingCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Name.ToLower() == request.Name.ToLower().Trim() && c.RestaurantId == restaurantId);
            
            if (existingCategory != null)
            {
                return BadRequest(new { error = "Ya existe una categoría con ese nombre en tu restaurante" });
            }

            var category = await _adminDashboardService.CreateCategoryAsync(
                restaurantId,
                request.Name, 
                request.Description, 
                request.Icon);

            // Invalidar caché de categorías para que se refleje inmediatamente (usar clave específica por restaurante)
            if (_cache != null)
            {
                var cacheKey = $"categories_list_{restaurantId}";
                await _cache.RemoveAsync(cacheKey);
                await _cache.RemoveAsync($"products_list_{restaurantId}");
            }

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
    /// Actualiza una categoría (solo del restaurante del usuario)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Category>> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            // Verificar que la categoría pertenezca al restaurante del usuario
            var existingCategory = await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
            
            if (existingCategory == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            // Si se está cambiando el nombre, verificar que no exista otra categoría con ese nombre en el mismo restaurante
            if (!string.IsNullOrWhiteSpace(request.Name) && request.Name.Trim().ToLower() != existingCategory.Name.ToLower())
            {
                var duplicateCategory = await _context.Categories
                    .FirstOrDefaultAsync(c => c.Name.ToLower() == request.Name.ToLower().Trim() && 
                                             c.RestaurantId == restaurantId && 
                                             c.Id != id);
                
                if (duplicateCategory != null)
                {
                    return BadRequest(new { error = "Ya existe una categoría con ese nombre en tu restaurante" });
                }
            }

            var category = await _adminDashboardService.UpdateCategoryAsync(
                id,
                restaurantId,
                request.Name,
                request.Description,
                request.Icon,
                request.DisplayOrder,
                request.IsActive);

            // Invalidar caché de categorías para que se refleje inmediatamente (usar clave específica por restaurante)
            if (_cache != null)
            {
                var cacheKey = $"categories_list_{restaurantId}";
                await _cache.RemoveAsync(cacheKey);
                await _cache.RemoveAsync($"products_list_{restaurantId}");
            }

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
    /// Elimina una categoría (soft delete si tiene productos) - solo del restaurante del usuario
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCategory(int id)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .Include(c => c.Products)
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);

            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            var productsCount = await _context.Products
                .AsNoTracking()
                .CountAsync(p => p.CategoryId == id && p.RestaurantId == restaurantId);

            if (productsCount > 0)
            {
                category.IsActive = false;
                await _context.SaveChangesAsync();
                
                // Invalidar caché de categorías
                if (_cache != null)
                {
                    await _cache.RemoveAsync("categories_list");
                    await _cache.RemoveAsync("products_list");
                }
                
                _logger.LogInformation("Categoría desactivada: {CategoryId} del restaurante {RestaurantId}", category.Id, restaurantId);
                return Ok(new { message = "Categoría desactivada (tiene productos)", isActive = false });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();
            
            // Invalidar caché de categorías (usar clave específica por restaurante)
            if (_cache != null)
            {
                var cacheKey = $"categories_list_{restaurantId}";
                await _cache.RemoveAsync(cacheKey);
                await _cache.RemoveAsync($"products_list_{restaurantId}");
            }
            
            _logger.LogInformation("Categoría eliminada: {CategoryId} del restaurante {RestaurantId}", category.Id, restaurantId);
            return Ok(new { message = "Categoría eliminada" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría" });
        }
    }

    /// <summary>
    /// Elimina permanentemente una categoría (solo del restaurante del usuario)
    /// </summary>
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteCategoryPermanent(int id)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);

            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            var productsCount = await _context.Products
                .AsNoTracking()
                .CountAsync(p => p.CategoryId == id && p.RestaurantId == restaurantId);

            if (productsCount > 0)
            {
                return BadRequest(new { error = $"No se puede eliminar: tiene {productsCount} producto(s)" });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Categoría eliminada permanentemente: {CategoryId} del restaurante {RestaurantId}", category.Id, restaurantId);
            return Ok(new { message = "Categoría eliminada permanentemente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría" });
        }
    }
}

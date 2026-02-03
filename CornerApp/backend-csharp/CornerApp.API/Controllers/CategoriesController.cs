using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using CornerApp.API.Models;
using CornerApp.API.Data;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;
using CornerApp.API.Services;

namespace CornerApp.API.Controllers;

[ApiController]
[Route("api/categories")]
[Tags("Categorías")]
public class CategoriesController : ControllerBase
{
    private readonly ILogger<CategoriesController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cache;
    private readonly IMetricsService? _metricsService;
    private const string CATEGORIES_CACHE_KEY = "categories_list";
    private static readonly TimeSpan CACHE_DURATION = TimeSpan.FromMinutes(10);

    public CategoriesController(ILogger<CategoriesController> logger, ApplicationDbContext context, ICacheService cache, IMetricsService? metricsService = null)
    {
        _logger = logger;
        _context = context;
        _cache = cache;
        _metricsService = metricsService;
    }

    /// <summary>
    /// Obtiene todas las categorías activas del restaurante del usuario autenticado
    /// </summary>
    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)] // Deshabilitar ResponseCache para evitar problemas con multi-tenant
    public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
    {
        // Obtener RestaurantId del usuario autenticado
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        // Usar una clave de cache específica por restaurante
        var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
        
        // Intentar obtener del cache primero
        var cachedCategories = await _cache.GetAsync<List<Category>>(cacheKey);
        if (cachedCategories != null)
        {
            // Generar ETag también para respuestas desde cache
            var cachedETag = ETagHelper.GenerateETag(cachedCategories);
            var clientETag = Request.Headers["If-None-Match"].ToString();
            if (!string.IsNullOrEmpty(clientETag) && ETagHelper.IsETagValid(clientETag, cachedETag))
            {
                _logger.LogInformation("Categorías no han cambiado (ETag match desde cache) para restaurante {RestaurantId}: {Count}", restaurantId, cachedCategories.Count);
                return StatusCode(304); // Not Modified
            }
            Response.Headers.Append("ETag", cachedETag);
            _logger.LogInformation("Categorías obtenidas del cache para restaurante {RestaurantId}: {Count}", restaurantId, cachedCategories.Count);
            return Ok(cachedCategories);
        }
        
        // Registrar cache miss
        _metricsService?.RecordCacheMiss(cacheKey);

        // Usar AsNoTracking para operaciones de solo lectura (mejor performance)
        // No incluir Products para evitar problemas de serialización y mejorar performance
        // Filtrar por RestaurantId para multi-tenant
        // IMPORTANTE: Solo devolver categorías que tengan RestaurantId válido y coincida con el del usuario
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.IsActive && 
                       c.RestaurantId == restaurantId && 
                       c.RestaurantId > 0) // Asegurar que RestaurantId sea válido
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();
        
        // Guardar en cache con clave específica por restaurante
        await _cache.SetAsync(cacheKey, categories, CACHE_DURATION);

        // Generar ETag
        var etag = ETagHelper.GenerateETag(categories);
        
        // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
        var clientETag = Request.Headers["If-None-Match"].ToString();
        if (!string.IsNullOrEmpty(clientETag) && ETagHelper.IsETagValid(clientETag, etag))
        {
            _logger.LogInformation("Categorías no han cambiado (ETag match) para restaurante {RestaurantId}: {Count}", restaurantId, categories.Count);
            return StatusCode(304); // Not Modified
        }

        // Agregar ETag al header de respuesta
        Response.Headers.Append("ETag", etag);

        _logger.LogInformation("Categorías obtenidas de BD y guardadas en cache para restaurante {RestaurantId}: {Count}", restaurantId, categories.Count);
        return Ok(categories);
    }

    /// <summary>
    /// Obtiene una categoría por ID (solo del restaurante del usuario)
    /// </summary>
    [HttpGet("{id}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)] // Deshabilitar ResponseCache para evitar problemas con multi-tenant
    public async Task<ActionResult<Category>> GetCategory(int id)
    {
        var restaurantId = RestaurantHelper.GetRestaurantId(User);
        
        // Usar AsNoTracking para operaciones de solo lectura
        // No incluir Products para evitar problemas de serialización
        // Filtrar por RestaurantId para multi-tenant
        var category = await _context.Categories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);

        if (category == null)
        {
            return NotFound();
        }

        // Generar ETag
        var etag = ETagHelper.GenerateETag(category);
        
        // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
        var clientETag = Request.Headers["If-None-Match"].ToString();
        if (!string.IsNullOrEmpty(clientETag) && ETagHelper.IsETagValid(clientETag, etag))
        {
            _logger.LogInformation("Categoría no ha cambiado (ETag match): {CategoryId}", category.Id);
            return StatusCode(304); // Not Modified
        }

        // Agregar ETag al header de respuesta
        Response.Headers.Append("ETag", etag);

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
            
            var category = new Category
            {
                RestaurantId = restaurantId,
                Name = request.Name,
                Description = request.Description,
                Icon = request.Icon,
                DisplayOrder = request.DisplayOrder,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos para este restaurante
            var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
            await _cache.RemoveAsync(cacheKey);
            await _cache.RemoveAsync($"products_list_{restaurantId}");

            _logger.LogInformation("Categoría creada: {CategoryId} - {CategoryName}", category.Id, category.Name);
            return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear categoría");
            return StatusCode(500, new { error = "Error al crear la categoría", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza una categoría completa (solo del restaurante del usuario)
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Category>> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
            
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada o no pertenece a tu restaurante" });
            }

            category.Name = request.Name ?? category.Name;
            category.Description = request.Description ?? category.Description;
            category.Icon = request.Icon ?? category.Icon;
            category.DisplayOrder = request.DisplayOrder ?? category.DisplayOrder;
            category.IsActive = request.IsActive ?? category.IsActive;

            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos para este restaurante
            var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
            await _cache.RemoveAsync(cacheKey);
            await _cache.RemoveAsync($"products_list_{restaurantId}");

            _logger.LogInformation("Categoría actualizada: {CategoryId}", category.Id);
            return Ok(category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al actualizar la categoría", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza parcialmente una categoría (solo del restaurante del usuario)
    /// </summary>
    [HttpPatch("{id}")]
    public async Task<ActionResult<Category>> PatchCategory(int id, [FromBody] PatchCategoryRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
            
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada o no pertenece a tu restaurante" });
            }

            if (request.Name != null) category.Name = request.Name;
            if (request.Description != null) category.Description = request.Description;
            if (request.Icon != null) category.Icon = request.Icon;
            if (request.DisplayOrder.HasValue) category.DisplayOrder = request.DisplayOrder.Value;
            if (request.IsActive.HasValue) category.IsActive = request.IsActive.Value;

            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos para este restaurante
            var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
            await _cache.RemoveAsync(cacheKey);
            await _cache.RemoveAsync($"products_list_{restaurantId}");

            _logger.LogInformation("Categoría actualizada (patch): {CategoryId}", category.Id);
            return Ok(category);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al actualizar la categoría", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina una categoría (soft delete - marca como inactiva) - solo del restaurante del usuario
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCategory(int id)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .Include(c => c.Products.Where(p => p.RestaurantId == restaurantId))
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
            
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada o no pertenece a tu restaurante" });
            }

            // Verificar si tiene productos
            if (category.Products != null && category.Products.Any(p => p.IsAvailable))
            {
                return BadRequest(new { 
                    error = "No se puede eliminar una categoría que tiene productos disponibles",
                    productsCount = category.Products.Count(p => p.IsAvailable)
                });
            }

            // Soft delete - marcar como inactiva
            category.IsActive = false;

            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos para este restaurante
            var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
            await _cache.RemoveAsync(cacheKey);
            await _cache.RemoveAsync($"products_list_{restaurantId}");

            _logger.LogInformation("Categoría eliminada (soft): {CategoryId}", id);
            return Ok(new { message = "Categoría eliminada correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina permanentemente una categoría (solo si no tiene productos) - solo del restaurante del usuario
    /// </summary>
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteCategoryPermanent(int id)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            
            var category = await _context.Categories
                .Include(c => c.Products.Where(p => p.RestaurantId == restaurantId))
                .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
            
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada o no pertenece a tu restaurante" });
            }

            // Verificar si tiene productos
            if (category.Products != null && category.Products.Any())
            {
                return BadRequest(new { 
                    error = "No se puede eliminar permanentemente una categoría que tiene productos",
                    productsCount = category.Products.Count
                });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos para este restaurante
            var cacheKey = $"{CATEGORIES_CACHE_KEY}_{restaurantId}";
            await _cache.RemoveAsync(cacheKey);
            await _cache.RemoveAsync($"products_list_{restaurantId}");

            _logger.LogInformation("Categoría eliminada permanentemente: {CategoryId}", id);
            return Ok(new { message = "Categoría eliminada permanentemente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar categoría permanentemente {CategoryId}", id);
            return StatusCode(500, new { error = "Error al eliminar la categoría", details = ex.Message });
        }
    }
}



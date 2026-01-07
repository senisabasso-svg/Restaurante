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
    /// Obtiene todas las categorías activas
    /// </summary>
    [HttpGet]
    [ResponseCache(Duration = 600, Location = ResponseCacheLocation.Any)]
    public async Task<ActionResult<IEnumerable<Category>>> GetCategories()
    {
        // Intentar obtener desde cache
        var cachedCategories = await _cache.GetAsync<List<Category>>(CATEGORIES_CACHE_KEY);
        if (cachedCategories != null)
        {
            // Registrar cache hit
            _metricsService?.RecordCacheHit(CATEGORIES_CACHE_KEY);
            
            // Generar ETag para categorías cacheadas
            var cachedETag = ETagHelper.GenerateETag(cachedCategories);
            
            // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
            var cachedClientETag = Request.Headers["If-None-Match"].ToString();
            if (!string.IsNullOrEmpty(cachedClientETag) && ETagHelper.IsETagValid(cachedClientETag, cachedETag))
            {
                _logger.LogInformation("Categorías no han cambiado (ETag match desde cache): {Count}", cachedCategories.Count);
                return StatusCode(304); // Not Modified
            }

            // Agregar ETag al header de respuesta
            Response.Headers.Append("ETag", cachedETag);
            
            _logger.LogInformation("Categorías obtenidas desde cache: {Count}", cachedCategories.Count);
            return Ok(cachedCategories);
        }
        
        // Registrar cache miss
        _metricsService?.RecordCacheMiss(CATEGORIES_CACHE_KEY);

        // Usar AsNoTracking para operaciones de solo lectura (mejor performance)
        var categories = await _context.Categories
            .AsNoTracking()
            .Where(c => c.IsActive)
            .Include(c => c.Products)
            .OrderBy(c => c.DisplayOrder)
            .ToListAsync();

        // Guardar en cache
        await _cache.SetAsync(CATEGORIES_CACHE_KEY, categories, CACHE_DURATION);

        // Generar ETag
        var etag = ETagHelper.GenerateETag(categories);
        
        // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
        var clientETag = Request.Headers["If-None-Match"].ToString();
        if (!string.IsNullOrEmpty(clientETag) && ETagHelper.IsETagValid(clientETag, etag))
        {
            _logger.LogInformation("Categorías no han cambiado (ETag match): {Count}", categories.Count);
            return StatusCode(304); // Not Modified
        }

        // Agregar ETag al header de respuesta
        Response.Headers.Append("ETag", etag);

        _logger.LogInformation("Categorías obtenidas de BD y guardadas en cache: {Count}", categories.Count);
        return Ok(categories);
    }

    /// <summary>
    /// Obtiene una categoría por ID
    /// </summary>
    [HttpGet("{id}")]
    [ResponseCache(Duration = 600, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<Category>> GetCategory(int id)
    {
        // Usar AsNoTracking para operaciones de solo lectura
        var category = await _context.Categories
            .AsNoTracking()
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id);

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
    /// Crea una nueva categoría
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Category>> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        try
        {
            var category = new Category
            {
                Name = request.Name,
                Description = request.Description,
                Icon = request.Icon,
                DisplayOrder = request.DisplayOrder,
                IsActive = request.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos
            await _cache.RemoveAsync(CATEGORIES_CACHE_KEY);
            await _cache.RemoveAsync("products_list");

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
    /// Actualiza una categoría completa
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Category>> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        try
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            category.Name = request.Name ?? category.Name;
            category.Description = request.Description ?? category.Description;
            category.Icon = request.Icon ?? category.Icon;
            category.DisplayOrder = request.DisplayOrder ?? category.DisplayOrder;
            category.IsActive = request.IsActive ?? category.IsActive;

            await _context.SaveChangesAsync();

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
    /// Actualiza parcialmente una categoría
    /// </summary>
    [HttpPatch("{id}")]
    public async Task<ActionResult<Category>> PatchCategory(int id, [FromBody] PatchCategoryRequest request)
    {
        try
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
            }

            if (request.Name != null) category.Name = request.Name;
            if (request.Description != null) category.Description = request.Description;
            if (request.Icon != null) category.Icon = request.Icon;
            if (request.DisplayOrder.HasValue) category.DisplayOrder = request.DisplayOrder.Value;
            if (request.IsActive.HasValue) category.IsActive = request.IsActive.Value;

            await _context.SaveChangesAsync();

            // Invalidar cache de categorías y productos
            await _cache.RemoveAsync(CATEGORIES_CACHE_KEY);
            await _cache.RemoveAsync("products_list");

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
    /// Elimina una categoría (soft delete - marca como inactiva)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCategory(int id)
    {
        try
        {
            var category = await _context.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == id);
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
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

            // Invalidar cache de categorías y productos
            await _cache.RemoveAsync(CATEGORIES_CACHE_KEY);
            await _cache.RemoveAsync("products_list");

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
    /// Elimina permanentemente una categoría (solo si no tiene productos)
    /// </summary>
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteCategoryPermanent(int id)
    {
        try
        {
            var category = await _context.Categories.Include(c => c.Products).FirstOrDefaultAsync(c => c.Id == id);
            if (category == null)
            {
                return NotFound(new { error = "Categoría no encontrada" });
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

            // Invalidar cache de categorías y productos
            await _cache.RemoveAsync(CATEGORIES_CACHE_KEY);
            await _cache.RemoveAsync("products_list");

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



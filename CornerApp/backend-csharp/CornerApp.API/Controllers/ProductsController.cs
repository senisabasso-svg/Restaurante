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
[Route("api/products")]
[Tags("Productos")]
public class ProductsController : ControllerBase
{
    private readonly ILogger<ProductsController> _logger;
    private readonly ApplicationDbContext _context;
    private readonly ICacheService _cache;
    private readonly IMetricsService? _metricsService;
    private const string PRODUCTS_CACHE_KEY = "products_list";
    private static readonly TimeSpan CACHE_DURATION = TimeSpan.FromMinutes(5);

    public ProductsController(ILogger<ProductsController> logger, ApplicationDbContext context, ICacheService cache, IMetricsService? metricsService = null)
    {
        _logger = logger;
        _context = context;
        _cache = cache;
        _metricsService = metricsService;
    }

    /// <summary>
    /// Obtiene todos los productos disponibles
    /// </summary>
    [HttpGet]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any, VaryByQueryKeys = new[] { "*" })]
    public async Task<ActionResult<IEnumerable<Product>>> GetProducts()
    {
        try
        {
            // Verificar primero si hay categorías, si no, inicializar todo
            if (!await _context.Categories.AnyAsync())
            {
                _logger.LogInformation("No hay categorías en BD, inicializando datos...");
                await InitializeDatabaseAsync();
            }

            // Intentar obtener desde cache
            var cachedProducts = await _cache.GetAsync<List<object>>(PRODUCTS_CACHE_KEY);
            if (cachedProducts != null)
            {
                // Registrar cache hit
                _metricsService?.RecordCacheHit(PRODUCTS_CACHE_KEY);
                
                // Generar ETag para productos cacheados
                var cachedETag = ETagHelper.GenerateETag(cachedProducts);
                
                // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
                var cachedClientETag = Request.Headers["If-None-Match"].ToString();
                if (!string.IsNullOrEmpty(cachedClientETag) && ETagHelper.IsETagValid(cachedClientETag, cachedETag))
                {
                    _logger.LogInformation("Productos no han cambiado (ETag match desde cache): {Count}", cachedProducts.Count);
                    return StatusCode(304); // Not Modified
                }

                // Agregar ETag al header de respuesta
                Response.Headers.Append("ETag", cachedETag);
                
                _logger.LogInformation("Productos obtenidos desde cache: {Count}", cachedProducts.Count);
                return Ok(cachedProducts);
            }
            
            // Registrar cache miss
            _metricsService?.RecordCacheMiss(PRODUCTS_CACHE_KEY);

            // Obtener productos de la base de datos con categorías, ordenados por DisplayOrder
            // Usar AsNoTracking para operaciones de solo lectura (mejor performance)
            var products = await _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .Where(p => p.IsAvailable)
                .OrderBy(p => p.DisplayOrder)
                .ThenBy(p => p.CreatedAt)
                .ToListAsync();

            // Mapear a formato simple para el frontend (evitar referencias circulares)
            var productsResponse = products.Select(p => new
            {
                id = p.Id,
                name = p.Name ?? string.Empty,
                category = p.Category?.Name ?? string.Empty,
                description = p.Description ?? string.Empty,
                price = p.Price,
                image = p.Image ?? string.Empty
            }).ToList<object>();

            // Guardar en cache
            await _cache.SetAsync(PRODUCTS_CACHE_KEY, productsResponse, CACHE_DURATION);

            // Generar ETag
            var etag = ETagHelper.GenerateETag(productsResponse);
            
            // Verificar si el cliente tiene el mismo ETag (304 Not Modified)
            var clientETag = Request.Headers["If-None-Match"].ToString();
            if (!string.IsNullOrEmpty(clientETag) && ETagHelper.IsETagValid(clientETag, etag))
            {
                _logger.LogInformation("Productos no han cambiado (ETag match): {Count}", productsResponse.Count);
                return StatusCode(304); // Not Modified
            }

            // Agregar ETag al header de respuesta
            Response.Headers.Append("ETag", etag);
            
            _logger.LogInformation("Productos obtenidos de BD y guardados en cache: {Count}", productsResponse.Count);
            return Ok(productsResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos: {Message}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            return StatusCode(500, new { 
                error = "Error al obtener productos", 
                message = ex.Message,
                details = ex.InnerException?.Message 
            });
        }
    }

    /// <summary>
    /// Inicializa las categorías en la base de datos
    /// </summary>
    private async Task InitializeDatabaseAsync()
    {
        try
        {
            // Verificar si ya existen categorías antes de crear
            if (await _context.Categories.AnyAsync())
            {
                _logger.LogInformation("Las categorías ya existen, no es necesario inicializar");
                return;
            }

            // Crear categorías
            var categories = new List<Category>
            {
                new Category { Name = "pizza", Description = "Deliciosas pizzas artesanales", DisplayOrder = 1, IsActive = true, CreatedAt = DateTime.UtcNow },
                new Category { Name = "bebida", Description = "Bebidas refrescantes", DisplayOrder = 2, IsActive = true, CreatedAt = DateTime.UtcNow },
                new Category { Name = "postre", Description = "Postres deliciosos", DisplayOrder = 3, IsActive = true, CreatedAt = DateTime.UtcNow }
            };

            await _context.Categories.AddRangeAsync(categories);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Categorías creadas exitosamente");
        }
        catch (DbUpdateException dbEx)
        {
            // Si hay un error de duplicado (categorías ya existen), no es crítico
            if (dbEx.InnerException?.Message.Contains("UNIQUE") == true || 
                dbEx.InnerException?.Message.Contains("duplicate") == true)
            {
                _logger.LogWarning("Las categorías ya existen en la base de datos");
                return;
            }
            _logger.LogError(dbEx, "Error de base de datos al inicializar categorías: {Message}", dbEx.Message);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al inicializar categorías: {Message}", ex.Message);
            throw;
        }
    }

    /// <summary>
    /// Crea los productos iniciales
    /// </summary>
    private async Task CreateInitialProductsAsync()
    {
        try
        {
            // Obtener las categorías (deben existir ya)
            var pizzaCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "pizza");
            var bebidaCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "bebida");
            var postreCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "postre");

            if (pizzaCategory == null || bebidaCategory == null || postreCategory == null)
            {
                _logger.LogWarning("Categorías no encontradas, creando categorías primero...");
                await InitializeDatabaseAsync();
                pizzaCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "pizza");
                bebidaCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "bebida");
                postreCategory = await _context.Categories.FirstOrDefaultAsync(c => c.Name == "postre");
                
                if (pizzaCategory == null || bebidaCategory == null || postreCategory == null)
                {
                    throw new InvalidOperationException("No se pudieron crear las categorías necesarias");
                }
            }

            // Crear productos
            var products = new List<Product>
            {
                // Pizzas
                new Product
                {
                    Name = "Pizza Margarita",
                    CategoryId = pizzaCategory.Id,
                    Description = "Deliciosa pizza con salsa de tomate, mozzarella fresca y albahaca",
                    Price = 12.99m,
                    Image = "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Pizza Pepperoni",
                    CategoryId = pizzaCategory.Id,
                    Description = "Clásica pizza con pepperoni, mozzarella y salsa de tomate",
                    Price = 14.99m,
                    Image = "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Pizza Hawaiana",
                    CategoryId = pizzaCategory.Id,
                    Description = "Pizza tropical con jamón, piña y mozzarella",
                    Price = 15.99m,
                    Image = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Pizza Cuatro Quesos",
                    CategoryId = pizzaCategory.Id,
                    Description = "Pizza gourmet con mozzarella, gorgonzola, parmesano y fontina",
                    Price = 16.99m,
                    Image = "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Pizza Vegetariana",
                    CategoryId = pizzaCategory.Id,
                    Description = "Pizza saludable con pimientos, champiñones, cebolla y aceitunas",
                    Price = 13.99m,
                    Image = "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                // Bebidas
                new Product
                {
                    Name = "Coca Cola",
                    CategoryId = bebidaCategory.Id,
                    Description = "Refresco de cola 500ml",
                    Price = 2.50m,
                    Image = "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Agua Mineral",
                    CategoryId = bebidaCategory.Id,
                    Description = "Agua mineral natural 500ml",
                    Price = 1.50m,
                    Image = "https://images.unsplash.com/photo-1548839140-5a176c94e9ff?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Jugo de Naranja",
                    CategoryId = bebidaCategory.Id,
                    Description = "Jugo de naranja natural 350ml",
                    Price = 3.00m,
                    Image = "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                // Postres
                new Product
                {
                    Name = "Tiramisú",
                    CategoryId = postreCategory.Id,
                    Description = "Delicioso postre italiano con café y cacao",
                    Price = 5.99m,
                    Image = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                },
                new Product
                {
                    Name = "Brownie con Helado",
                    CategoryId = postreCategory.Id,
                    Description = "Brownie caliente con helado de vainilla",
                    Price = 6.99m,
                    Image = "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400",
                    IsAvailable = true,
                    CreatedAt = DateTime.UtcNow
                }
            };

            await _context.Products.AddRangeAsync(products);
            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Productos iniciales creados exitosamente");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear productos iniciales: {Message}", ex.Message);
            throw;
        }
    }

    /// <summary>
    /// Obtiene un producto por ID
    /// </summary>
    [HttpGet("{id}")]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any, VaryByHeader = "Accept")]
    public async Task<ActionResult<Product>> GetProduct(int id)
    {
            // Usar AsNoTracking para operaciones de solo lectura
            var product = await _context.Products
                .AsNoTracking()
                .Include(p => p.Category)
                .FirstOrDefaultAsync(p => p.Id == id);
        
        if (product == null)
        {
            return NotFound();
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
            // Validar que la categoría existe
            var category = await _context.Categories.FindAsync(request.CategoryId);
            if (category == null)
            {
                return BadRequest(new { error = $"La categoría con ID {request.CategoryId} no existe" });
            }

            var product = new Product
            {
                Name = request.Name,
                Description = request.Description ?? string.Empty,
                Price = request.Price,
                Image = request.Image ?? string.Empty,
                CategoryId = request.CategoryId,
                IsAvailable = request.IsAvailable,
                CreatedAt = DateTime.UtcNow
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            // Invalidar cache de productos
            await _cache.RemoveAsync(PRODUCTS_CACHE_KEY);

            // Cargar la categoría para la respuesta
            await _context.Entry(product).Reference(p => p.Category).LoadAsync();

            _logger.LogInformation("Producto creado: {ProductId} - {ProductName}", product.Id, product.Name);
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear producto");
            return StatusCode(500, new { error = "Error al crear el producto", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza un producto completo
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Product>> UpdateProduct(int id, [FromBody] UpdateProductRequest request)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return NotFound(new { error = "Producto no encontrado" });
            }

            // Validar que la categoría existe
            if (request.CategoryId.HasValue)
            {
                var category = await _context.Categories.FindAsync(request.CategoryId.Value);
                if (category == null)
                {
                    return BadRequest(new { error = $"La categoría con ID {request.CategoryId.Value} no existe" });
                }
                product.CategoryId = request.CategoryId.Value;
            }

            product.Name = request.Name ?? product.Name;
            product.Description = request.Description ?? product.Description;
            product.Price = request.Price ?? product.Price;
            product.Image = request.Image ?? product.Image;
            product.IsAvailable = request.IsAvailable ?? product.IsAvailable;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Invalidar cache de productos
            await _cache.RemoveAsync(PRODUCTS_CACHE_KEY);

            // Cargar la categoría para la respuesta
            await _context.Entry(product).Reference(p => p.Category).LoadAsync();

            _logger.LogInformation("Producto actualizado: {ProductId}", product.Id);
            return Ok(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar producto {ProductId}", id);
            return StatusCode(500, new { error = "Error al actualizar el producto", details = ex.Message });
        }
    }

    /// <summary>
    /// Actualiza parcialmente un producto
    /// </summary>
    [HttpPatch("{id}")]
    public async Task<ActionResult<Product>> PatchProduct(int id, [FromBody] PatchProductRequest request)
    {
        try
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return NotFound(new { error = "Producto no encontrado" });
            }

            // Validar categoría si se proporciona
            if (request.CategoryId.HasValue)
            {
                var category = await _context.Categories.FindAsync(request.CategoryId.Value);
                if (category == null)
                {
                    return BadRequest(new { error = $"La categoría con ID {request.CategoryId.Value} no existe" });
                }
                product.CategoryId = request.CategoryId.Value;
            }

            if (request.Name != null) product.Name = request.Name;
            if (request.Description != null) product.Description = request.Description;
            if (request.Price.HasValue) product.Price = request.Price.Value;
            if (request.Image != null) product.Image = request.Image;
            if (request.IsAvailable.HasValue) product.IsAvailable = request.IsAvailable.Value;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Invalidar cache de productos
            await _cache.RemoveAsync(PRODUCTS_CACHE_KEY);

            // Cargar la categoría para la respuesta
            await _context.Entry(product).Reference(p => p.Category).LoadAsync();

            _logger.LogInformation("Producto actualizado (patch): {ProductId}", product.Id);
            return Ok(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar producto {ProductId}", id);
            return StatusCode(500, new { error = "Error al actualizar el producto", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina un producto permanentemente
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

            // Eliminar permanentemente el producto
            _context.Products.Remove(product);
            await _context.SaveChangesAsync();

            // Invalidar cache de productos
            await _cache.RemoveAsync(PRODUCTS_CACHE_KEY);

            _logger.LogInformation("Producto eliminado permanentemente: {ProductId}", id);
            return Ok(new { message = "Producto eliminado permanentemente" });
        }
        catch (DbUpdateException dbEx)
        {
            _logger.LogError(dbEx, "Error de base de datos al eliminar producto {ProductId}", id);
            // Verificar si el error es por restricción de clave foránea
            if (dbEx.InnerException?.Message.Contains("FOREIGN KEY") == true || 
                dbEx.InnerException?.Message.Contains("REFERENCE") == true)
            {
                return BadRequest(new { error = "No se puede eliminar el producto porque está asociado a pedidos existentes." });
            }
            return StatusCode(500, new { error = "Error al eliminar el producto", details = dbEx.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar producto {ProductId}", id);
            return StatusCode(500, new { error = "Error al eliminar el producto", details = ex.Message });
        }
    }

    /// <summary>
    /// Elimina permanentemente un producto
    /// </summary>
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult> DeleteProductPermanent(int id)
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

            _logger.LogInformation("Producto eliminado permanentemente: {ProductId}", id);
            return Ok(new { message = "Producto eliminado permanentemente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al eliminar producto permanentemente {ProductId}", id);
            return StatusCode(500, new { error = "Error al eliminar el producto", details = ex.Message });
        }
    }
}



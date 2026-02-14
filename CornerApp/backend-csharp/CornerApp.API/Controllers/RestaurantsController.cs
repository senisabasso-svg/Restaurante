using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.DTOs;
using CornerApp.API.Helpers;
using BCrypt.Net;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para gestión de restaurantes (multi-tenant)
/// Solo usuarios con rol Admin pueden crear/editar restaurantes
/// </summary>
[ApiController]
[Route("api/restaurants")]
[Tags("Restaurantes")]
[Authorize(Roles = "Admin,SuperAdmin")] // Solo administradores y superadmin pueden gestionar restaurantes
public class RestaurantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RestaurantsController> _logger;

    public RestaurantsController(
        ApplicationDbContext context,
        ILogger<RestaurantsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene todos los restaurantes activos (público para registro de clientes)
    /// </summary>
    [HttpGet]
    [AllowAnonymous] // Permitir acceso público para que los clientes puedan seleccionar restaurante al registrarse
    public async Task<ActionResult<IEnumerable<object>>> GetRestaurants()
    {
        var restaurants = await _context.Restaurants
            .AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Name)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Identifier,
                r.Address,
                r.Phone,
                r.Email,
                r.IsActive,
                r.CreatedAt,
                AdminsCount = r.Admins.Count,
                ProductsCount = r.Products.Count,
                OrdersCount = r.Orders.Count
            })
            .ToListAsync();

        return Ok(restaurants);
    }

    /// <summary>
    /// Obtiene un restaurante por ID (público para que los clientes puedan ver su restaurante)
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous] // Permitir acceso público para que los clientes puedan ver información de su restaurante
    public async Task<ActionResult<Restaurant>> GetRestaurant(int id)
    {
        var restaurant = await _context.Restaurants
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == id);

        if (restaurant == null)
        {
            return NotFound(new { error = "Restaurante no encontrado" });
        }

        return Ok(restaurant);
    }

    /// <summary>
    /// Crea un nuevo restaurante
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Restaurant>> CreateRestaurant([FromBody] CreateRestaurantRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return BadRequest(new { error = "El nombre del restaurante es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.Identifier))
            {
                return BadRequest(new { error = "El identificador del restaurante es requerido" });
            }

            // Validar datos del admin
            if (string.IsNullOrWhiteSpace(request.AdminName))
            {
                return BadRequest(new { error = "El nombre del usuario admin es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.AdminUsername))
            {
                return BadRequest(new { error = "El username del usuario admin es requerido" });
            }

            if (string.IsNullOrWhiteSpace(request.AdminPassword))
            {
                return BadRequest(new { error = "La contraseña del usuario admin es requerida" });
            }

            if (string.IsNullOrWhiteSpace(request.AdminEmail))
            {
                return BadRequest(new { error = "El email del usuario admin es requerido" });
            }

            // Verificar que el identificador sea único
            var existingRestaurant = await _context.Restaurants
                .FirstOrDefaultAsync(r => r.Identifier.ToLower() == request.Identifier.ToLower().Trim());

            if (existingRestaurant != null)
            {
                return BadRequest(new { error = "Ya existe un restaurante con ese identificador" });
            }

            // Verificar que el username del admin no esté en uso en ningún restaurante
            var existingAdmin = await _context.Admins
                .FirstOrDefaultAsync(a => a.Username.ToLower() == request.AdminUsername.ToLower().Trim());

            if (existingAdmin != null)
            {
                return BadRequest(new { error = "El username del admin ya está en uso" });
            }

            // Crear el restaurante
            var restaurant = new Restaurant
            {
                Name = request.Name.Trim(),
                Identifier = request.Identifier.Trim().ToLower(), // Normalizar a minúsculas
                Address = request.Address?.Trim(),
                Phone = request.Phone?.Trim(),
                Email = request.Email?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Restaurants.Add(restaurant);
            await _context.SaveChangesAsync(); // Guardar primero para obtener el ID

            // Crear el usuario admin para el restaurante
            var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.AdminPassword);
            var admin = new Admin
            {
                RestaurantId = restaurant.Id,
                Username = request.AdminUsername.Trim(),
                Email = request.AdminEmail.Trim().ToLower(),
                PasswordHash = passwordHash,
                Name = request.AdminName.Trim(),
                Role = "Admin", // El primer usuario siempre es Admin
                CreatedAt = DateTime.UtcNow
            };

            _context.Admins.Add(admin);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Restaurante creado con admin: {RestaurantName} (ID: {RestaurantId}, Identifier: {Identifier}, Admin: {AdminUsername})", 
                restaurant.Name, restaurant.Id, restaurant.Identifier, admin.Username);

            return Ok(new
            {
                id = restaurant.Id,
                name = restaurant.Name,
                identifier = restaurant.Identifier,
                address = restaurant.Address,
                phone = restaurant.Phone,
                email = restaurant.Email,
                isActive = restaurant.IsActive,
                createdAt = restaurant.CreatedAt,
                admin = new
                {
                    id = admin.Id,
                    username = admin.Username,
                    name = admin.Name,
                    email = admin.Email,
                    role = admin.Role
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear restaurante");
            return StatusCode(500, new { error = "Error al crear el restaurante" });
        }
    }

    /// <summary>
    /// Actualiza un restaurante
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<Restaurant>> UpdateRestaurant(int id, [FromBody] UpdateRestaurantRequest request)
    {
        try
        {
            var restaurant = await _context.Restaurants.FindAsync(id);

            if (restaurant == null)
            {
                return NotFound(new { error = "Restaurante no encontrado" });
            }

            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                restaurant.Name = request.Name.Trim();
            }

            if (!string.IsNullOrWhiteSpace(request.Identifier))
            {
                var newIdentifier = request.Identifier.Trim().ToLower();
                
                // Verificar que el nuevo identificador no esté en uso por otro restaurante
                var existingRestaurant = await _context.Restaurants
                    .FirstOrDefaultAsync(r => r.Identifier == newIdentifier && r.Id != id);

                if (existingRestaurant != null)
                {
                    return BadRequest(new { error = "Ya existe otro restaurante con ese identificador" });
                }

                restaurant.Identifier = newIdentifier;
            }

            if (request.Address != null)
            {
                restaurant.Address = request.Address.Trim();
            }

            if (request.Phone != null)
            {
                restaurant.Phone = request.Phone.Trim();
            }

            if (request.Email != null)
            {
                restaurant.Email = request.Email.Trim();
            }

            if (request.IsActive.HasValue)
            {
                restaurant.IsActive = request.IsActive.Value;
            }

            restaurant.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Restaurante actualizado: {RestaurantId}", id);

            return Ok(new
            {
                id = restaurant.Id,
                name = restaurant.Name,
                identifier = restaurant.Identifier,
                address = restaurant.Address,
                phone = restaurant.Phone,
                email = restaurant.Email,
                isActive = restaurant.IsActive,
                updatedAt = restaurant.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar restaurante {RestaurantId}", id);
            return StatusCode(500, new { error = "Error al actualizar el restaurante" });
        }
    }

    /// <summary>
    /// Desactiva un restaurante (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRestaurant(int id)
    {
        try
        {
            var restaurant = await _context.Restaurants.FindAsync(id);

            if (restaurant == null)
            {
                return NotFound(new { error = "Restaurante no encontrado" });
            }

            // Soft delete: desactivar en lugar de eliminar
            restaurant.IsActive = false;
            restaurant.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Restaurante desactivado: {RestaurantId}", id);

            return Ok(new { message = "Restaurante desactivado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al desactivar restaurante {RestaurantId}", id);
            return StatusCode(500, new { error = "Error al desactivar el restaurante" });
        }
    }

    /// <summary>
    /// Obtiene la configuración POS del restaurante actual
    /// </summary>
    [HttpGet("current/pos-config")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> GetCurrentRestaurantPOSConfig()
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            var restaurant = await _context.Restaurants
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.Id == restaurantId);

            if (restaurant == null)
            {
                return NotFound(new { error = "Restaurante no encontrado" });
            }

            return Ok(new
            {
                systemId = restaurant.SystemId ?? string.Empty,
                posId = restaurant.PosId ?? string.Empty,
                branch = restaurant.Branch ?? string.Empty,
                clientAppId = restaurant.ClientAppId ?? string.Empty
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener configuración POS del restaurante");
            return StatusCode(500, new { error = "Error al obtener la configuración POS" });
        }
    }

    /// <summary>
    /// Actualiza la configuración POS del restaurante actual
    /// </summary>
    [HttpPut("current/pos-config")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> UpdateCurrentRestaurantPOSConfig([FromBody] UpdatePOSConfigRequest request)
    {
        try
        {
            var restaurantId = RestaurantHelper.GetRestaurantId(User);
            var restaurant = await _context.Restaurants
                .FirstOrDefaultAsync(r => r.Id == restaurantId);

            if (restaurant == null)
            {
                return NotFound(new { error = "Restaurante no encontrado" });
            }

            // Actualizar campos si se proporcionan
            if (request.SystemId != null)
            {
                restaurant.SystemId = request.SystemId.Trim();
            }

            if (request.PosId != null)
            {
                restaurant.PosId = request.PosId.Trim();
            }

            if (request.Branch != null)
            {
                restaurant.Branch = request.Branch.Trim();
            }

            if (request.ClientAppId != null)
            {
                restaurant.ClientAppId = request.ClientAppId.Trim();
            }

            restaurant.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Configuración POS actualizada para restaurante {RestaurantId}", restaurantId);

            return Ok(new
            {
                message = "Configuración POS actualizada exitosamente",
                systemId = restaurant.SystemId,
                posId = restaurant.PosId,
                branch = restaurant.Branch,
                clientAppId = restaurant.ClientAppId
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar configuración POS del restaurante");
            return StatusCode(500, new { error = "Error al actualizar la configuración POS" });
        }
    }

    /// <summary>
    /// Limpia datos antiguos sin RestaurantId (solo SuperAdmin)
    /// Este endpoint elimina categorías y productos que no tienen RestaurantId asignado
    /// </summary>
    [HttpPost("cleanup-orphaned-data")]
    [Authorize(Roles = "SuperAdmin")]
    public async Task<ActionResult> CleanupOrphanedData()
    {
        try
        {
            // Contar datos huérfanos antes de eliminar (RestaurantId = 0 o menor)
            var orphanedCategoriesCount = await _context.Categories
                .Where(c => c.RestaurantId <= 0)
                .CountAsync();
            
            var orphanedProductsCount = await _context.Products
                .Where(p => p.RestaurantId <= 0)
                .CountAsync();

            // Eliminar categorías huérfanas
            var orphanedCategories = await _context.Categories
                .Where(c => c.RestaurantId <= 0)
                .ToListAsync();
            
            if (orphanedCategories.Any())
            {
                _context.Categories.RemoveRange(orphanedCategories);
                _logger.LogInformation("Eliminando {Count} categorías huérfanas", orphanedCategories.Count);
            }

            // Eliminar productos huérfanos
            var orphanedProducts = await _context.Products
                .Where(p => p.RestaurantId <= 0)
                .ToListAsync();
            
            if (orphanedProducts.Any())
            {
                _context.Products.RemoveRange(orphanedProducts);
                _logger.LogInformation("Eliminando {Count} productos huérfanos", orphanedProducts.Count);
            }

            // Guardar cambios
            await _context.SaveChangesAsync();

            _logger.LogInformation("Limpieza completada: {CategoriesCount} categorías y {ProductsCount} productos eliminados", 
                orphanedCategoriesCount, orphanedProductsCount);

            return Ok(new
            {
                message = "Limpieza de datos huérfanos completada",
                deletedCategories = orphanedCategoriesCount,
                deletedProducts = orphanedProductsCount
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al limpiar datos huérfanos");
            return StatusCode(500, new { error = "Error al limpiar datos huérfanos", details = ex.Message });
        }
    }
}

// DTOs
public class UpdatePOSConfigRequest
{
    public string? SystemId { get; set; }
    public string? PosId { get; set; }
    public string? Branch { get; set; }
    public string? ClientAppId { get; set; }
}

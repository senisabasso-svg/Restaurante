using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Constants;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación del servicio para la lógica de negocio de los dashboards de administración
/// </summary>
public class AdminDashboardService : IAdminDashboardService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminDashboardService> _logger;
    private readonly IDeliveryZoneService _deliveryZoneService;

    public AdminDashboardService(
        ApplicationDbContext context,
        ILogger<AdminDashboardService> logger,
        IDeliveryZoneService deliveryZoneService)
    {
        _context = context;
        _logger = logger;
        _deliveryZoneService = deliveryZoneService;
    }

    /// <summary>
    /// Calcula el tiempo estimado de entrega en minutos basado en la distancia
    /// </summary>
    public int CalculateEstimatedDeliveryTime(double? customerLat, double? customerLon, double? deliveryLat, double? deliveryLon)
    {
        // Si no hay coordenadas del cliente, retornar tiempo por defecto
        if (!customerLat.HasValue || !customerLon.HasValue)
        {
            return AppConstants.DEFAULT_DELIVERY_TIME_MINUTES;
        }

        double startLat, startLon;

        // Si hay coordenadas del repartidor, calcular desde repartidor a cliente
        if (deliveryLat.HasValue && deliveryLon.HasValue)
        {
            startLat = deliveryLat.Value;
            startLon = deliveryLon.Value;
        }
        else
        {
            // Si no hay repartidor, calcular desde el negocio al cliente
            var storeLat = _deliveryZoneService.GetStoreLatitude();
            var storeLon = _deliveryZoneService.GetStoreLongitude();
            
            if (!storeLat.HasValue || !storeLon.HasValue)
            {
                // Si no hay coordenadas del negocio configuradas, usar tiempo por defecto
                return AppConstants.DEFAULT_DELIVERY_TIME_MINUTES;
            }
            
            startLat = storeLat.Value;
            startLon = storeLon.Value;
        }

        var distanceKm = _deliveryZoneService.CalculateDistanceKm(
            startLat, startLon,
            customerLat.Value, customerLon.Value
        );
        
        // Calcular tiempo: asumiendo velocidad promedio configurada
        // Tiempo = distancia / velocidad (en horas) * 60 (a minutos)
        // Agregar tiempo base para preparación
        var timeInMinutes = (int)Math.Ceiling((distanceKm / AppConstants.AVERAGE_DELIVERY_SPEED_KMH) * 60) + AppConstants.PREPARATION_TIME_MINUTES;
        
        // Limitar entre mínimo y máximo configurados
        return Math.Max(AppConstants.MIN_DELIVERY_TIME_MINUTES, Math.Min(AppConstants.MAX_DELIVERY_TIME_MINUTES, timeInMinutes));
    }

    /// <summary>
    /// Calcula la distancia y tiempo estimado entre repartidor y cliente
    /// </summary>
    public (double? distanceKm, int? estimatedMinutes) CalculateDistanceAndTime(Order order)
    {
        // Si no hay coordenadas del cliente, no se puede calcular
        if (!order.CustomerLatitude.HasValue || !order.CustomerLongitude.HasValue)
        {
            return (null, null);
        }

        double startLat, startLon;

        // Si hay coordenadas del repartidor, calcular desde repartidor a cliente
        if (order.DeliveryLatitude.HasValue && order.DeliveryLongitude.HasValue)
        {
            startLat = order.DeliveryLatitude.Value;
            startLon = order.DeliveryLongitude.Value;
        }
        else
        {
            // Si no hay repartidor, calcular desde el negocio al cliente
            var storeLat = _deliveryZoneService.GetStoreLatitude();
            var storeLon = _deliveryZoneService.GetStoreLongitude();
            
            if (!storeLat.HasValue || !storeLon.HasValue)
            {
                return (null, null);
            }
            
            startLat = storeLat.Value;
            startLon = storeLon.Value;
        }

        var distanceKm = _deliveryZoneService.CalculateDistanceKm(
            startLat, startLon,
            order.CustomerLatitude.Value, order.CustomerLongitude.Value
        );
        
        // Calcular tiempo estimado
        int estimatedMinutes;
        if (order.Status == OrderConstants.STATUS_DELIVERING)
        {
            // Si está en camino, solo tiempo de viaje (sin preparación)
            estimatedMinutes = (int)Math.Ceiling((distanceKm / AppConstants.AVERAGE_DELIVERY_SPEED_KMH) * 60);
            // Para entregas en curso, límites más estrictos (5-60 minutos)
            estimatedMinutes = Math.Max(5, Math.Min(60, estimatedMinutes));
        }
        else
        {
            // Si está en preparación, incluir tiempo base
            estimatedMinutes = (int)Math.Ceiling((distanceKm / 30.0) * 60) + 10;
            estimatedMinutes = Math.Max(15, Math.Min(120, estimatedMinutes));
        }
        
        return (distanceKm, estimatedMinutes);
    }

    /// <summary>
    /// Asegura que las categorías requeridas existan en la base de datos
    /// Solo se ejecuta si la base de datos está vacía (primera vez)
    /// </summary>
    public async Task EnsureCategoriesExistAsync()
    {
        // Solo crear categorías si la base de datos está completamente vacía
        // Esto evita que se recreen categorías que fueron eliminadas manualmente
        var hasAnyCategories = await _context.Categories.AnyAsync();
        
        if (hasAnyCategories)
        {
            // Si ya hay categorías, no hacer nada
            // Esto respeta las eliminaciones manuales del usuario
            return;
        }

        // Solo si la base de datos está vacía, crear las categorías iniciales
        var requiredCategories = new[]
        {
            new { Name = "pizzas", Description = "Deliciosas pizzas artesanales", DisplayOrder = 1 },
            new { Name = "hamburguesas", Description = "Hamburguesas gourmet", DisplayOrder = 2 },
            new { Name = "chivitos", Description = "Chivitos tradicionales", DisplayOrder = 3 },
            new { Name = "extras", Description = "Extras y complementos", DisplayOrder = 4 },
            new { Name = "bebidas", Description = "Bebidas refrescantes", DisplayOrder = 5 },
            new { Name = "postres", Description = "Postres deliciosos", DisplayOrder = 6 }
        };

        foreach (var cat in requiredCategories)
        {
            var newCategory = new Category
            {
                Name = cat.Name,
                Description = cat.Description,
                DisplayOrder = cat.DisplayOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.Categories.Add(newCategory);
            _logger.LogInformation("Categoría inicial creada: {CategoryName}", cat.Name);
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Asegura que existan métodos de pago por defecto
    /// </summary>
    public async Task EnsurePaymentMethodsExistAsync()
    {
        if (!await _context.PaymentMethods.AnyAsync())
        {
            var defaultMethods = new List<PaymentMethod>
            {
                new PaymentMethod { Name = PaymentConstants.METHOD_CASH, DisplayName = "Efectivo", Icon = "💵", Description = "Pago al entregar", RequiresReceipt = false, IsActive = true, DisplayOrder = 1 },
                new PaymentMethod { Name = PaymentConstants.METHOD_POS, DisplayName = "POS a domicilio", Icon = "💳", Description = "Pago con tarjeta al entregar", RequiresReceipt = false, IsActive = true, DisplayOrder = 2 },
                new PaymentMethod { Name = PaymentConstants.METHOD_TRANSFER, DisplayName = "Transferencia", Icon = "🏦", Description = "Transferencia bancaria", RequiresReceipt = true, IsActive = true, DisplayOrder = 3 },
            };

            _context.PaymentMethods.AddRange(defaultMethods);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Métodos de pago por defecto creados");
        }
    }

    /// <summary>
    /// Obtiene los métodos de pago activos ordenados
    /// </summary>
    public async Task<List<PaymentMethod>> GetActivePaymentMethodsAsync()
    {
        return await _context.PaymentMethods
            .Where(pm => pm.IsActive)
            .OrderBy(pm => pm.DisplayOrder)
            .ThenBy(pm => pm.Name)
            .ToListAsync();
    }

    /// <summary>
    /// Obtiene un diccionario con todos los métodos de pago (nombre -> displayName)
    /// </summary>
    public async Task<Dictionary<string, string>> GetPaymentMethodsDictionaryAsync()
    {
        var allPaymentMethods = await _context.PaymentMethods.ToListAsync();
        return allPaymentMethods
            .Where(pm => !string.IsNullOrEmpty(pm.Name) && !string.IsNullOrEmpty(pm.DisplayName))
            .ToDictionary(pm => pm.Name!.ToLower(), pm => pm.DisplayName!);
    }

    /// <summary>
    /// Obtiene los repartidores activos ordenados por nombre
    /// </summary>
    public async Task<List<DeliveryPerson>> GetActiveDeliveryPersonsAsync()
    {
        return await _context.DeliveryPersons
            .Where(d => d.IsActive)
            .OrderBy(d => d.Name)
            .ToListAsync();
    }

    /// <summary>
    /// Obtiene todos los métodos de pago ordenados (incluyendo inactivos)
    /// </summary>
    public async Task<List<PaymentMethod>> GetAllPaymentMethodsAsync()
    {
        return await _context.PaymentMethods
            .OrderBy(pm => pm.DisplayOrder)
            .ThenBy(pm => pm.Name)
            .ToListAsync();
    }

    /// <summary>
    /// Obtiene todos los repartidores ordenados por nombre (incluyendo inactivos)
    /// </summary>
    public async Task<List<DeliveryPerson>> GetAllDeliveryPersonsAsync()
    {
        return await _context.DeliveryPersons
            .OrderBy(d => d.Name)
            .ToListAsync();
    }

    /// <summary>
    /// Obtiene una query base de pedidos con los includes necesarios
    /// </summary>
    public IQueryable<Order> GetOrdersBaseQuery()
    {
        return _context.Orders
            .Include(o => o.Items)
            .Include(o => o.DeliveryPerson)
            .AsQueryable();
    }

    /// <summary>
    /// Aplica ordenamiento a una query de pedidos
    /// </summary>
    public IQueryable<Order> ApplyOrderSorting(IQueryable<Order> query, string sortBy, string sortOrder)
    {
        return sortBy switch
        {
            SortConstants.SORT_BY_ID => sortOrder.Equals(SortConstants.ORDER_ASC, StringComparison.OrdinalIgnoreCase) 
                ? query.OrderBy(o => o.Id) 
                : query.OrderByDescending(o => o.Id),
            
            SortConstants.SORT_BY_CREATED_AT or "fecha" => sortOrder.Equals(SortConstants.ORDER_ASC, StringComparison.OrdinalIgnoreCase) 
                ? query.OrderBy(o => o.CreatedAt) 
                : query.OrderByDescending(o => o.CreatedAt),
            
            SortConstants.SORT_BY_STATUS or "estado" => sortOrder.Equals(SortConstants.ORDER_ASC, StringComparison.OrdinalIgnoreCase) 
                ? query.OrderBy(o => o.Status) 
                : query.OrderByDescending(o => o.Status),
            
            SortConstants.SORT_BY_TOTAL => sortOrder.Equals(SortConstants.ORDER_ASC, StringComparison.OrdinalIgnoreCase) 
                ? query.OrderBy(o => o.Total) 
                : query.OrderByDescending(o => o.Total),
            
            SortConstants.SORT_BY_CUSTOMER or "cliente" => sortOrder.Equals(SortConstants.ORDER_ASC, StringComparison.OrdinalIgnoreCase) 
                ? query.OrderBy(o => o.CustomerName ?? "") 
                : query.OrderByDescending(o => o.CustomerName ?? ""),
            
            _ => query.OrderByDescending(o => o.CreatedAt) // Por defecto: más recientes primero
        };
    }

    /// <summary>
    /// Aplica paginación a una query de pedidos y retorna los resultados paginados
    /// </summary>
    public async Task<(List<Order> orders, int totalCount)> GetPaginatedOrdersAsync(
        IQueryable<Order> query, 
        int page, 
        int pageSize)
    {
        var totalCount = await query.CountAsync();
        
        var orders = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (orders, totalCount);
    }

    /// <summary>
    /// Obtiene todos los pedidos para estadísticas (sin paginación) filtrados por estado de archivado
    /// </summary>
    public async Task<List<Order>> GetAllOrdersForStatsAsync(bool showArchived)
    {
        return await _context.Orders
            .Where(o => showArchived ? o.IsArchived : !o.IsArchived)
            .ToListAsync();
    }

    /// <summary>
    /// Obtiene todos los pedidos activos para estadísticas (sin paginación)
    /// </summary>
    public async Task<List<Order>> GetActiveOrdersForStatsAsync()
    {
        return await _context.Orders
            .Where(o => !o.IsArchived && 
                       o.Status != OrderConstants.STATUS_COMPLETED && 
                       o.Status != OrderConstants.STATUS_CANCELLED)
            .ToListAsync();
    }

    /// <summary>
    /// Crea una nueva categoría
    /// </summary>
    public async Task<Category> CreateCategoryAsync(int restaurantId, string name, string? description, string? icon)
    {
        // Verificar si la categoría ya existe en el mismo restaurante (comparación case-insensitive)
        var trimmedName = name.Trim().ToLower();
        var existingCategory = await _context.Categories
            .FirstOrDefaultAsync(c => c.RestaurantId == restaurantId && 
                                     c.Name != null && 
                                     c.Name.ToLower() == trimmedName);

        if (existingCategory != null)
        {
            throw new InvalidOperationException("Ya existe una categoría con ese nombre en tu restaurante");
        }

        // Obtener el siguiente DisplayOrder para este restaurante
        var activeCategories = await _context.Categories
            .Where(c => c.RestaurantId == restaurantId && c.IsActive)
            .Select(c => c.DisplayOrder)
            .ToListAsync();
        
        var maxDisplayOrder = activeCategories.Any() ? activeCategories.Max() : 0;

        var category = new Category
        {
            RestaurantId = restaurantId,
            Name = name.Trim(),
            Description = description?.Trim() ?? string.Empty,
            Icon = icon?.Trim(),
            DisplayOrder = maxDisplayOrder + 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Categoría creada: {CategoryId} - {CategoryName} para restaurante {RestaurantId}", 
            category.Id, category.Name, restaurantId);
        return category;
    }

    /// <summary>
    /// Actualiza una categoría existente
    /// </summary>
    public async Task<Category> UpdateCategoryAsync(int id, int restaurantId, string? name, string? description, string? icon, int? displayOrder, bool? isActive)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id && c.RestaurantId == restaurantId);
        
        if (category == null)
        {
            throw new KeyNotFoundException("Categoría no encontrada o no pertenece a tu restaurante");
        }

        // Actualizar el nombre si se proporciona
        if (!string.IsNullOrWhiteSpace(name))
        {
            var trimmedName = name.Trim();
            var currentName = category.Name ?? string.Empty;
            
            // Si el nombre cambió, verificar que no exista otra categoría con ese nombre en el mismo restaurante
            if (currentName.ToLower() != trimmedName.ToLower())
            {
                var existingCategory = await _context.Categories
                    .FirstOrDefaultAsync(c => c.RestaurantId == restaurantId && 
                                             c.Name != null && 
                                             c.Name.ToLower() == trimmedName.ToLower() && 
                                             c.Id != id);
                
                if (existingCategory != null)
                {
                    throw new InvalidOperationException("Ya existe una categoría con ese nombre en tu restaurante");
                }
            }
            
            // Actualizar el nombre siempre que sea diferente
            if (trimmedName != currentName)
            {
                category.Name = trimmedName;
                _context.Entry(category).Property(c => c.Name).IsModified = true;
            }
        }

        if (description != null)
        {
            category.Description = description.Trim();
        }

        if (icon != null)
        {
            category.Icon = icon.Trim();
        }

        if (displayOrder.HasValue)
        {
            category.DisplayOrder = displayOrder.Value;
        }

        if (isActive.HasValue)
        {
            category.IsActive = isActive.Value;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Categoría actualizada: {CategoryId} - {CategoryName}", category.Id, category.Name);
        return category;
    }

    /// <summary>
    /// Verifica si existe una categoría con el nombre dado (excluyendo el id especificado)
    /// </summary>
    public async Task<bool> CategoryNameExistsAsync(string name, int? excludeId = null)
    {
        var trimmedName = name.Trim().ToLower();
        var query = _context.Categories
            .Where(c => c.Name != null && c.Name.ToLower() == trimmedName);

        if (excludeId.HasValue)
        {
            query = query.Where(c => c.Id != excludeId.Value);
        }

        return await query.AnyAsync();
    }

    /// <summary>
    /// Verifica si una categoría existe
    /// </summary>
    public async Task<bool> CategoryExistsAsync(int categoryId)
    {
        return await _context.Categories.AnyAsync(c => c.Id == categoryId);
    }

    /// <summary>
    /// Crea un nuevo producto
    /// </summary>
    public async Task<Product> CreateProductAsync(string name, string? description, decimal price, string? image, int categoryId, int displayOrder, bool isAvailable, bool isRecommended = false)
    {
        // Validar que la categoría existe
        if (!await CategoryExistsAsync(categoryId))
        {
            throw new KeyNotFoundException($"La categoría con ID {categoryId} no existe");
        }

        // Obtener la categoría para validar RestaurantId
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == categoryId);
        
        if (category == null)
        {
            throw new KeyNotFoundException($"La categoría con ID {categoryId} no existe");
        }

        // Obtener el siguiente DisplayOrder para productos de la misma categoría y restaurante
        int maxDisplayOrder = 0;
        try
        {
            maxDisplayOrder = await _context.Products
                .Where(p => p.CategoryId == categoryId && p.RestaurantId == category.RestaurantId)
                .Select(p => p.DisplayOrder)
                .DefaultIfEmpty(0)
                .MaxAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error al obtener maxDisplayOrder, usando 0 como valor por defecto");
            maxDisplayOrder = 0;
        }

        var product = new Product
        {
            RestaurantId = category.RestaurantId,
            Name = name.Trim(),
            Description = description?.Trim() ?? string.Empty,
            Price = price,
            Image = image?.Trim() ?? string.Empty,
            CategoryId = categoryId,
            DisplayOrder = displayOrder != 0 ? displayOrder : maxDisplayOrder + 1,
            IsAvailable = isAvailable,
            IsRecommended = isRecommended,
            CreatedAt = DateTime.UtcNow
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        // Cargar la categoría para la respuesta
        try
        {
            await _context.Entry(product).Reference(p => p.Category).LoadAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "No se pudo cargar la categoría para el producto {ProductId}, continuando sin ella", product.Id);
        }

        _logger.LogInformation("Producto creado: {ProductId} - {ProductName}", product.Id, product.Name);
        return product;
    }

    /// <summary>
    /// Actualiza un producto existente
    /// </summary>
    public async Task<Product> UpdateProductAsync(int id, string? name, string? description, decimal? price, string? image, int? categoryId, int? displayOrder, bool? isAvailable, bool? isRecommended = null)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
        {
            throw new KeyNotFoundException("Producto no encontrado");
        }

        if (!string.IsNullOrWhiteSpace(name))
        {
            product.Name = name.Trim();
        }

        if (description != null)
        {
            product.Description = description.Trim();
        }

        if (price.HasValue)
        {
            if (price.Value <= 0)
            {
                throw new ArgumentException("El precio debe ser mayor a 0");
            }
            product.Price = price.Value;
        }

        if (image != null)
        {
            product.Image = image.Trim();
        }

        if (categoryId.HasValue)
        {
            if (!await CategoryExistsAsync(categoryId.Value))
            {
                throw new KeyNotFoundException($"La categoría con ID {categoryId.Value} no existe");
            }
            product.CategoryId = categoryId.Value;
        }

        if (isAvailable.HasValue)
        {
            product.IsAvailable = isAvailable.Value;
        }

        if (isRecommended.HasValue)
        {
            product.IsRecommended = isRecommended.Value;
        }

        if (displayOrder.HasValue)
        {
            product.DisplayOrder = displayOrder.Value;
        }

        product.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Cargar la categoría para la respuesta
        await _context.Entry(product).Reference(p => p.Category).LoadAsync();

        _logger.LogInformation("Producto actualizado: {ProductId} - {ProductName}", product.Id, product.Name);
        return product;
    }
}


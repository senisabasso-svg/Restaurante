using CornerApp.API.Models;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para la lógica de negocio de los dashboards de administración
/// </summary>
public interface IAdminDashboardService
{
    /// <summary>
    /// Calcula el tiempo estimado de entrega en minutos basado en la distancia
    /// </summary>
    int CalculateEstimatedDeliveryTime(double? customerLat, double? customerLon, double? deliveryLat, double? deliveryLon);

    /// <summary>
    /// Calcula la distancia y tiempo estimado entre repartidor y cliente
    /// </summary>
    (double? distanceKm, int? estimatedMinutes) CalculateDistanceAndTime(Order order);

    /// <summary>
    /// Asegura que las categorías requeridas existan en la base de datos
    /// </summary>
    Task EnsureCategoriesExistAsync();

    /// <summary>
    /// Asegura que existan métodos de pago por defecto
    /// </summary>
    Task EnsurePaymentMethodsExistAsync();

    /// <summary>
    /// Obtiene los métodos de pago activos ordenados
    /// </summary>
    Task<List<PaymentMethod>> GetActivePaymentMethodsAsync();

    /// <summary>
    /// Obtiene un diccionario con todos los métodos de pago (nombre -> displayName)
    /// </summary>
    Task<Dictionary<string, string>> GetPaymentMethodsDictionaryAsync();

    /// <summary>
    /// Obtiene los repartidores activos ordenados por nombre
    /// </summary>
    Task<List<DeliveryPerson>> GetActiveDeliveryPersonsAsync();

    /// <summary>
    /// Obtiene todos los métodos de pago ordenados (incluyendo inactivos)
    /// </summary>
    Task<List<PaymentMethod>> GetAllPaymentMethodsAsync();

    /// <summary>
    /// Obtiene todos los repartidores ordenados por nombre (incluyendo inactivos)
    /// </summary>
    Task<List<DeliveryPerson>> GetAllDeliveryPersonsAsync();

    /// <summary>
    /// Aplica ordenamiento a una query de pedidos
    /// </summary>
    IQueryable<Order> ApplyOrderSorting(IQueryable<Order> query, string sortBy, string sortOrder);

    /// <summary>
    /// Obtiene una query base de pedidos con los includes necesarios
    /// </summary>
    IQueryable<Order> GetOrdersBaseQuery();

    /// <summary>
    /// Aplica paginación a una query de pedidos y retorna los resultados paginados
    /// </summary>
    Task<(List<Order> orders, int totalCount)> GetPaginatedOrdersAsync(
        IQueryable<Order> query, 
        int page, 
        int pageSize);

    /// <summary>
    /// Obtiene todos los pedidos para estadísticas (sin paginación) filtrados por estado de archivado
    /// </summary>
    Task<List<Order>> GetAllOrdersForStatsAsync(bool showArchived);

    /// <summary>
    /// Obtiene todos los pedidos activos para estadísticas (sin paginación)
    /// </summary>
    Task<List<Order>> GetActiveOrdersForStatsAsync();

    /// <summary>
    /// Crea una nueva categoría
    /// </summary>
    Task<Category> CreateCategoryAsync(int restaurantId, string name, string? description, string? icon);

    /// <summary>
    /// Actualiza una categoría existente
    /// </summary>
    Task<Category> UpdateCategoryAsync(int id, int restaurantId, string? name, string? description, string? icon, int? displayOrder, bool? isActive);

    /// <summary>
    /// Verifica si existe una categoría con el nombre dado (excluyendo el id especificado)
    /// </summary>
    Task<bool> CategoryNameExistsAsync(string name, int? excludeId = null);

    /// <summary>
    /// Crea un nuevo producto
    /// </summary>
    Task<Product> CreateProductAsync(string name, string? description, decimal price, string? image, int categoryId, int displayOrder, bool isAvailable, bool isRecommended = false);

    /// <summary>
    /// Actualiza un producto existente
    /// </summary>
    Task<Product> UpdateProductAsync(int id, string? name, string? description, decimal? price, string? image, int? categoryId, int? displayOrder, bool? isAvailable, bool? isRecommended = null);

    /// <summary>
    /// Verifica si una categoría existe
    /// </summary>
    Task<bool> CategoryExistsAsync(int categoryId);
}


namespace CornerApp.API.Services;

/// <summary>
/// Servicio de cache unificado que soporta Memory Cache y Distributed Cache (Redis)
/// </summary>
public interface ICacheService
{
    /// <summary>
    /// Obtiene un valor del cache
    /// </summary>
    Task<T?> GetAsync<T>(string key) where T : class;

    /// <summary>
    /// Guarda un valor en el cache
    /// </summary>
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class;

    /// <summary>
    /// Elimina un valor del cache
    /// </summary>
    Task RemoveAsync(string key);

    /// <summary>
    /// Verifica si existe una clave en el cache
    /// </summary>
    Task<bool> ExistsAsync(string key);

    /// <summary>
    /// Obtiene un valor del cache (método síncrono para compatibilidad)
    /// </summary>
    T? Get<T>(string key) where T : class;

    /// <summary>
    /// Guarda un valor en el cache (método síncrono para compatibilidad)
    /// </summary>
    void Set<T>(string key, T value, TimeSpan? expiration = null) where T : class;
}

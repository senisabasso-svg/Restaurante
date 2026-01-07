using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación unificada de cache que usa Distributed Cache (Redis) si está disponible,
/// o Memory Cache como fallback
/// </summary>
public class CacheService : ICacheService
{
    private readonly IDistributedCache? _distributedCache;
    private readonly IMemoryCache? _memoryCache;
    private readonly ILogger<CacheService> _logger;
    private readonly bool _useDistributedCache;

    public CacheService(
        IDistributedCache? distributedCache = null,
        IMemoryCache? memoryCache = null,
        ILogger<CacheService> logger = null!)
    {
        _distributedCache = distributedCache;
        _memoryCache = memoryCache;
        _logger = logger;
        _useDistributedCache = _distributedCache != null;
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                var cachedValue = await _distributedCache.GetStringAsync(key);
                if (cachedValue != null)
                {
                    return JsonSerializer.Deserialize<T>(cachedValue);
                }
            }
            else if (_memoryCache != null)
            {
                if (_memoryCache.TryGetValue(key, out T? value))
                {
                    return value;
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al obtener del cache: {Key}", key);
        }

        return null;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                var options = new DistributedCacheEntryOptions();
                if (expiration.HasValue)
                {
                    options.AbsoluteExpirationRelativeToNow = expiration;
                }
                else
                {
                    options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5); // Default
                }

                var serializedValue = JsonSerializer.Serialize(value);
                await _distributedCache.SetStringAsync(key, serializedValue, options);
            }
            else if (_memoryCache != null)
            {
                var options = new MemoryCacheEntryOptions();
                if (expiration.HasValue)
                {
                    options.AbsoluteExpirationRelativeToNow = expiration;
                }
                else
                {
                    options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5); // Default
                }

                _memoryCache.Set(key, value, options);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al guardar en cache: {Key}", key);
        }
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                await _distributedCache.RemoveAsync(key);
            }
            else if (_memoryCache != null)
            {
                _memoryCache.Remove(key);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al eliminar del cache: {Key}", key);
        }
    }

    public async Task<bool> ExistsAsync(string key)
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                var value = await _distributedCache.GetStringAsync(key);
                return value != null;
            }
            else if (_memoryCache != null)
            {
                return _memoryCache.TryGetValue(key, out _);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al verificar existencia en cache: {Key}", key);
        }

        return false;
    }

    public T? Get<T>(string key) where T : class
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                var cachedValue = _distributedCache.GetString(key);
                if (cachedValue != null)
                {
                    return JsonSerializer.Deserialize<T>(cachedValue);
                }
            }
            else if (_memoryCache != null)
            {
                if (_memoryCache.TryGetValue(key, out T? value))
                {
                    return value;
                }
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al obtener del cache (síncrono): {Key}", key);
        }

        return null;
    }

    public void Set<T>(string key, T value, TimeSpan? expiration = null) where T : class
    {
        try
        {
            if (_useDistributedCache && _distributedCache != null)
            {
                var options = new DistributedCacheEntryOptions();
                if (expiration.HasValue)
                {
                    options.AbsoluteExpirationRelativeToNow = expiration;
                }
                else
                {
                    options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                }

                var serializedValue = JsonSerializer.Serialize(value);
                _distributedCache.SetString(key, serializedValue, options);
            }
            else if (_memoryCache != null)
            {
                var options = new MemoryCacheEntryOptions();
                if (expiration.HasValue)
                {
                    options.AbsoluteExpirationRelativeToNow = expiration;
                }
                else
                {
                    options.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                }

                _memoryCache.Set(key, value, options);
            }
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(ex, "Error al guardar en cache (síncrono): {Key}", key);
        }
    }
}

using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio en segundo plano para limpieza periódica de cache
/// </summary>
public class CacheCleanupService : BackgroundService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<CacheCleanupService> _logger;
    private readonly TimeSpan _cleanupInterval;
    private readonly TimeSpan _cacheExpirationThreshold;

    public CacheCleanupService(
        IMemoryCache cache,
        ILogger<CacheCleanupService> logger,
        IConfiguration configuration)
    {
        _cache = cache;
        _logger = logger;
        
        // Intervalo de limpieza (por defecto cada 30 minutos)
        var cleanupIntervalMinutes = configuration.GetValue<int>("BackgroundJobs:CacheCleanup:IntervalMinutes", 30);
        _cleanupInterval = TimeSpan.FromMinutes(cleanupIntervalMinutes);
        
        // Limpiar entradas que expiraron hace más de X minutos (por defecto 60)
        var expirationThresholdMinutes = configuration.GetValue<int>("BackgroundJobs:CacheCleanup:ExpirationThresholdMinutes", 60);
        _cacheExpirationThreshold = TimeSpan.FromMinutes(expirationThresholdMinutes);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Cache Cleanup Service iniciado. Intervalo: {Interval} minutos, Threshold: {Threshold} minutos",
            _cleanupInterval.TotalMinutes,
            _cacheExpirationThreshold.TotalMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PerformCleanupAsync();
                await Task.Delay(_cleanupInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error durante limpieza de cache: {Message}", ex.Message);
                // Esperar antes de reintentar
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }
        }

        _logger.LogInformation("Cache Cleanup Service detenido.");
    }

    private async Task PerformCleanupAsync()
    {
        _logger.LogDebug("Iniciando limpieza de cache...");
        
        // Nota: IMemoryCache no expone directamente las entradas para limpieza manual
        // La limpieza se realiza automáticamente cuando las entradas expiran
        // Este servicio puede ser extendido para limpiar entradas específicas si es necesario
        
        // Por ahora, solo registramos que la limpieza se ejecutó
        // En el futuro, si necesitamos limpiar entradas específicas, podemos usar un wrapper
        // o implementar un cache personalizado
        
        _logger.LogDebug("Limpieza de cache completada.");
        await Task.CompletedTask;
    }
}

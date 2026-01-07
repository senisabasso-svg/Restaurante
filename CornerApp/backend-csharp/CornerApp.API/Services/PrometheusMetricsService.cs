using Prometheus;
using CornerApp.API.Services;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para exponer métricas personalizadas en formato Prometheus
/// </summary>
public class PrometheusMetricsService
{
    // Contadores
    private static readonly Counter _httpRequestsTotal = Metrics
        .CreateCounter("cornerapp_http_requests_total", "Total número de HTTP requests", new[] { "method", "endpoint", "status_code" });

    private static readonly Counter _httpErrorsTotal = Metrics
        .CreateCounter("cornerapp_http_errors_total", "Total número de errores HTTP", new[] { "method", "endpoint", "error_type" });

    private static readonly Counter _cacheHitsTotal = Metrics
        .CreateCounter("cornerapp_cache_hits_total", "Total número de cache hits", new[] { "cache_key" });

    private static readonly Counter _cacheMissesTotal = Metrics
        .CreateCounter("cornerapp_cache_misses_total", "Total número de cache misses", new[] { "cache_key" });

    // Histogramas (para duraciones)
    private static readonly Histogram _httpRequestDuration = Metrics
        .CreateHistogram("cornerapp_http_request_duration_seconds", "Duración de requests HTTP en segundos", new[] { "method", "endpoint" });

    // Gauges (valores actuales)
    private static readonly Gauge _activeRequests = Metrics
        .CreateGauge("cornerapp_active_requests", "Número de requests activos actualmente");

    private static readonly Gauge _cacheSize = Metrics
        .CreateGauge("cornerapp_cache_size", "Tamaño actual del cache", new[] { "cache_key" });

    /// <summary>
    /// Registra un request HTTP
    /// </summary>
    public void RecordHttpRequest(string method, string endpoint, int statusCode, double durationSeconds)
    {
        _httpRequestsTotal.WithLabels(method, endpoint, statusCode.ToString()).Inc();
        _httpRequestDuration.WithLabels(method, endpoint).Observe(durationSeconds);
    }

    /// <summary>
    /// Registra un error HTTP
    /// </summary>
    public void RecordHttpError(string method, string endpoint, string errorType)
    {
        _httpErrorsTotal.WithLabels(method, endpoint, errorType).Inc();
    }

    /// <summary>
    /// Registra un cache hit
    /// </summary>
    public void RecordCacheHit(string cacheKey)
    {
        _cacheHitsTotal.WithLabels(cacheKey).Inc();
    }

    /// <summary>
    /// Registra un cache miss
    /// </summary>
    public void RecordCacheMiss(string cacheKey)
    {
        _cacheMissesTotal.WithLabels(cacheKey).Inc();
    }

    /// <summary>
    /// Incrementa el contador de requests activos
    /// </summary>
    public void IncrementActiveRequests()
    {
        _activeRequests.Inc();
    }

    /// <summary>
    /// Decrementa el contador de requests activos
    /// </summary>
    public void DecrementActiveRequests()
    {
        _activeRequests.Dec();
    }

    /// <summary>
    /// Establece el tamaño del cache
    /// </summary>
    public void SetCacheSize(string cacheKey, double size)
    {
        _cacheSize.WithLabels(cacheKey).Set(size);
    }
}

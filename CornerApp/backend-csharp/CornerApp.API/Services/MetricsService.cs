using System.Collections.Concurrent;
using System.Diagnostics;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para recopilar métricas básicas de la API
/// </summary>
public interface IMetricsService
{
    void RecordRequest(string endpoint, string method, int statusCode, long durationMs);
    void RecordError(string endpoint, string method, string errorType);
    void RecordCacheHit(string cacheKey);
    void RecordCacheMiss(string cacheKey);
    ApiMetrics GetMetrics();
    void ResetMetrics();
}

public class MetricsService : IMetricsService
{
    private readonly ConcurrentDictionary<string, EndpointMetrics> _endpointMetrics = new();
    private readonly ConcurrentDictionary<string, long> _cacheStats = new();
    private readonly object _lockObject = new();
    private long _totalRequests = 0;
    private long _totalErrors = 0;
    private DateTime _startTime = DateTime.UtcNow;

    public void RecordRequest(string endpoint, string method, int statusCode, long durationMs)
    {
        Interlocked.Increment(ref _totalRequests);
        
        var key = $"{method}:{endpoint}";
        _endpointMetrics.AddOrUpdate(key, 
            new EndpointMetrics
            {
                Endpoint = endpoint,
                Method = method,
                RequestCount = 1,
                TotalDurationMs = durationMs,
                MinDurationMs = durationMs,
                MaxDurationMs = durationMs,
                StatusCodeCounts = new ConcurrentDictionary<int, long> { [statusCode] = 1 }
            },
            (k, existing) =>
            {
                existing.RequestCount++;
                existing.TotalDurationMs += durationMs;
                existing.MinDurationMs = Math.Min(existing.MinDurationMs, durationMs);
                existing.MaxDurationMs = Math.Max(existing.MaxDurationMs, durationMs);
                existing.StatusCodeCounts.AddOrUpdate(statusCode, 1, (s, count) => count + 1);
                return existing;
            });

        if (statusCode >= 400)
        {
            Interlocked.Increment(ref _totalErrors);
        }
    }

    public void RecordError(string endpoint, string method, string errorType)
    {
        Interlocked.Increment(ref _totalErrors);
        
        var key = $"{method}:{endpoint}";
        _endpointMetrics.AddOrUpdate(key,
            new EndpointMetrics
            {
                Endpoint = endpoint,
                Method = method,
                ErrorCount = 1,
                ErrorTypes = new ConcurrentDictionary<string, long> { [errorType] = 1 }
            },
            (k, existing) =>
            {
                existing.ErrorCount++;
                existing.ErrorTypes.AddOrUpdate(errorType, 1, (e, count) => count + 1);
                return existing;
            });
    }

    public void RecordCacheHit(string cacheKey)
    {
        _cacheStats.AddOrUpdate("hits", 1, (k, v) => v + 1);
        _cacheStats.AddOrUpdate($"hit:{cacheKey}", 1, (k, v) => v + 1);
    }

    public void RecordCacheMiss(string cacheKey)
    {
        _cacheStats.AddOrUpdate("misses", 1, (k, v) => v + 1);
        _cacheStats.AddOrUpdate($"miss:{cacheKey}", 1, (k, v) => v + 1);
    }

    public ApiMetrics GetMetrics()
    {
        var uptime = DateTime.UtcNow - _startTime;
        var requestsPerSecond = uptime.TotalSeconds > 0 
            ? _totalRequests / uptime.TotalSeconds 
            : 0;

        var endpointMetricsList = _endpointMetrics.Values
            .OrderByDescending(e => e.RequestCount)
            .Take(20)
            .Select(e => new EndpointMetricsDto
            {
                Endpoint = e.Endpoint,
                Method = e.Method,
                RequestCount = e.RequestCount,
                AverageDurationMs = e.RequestCount > 0 ? e.TotalDurationMs / e.RequestCount : 0,
                MinDurationMs = e.MinDurationMs,
                MaxDurationMs = e.MaxDurationMs,
                ErrorCount = e.ErrorCount,
                StatusCodeCounts = e.StatusCodeCounts.ToDictionary(kvp => kvp.Key, kvp => kvp.Value),
                ErrorTypes = e.ErrorTypes.ToDictionary(kvp => kvp.Key, kvp => kvp.Value)
            })
            .ToList();

        var cacheHits = _cacheStats.GetValueOrDefault("hits", 0);
        var cacheMisses = _cacheStats.GetValueOrDefault("misses", 0);
        var cacheHitRate = (cacheHits + cacheMisses) > 0 
            ? (double)cacheHits / (cacheHits + cacheMisses) * 100 
            : 0;

        return new ApiMetrics
        {
            UptimeSeconds = (long)uptime.TotalSeconds,
            TotalRequests = _totalRequests,
            TotalErrors = _totalErrors,
            RequestsPerSecond = requestsPerSecond,
            ErrorRate = _totalRequests > 0 ? (double)_totalErrors / _totalRequests * 100 : 0,
            CacheHits = cacheHits,
            CacheMisses = cacheMisses,
            CacheHitRate = cacheHitRate,
            TopEndpoints = endpointMetricsList
        };
    }

    public void ResetMetrics()
    {
        lock (_lockObject)
        {
            _endpointMetrics.Clear();
            _cacheStats.Clear();
            _totalRequests = 0;
            _totalErrors = 0;
            _startTime = DateTime.UtcNow;
        }
    }
}

public class EndpointMetrics
{
    public string Endpoint { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public long RequestCount { get; set; }
    public long TotalDurationMs { get; set; }
    public long MinDurationMs { get; set; } = long.MaxValue;
    public long MaxDurationMs { get; set; }
    public long ErrorCount { get; set; }
    public ConcurrentDictionary<int, long> StatusCodeCounts { get; set; } = new();
    public ConcurrentDictionary<string, long> ErrorTypes { get; set; } = new();
}

public class ApiMetrics
{
    public long UptimeSeconds { get; set; }
    public long TotalRequests { get; set; }
    public long TotalErrors { get; set; }
    public double RequestsPerSecond { get; set; }
    public double ErrorRate { get; set; }
    public long CacheHits { get; set; }
    public long CacheMisses { get; set; }
    public double CacheHitRate { get; set; }
    public List<EndpointMetricsDto> TopEndpoints { get; set; } = new();
}

public class EndpointMetricsDto
{
    public string Endpoint { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public long RequestCount { get; set; }
    public double AverageDurationMs { get; set; }
    public long MinDurationMs { get; set; }
    public long MaxDurationMs { get; set; }
    public long ErrorCount { get; set; }
    public Dictionary<int, long> StatusCodeCounts { get; set; } = new();
    public Dictionary<string, long> ErrorTypes { get; set; } = new();
}

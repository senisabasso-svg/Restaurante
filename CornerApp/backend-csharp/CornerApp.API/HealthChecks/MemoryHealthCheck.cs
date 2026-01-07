using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;

namespace CornerApp.API.HealthChecks;

/// <summary>
/// Health check para verificar el uso de memoria
/// </summary>
public class MemoryHealthCheck : IHealthCheck
{
    private readonly ILogger<MemoryHealthCheck> _logger;
    private readonly long _maximumMemoryUsageMB;

    public MemoryHealthCheck(ILogger<MemoryHealthCheck> logger, IConfiguration configuration)
    {
        _logger = logger;
        _maximumMemoryUsageMB = configuration.GetValue<long>("HealthChecks:Memory:MaximumUsageMB", 2048);
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var process = System.Diagnostics.Process.GetCurrentProcess();
            var memoryUsageMB = process.WorkingSet64 / (1024.0 * 1024.0);
            var memoryUsagePercent = (memoryUsageMB / _maximumMemoryUsageMB) * 100;

            var data = new Dictionary<string, object>
            {
                ["MemoryUsageMB"] = Math.Round(memoryUsageMB, 2),
                ["MaximumMemoryMB"] = _maximumMemoryUsageMB,
                ["MemoryUsagePercent"] = Math.Round(memoryUsagePercent, 2),
                ["AvailableMemoryMB"] = Math.Round(_maximumMemoryUsageMB - memoryUsageMB, 2)
            };

            if (memoryUsageMB > _maximumMemoryUsageMB)
            {
                return Task.FromResult(HealthCheckResult.Degraded(
                    $"Uso de memoria alto: {Math.Round(memoryUsageMB, 2)} MB (máximo: {_maximumMemoryUsageMB} MB)",
                    data: data));
            }

            return Task.FromResult(HealthCheckResult.Healthy(
                $"Uso de memoria normal: {Math.Round(memoryUsageMB, 2)} MB",
                data: data));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en health check de memoria");
            return Task.FromResult(HealthCheckResult.Unhealthy("Error al verificar memoria", ex));
        }
    }
}

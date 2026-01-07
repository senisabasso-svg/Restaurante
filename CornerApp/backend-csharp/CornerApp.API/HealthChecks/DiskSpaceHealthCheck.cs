using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration;

namespace CornerApp.API.HealthChecks;

/// <summary>
/// Health check para verificar el espacio disponible en disco
/// </summary>
public class DiskSpaceHealthCheck : IHealthCheck
{
    private readonly ILogger<DiskSpaceHealthCheck> _logger;
    private readonly long _minimumFreeSpaceBytes;

    public DiskSpaceHealthCheck(ILogger<DiskSpaceHealthCheck> logger, IConfiguration configuration)
    {
        _logger = logger;
        _minimumFreeSpaceBytes = configuration.GetValue<long>("HealthChecks:DiskSpace:MinimumFreeSpaceMB", 1024) * 1024 * 1024;
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(Environment.CurrentDirectory) ?? "C:\\");
            
            if (!drive.IsReady)
            {
                return Task.FromResult(HealthCheckResult.Unhealthy($"Disco {drive.Name} no está listo"));
            }

            var freeSpace = drive.AvailableFreeSpace;
            var totalSpace = drive.TotalSize;
            var usedSpace = totalSpace - freeSpace;
            var freeSpacePercent = (double)freeSpace / totalSpace * 100;

            var data = new Dictionary<string, object>
            {
                ["Drive"] = drive.Name,
                ["TotalSpaceGB"] = Math.Round(totalSpace / (1024.0 * 1024.0 * 1024.0), 2),
                ["FreeSpaceGB"] = Math.Round(freeSpace / (1024.0 * 1024.0 * 1024.0), 2),
                ["UsedSpaceGB"] = Math.Round(usedSpace / (1024.0 * 1024.0 * 1024.0), 2),
                ["FreeSpacePercent"] = Math.Round(freeSpacePercent, 2)
            };

            if (freeSpace < _minimumFreeSpaceBytes)
            {
                return Task.FromResult(HealthCheckResult.Unhealthy(
                    $"Espacio libre en disco insuficiente: {Math.Round(freeSpace / (1024.0 * 1024.0 * 1024.0), 2)} GB (mínimo requerido: {Math.Round(_minimumFreeSpaceBytes / (1024.0 * 1024.0 * 1024.0), 2)} GB)",
                    data: data));
            }

            return Task.FromResult(HealthCheckResult.Healthy(
                $"Espacio en disco suficiente: {Math.Round(freeSpace / (1024.0 * 1024.0 * 1024.0), 2)} GB libre",
                data: data));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error en health check de espacio en disco");
            return Task.FromResult(HealthCheckResult.Unhealthy("Error al verificar espacio en disco", ex));
        }
    }
}

using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio en segundo plano para realizar backups automáticos de la base de datos
/// </summary>
public class DatabaseBackupBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DatabaseBackupBackgroundService> _logger;
    private readonly IConfiguration _configuration;
    private readonly TimeSpan _backupInterval;

    public DatabaseBackupBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<DatabaseBackupBackgroundService> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;

        // Obtener intervalo de backup desde configuración (por defecto: 24 horas)
        var intervalHours = configuration.GetValue<int>("Backup:IntervalHours", 24);
        _backupInterval = TimeSpan.FromHours(intervalHours);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DatabaseBackupBackgroundService iniciado. Intervalo: {IntervalHours} horas", 
            _backupInterval.TotalHours);

        // Esperar un poco antes del primer backup
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var enabled = _configuration.GetValue<bool>("Backup:Enabled", true);
                if (!enabled)
                {
                    _logger.LogInformation("Backups automáticos deshabilitados");
                    await Task.Delay(TimeSpan.FromHours(1), stoppingToken); // Revisar cada hora
                    continue;
                }

                _logger.LogInformation("Iniciando backup automático programado");
                
                using var scope = _serviceProvider.CreateScope();
                var backupService = scope.ServiceProvider.GetRequiredService<IDatabaseBackupService>();
                var result = await backupService.CreateBackupAsync(stoppingToken);

                if (result.Success)
                {
                    _logger.LogInformation(
                        "Backup automático completado exitosamente: {BackupFilePath} ({FileSize} bytes)",
                        result.BackupFilePath,
                        result.FileSizeBytes);
                }
                else
                {
                    _logger.LogError("Backup automático falló: {ErrorMessage}", result.ErrorMessage);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en DatabaseBackupBackgroundService");
            }

            // Esperar hasta el próximo backup
            await Task.Delay(_backupInterval, stoppingToken);
        }

        _logger.LogInformation("DatabaseBackupBackgroundService deteniéndose");
    }
}

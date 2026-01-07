using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio hospedado que procesa tareas en segundo plano desde la cola
/// </summary>
public class QueuedHostedService : BackgroundService
{
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly ILogger<QueuedHostedService> _logger;

    public QueuedHostedService(
        IBackgroundTaskQueue taskQueue,
        ILogger<QueuedHostedService> logger)
    {
        _taskQueue = taskQueue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Queued Hosted Service está iniciando.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var workItem = await _taskQueue.DequeueAsync(stoppingToken);

                try
                {
                    await workItem(stoppingToken);
                    _logger.LogDebug("Tarea en segundo plano completada exitosamente.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error al ejecutar tarea en segundo plano: {Message}", ex.Message);
                }
            }
            catch (OperationCanceledException)
            {
                // Servicio está siendo detenido
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inesperado en Queued Hosted Service: {Message}", ex.Message);
                // Esperar un poco antes de continuar para evitar loops infinitos
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        _logger.LogInformation("Queued Hosted Service está deteniéndose.");
    }
}

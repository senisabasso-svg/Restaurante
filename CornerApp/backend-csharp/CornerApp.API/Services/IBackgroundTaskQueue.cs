namespace CornerApp.API.Services;

/// <summary>
/// Interfaz para cola de tareas en segundo plano
/// </summary>
public interface IBackgroundTaskQueue
{
    /// <summary>
    /// Encola una tarea para ejecución en segundo plano
    /// </summary>
    ValueTask QueueBackgroundWorkItemAsync(Func<CancellationToken, ValueTask> workItem);

    /// <summary>
    /// Obtiene la siguiente tarea de la cola
    /// </summary>
    ValueTask<Func<CancellationToken, ValueTask>> DequeueAsync(CancellationToken cancellationToken);
}

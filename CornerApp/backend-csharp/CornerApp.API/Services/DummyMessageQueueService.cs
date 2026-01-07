using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación dummy de IMessageQueueService para cuando RabbitMQ está deshabilitado
/// </summary>
public class DummyMessageQueueService : IMessageQueueService
{
    private readonly ILogger<DummyMessageQueueService> _logger;

    public bool IsConnected => true; // Siempre "conectado" para no romper el flujo

    public DummyMessageQueueService(ILogger<DummyMessageQueueService> logger)
    {
        _logger = logger;
    }

    public Task PublishAsync<T>(string queueName, T message, CancellationToken cancellationToken = default) where T : class
    {
        _logger.LogDebug("DummyMessageQueueService: Mensaje publicado en cola {QueueName} (no-op)", queueName);
        return Task.CompletedTask;
    }

    public Task SubscribeAsync<T>(string queueName, Func<T, CancellationToken, Task> handler, CancellationToken cancellationToken = default) where T : class
    {
        _logger.LogDebug("DummyMessageQueueService: Suscrito a cola {QueueName} (no-op)", queueName);
        return Task.CompletedTask;
    }

    public Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("DummyMessageQueueService: Conectado (no-op)");
        return Task.CompletedTask;
    }

    public Task DisconnectAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogDebug("DummyMessageQueueService: Desconectado (no-op)");
        return Task.CompletedTask;
    }
}

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para enviar y recibir mensajes a través de una cola de mensajes
/// </summary>
public interface IMessageQueueService
{
    /// <summary>
    /// Publica un mensaje en la cola
    /// </summary>
    Task PublishAsync<T>(string queueName, T message, CancellationToken cancellationToken = default) where T : class;

    /// <summary>
    /// Suscribe a una cola y procesa mensajes
    /// </summary>
    Task SubscribeAsync<T>(string queueName, Func<T, CancellationToken, Task> handler, CancellationToken cancellationToken = default) where T : class;

    /// <summary>
    /// Verifica si el servicio está conectado
    /// </summary>
    bool IsConnected { get; }

    /// <summary>
    /// Conecta al servicio de mensajería
    /// </summary>
    Task ConnectAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Desconecta del servicio de mensajería
    /// </summary>
    Task DisconnectAsync(CancellationToken cancellationToken = default);
}

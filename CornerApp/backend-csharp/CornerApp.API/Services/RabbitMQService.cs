using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación de IMessageQueueService usando RabbitMQ
/// </summary>
public class RabbitMQService : IMessageQueueService, IDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<RabbitMQService> _logger;
    private IConnection? _connection;
    private IModel? _channel;
    private readonly string _hostName;
    private readonly int _port;
    private readonly string _userName;
    private readonly string _password;
    private readonly string _virtualHost;
    private readonly object _lockObject = new();

    public bool IsConnected => _connection?.IsOpen ?? false;

    public RabbitMQService(IConfiguration configuration, ILogger<RabbitMQService> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _hostName = configuration["RabbitMQ:HostName"] ?? "localhost";
        _port = configuration.GetValue<int>("RabbitMQ:Port", 5672);
        _userName = configuration["RabbitMQ:UserName"] ?? "guest";
        _password = configuration["RabbitMQ:Password"] ?? "guest";
        _virtualHost = configuration["RabbitMQ:VirtualHost"] ?? "/";
    }

    public async Task ConnectAsync(CancellationToken cancellationToken = default)
    {
        if (IsConnected)
        {
            return;
        }

        try
        {
            var factory = new ConnectionFactory
            {
                HostName = _hostName,
                Port = _port,
                UserName = _userName,
                Password = _password,
                VirtualHost = _virtualHost,
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(10)
            };

            _connection = await Task.Run(() => factory.CreateConnection(), cancellationToken);
            _channel = _connection.CreateModel();
            
            _logger.LogInformation("Conectado a RabbitMQ en {HostName}:{Port}", _hostName, _port);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al conectar a RabbitMQ");
            throw;
        }
    }

    public async Task PublishAsync<T>(string queueName, T message, CancellationToken cancellationToken = default) where T : class
    {
        if (!IsConnected)
        {
            await ConnectAsync(cancellationToken);
        }

        if (_channel == null)
        {
            throw new InvalidOperationException("Canal de RabbitMQ no está disponible");
        }

        try
        {
            lock (_lockObject)
            {
                // Declarar la cola (idempotente)
                _channel.QueueDeclare(
                    queue: queueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);

                var json = JsonSerializer.Serialize(message);
                var body = Encoding.UTF8.GetBytes(json);

                var properties = _channel.CreateBasicProperties();
                properties.Persistent = true; // Mensajes persistentes

                _channel.BasicPublish(
                    exchange: "",
                    routingKey: queueName,
                    basicProperties: properties,
                    body: body);

                _logger.LogDebug("Mensaje publicado en cola {QueueName}", queueName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al publicar mensaje en cola {QueueName}", queueName);
            throw;
        }
    }

    public async Task SubscribeAsync<T>(string queueName, Func<T, CancellationToken, Task> handler, CancellationToken cancellationToken = default) where T : class
    {
        if (!IsConnected)
        {
            await ConnectAsync(cancellationToken);
        }

        if (_channel == null)
        {
            throw new InvalidOperationException("Canal de RabbitMQ no está disponible");
        }

        try
        {
            lock (_lockObject)
            {
                // Declarar la cola (idempotente)
                _channel.QueueDeclare(
                    queue: queueName,
                    durable: true,
                    exclusive: false,
                    autoDelete: false,
                    arguments: null);

                // Configurar QoS (Quality of Service) - procesar un mensaje a la vez
                _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

                var consumer = new EventingBasicConsumer(_channel);
                
                consumer.Received += async (model, ea) =>
                {
                    var body = ea.Body.ToArray();
                    var messageJson = Encoding.UTF8.GetString(body);
                    
                    try
                    {
                        var message = JsonSerializer.Deserialize<T>(messageJson);
                        if (message != null)
                        {
                            await handler(message, cancellationToken);
                            _channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                            _logger.LogDebug("Mensaje procesado de cola {QueueName}", queueName);
                        }
                        else
                        {
                            _logger.LogWarning("No se pudo deserializar mensaje de cola {QueueName}", queueName);
                            _channel.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error al procesar mensaje de cola {QueueName}", queueName);
                        _channel.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true);
                    }
                };

                _channel.BasicConsume(
                    queue: queueName,
                    autoAck: false,
                    consumer: consumer);

                _logger.LogInformation("Suscrito a cola {QueueName}", queueName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al suscribirse a cola {QueueName}", queueName);
            throw;
        }
    }

    public async Task DisconnectAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _channel?.Close();
            _connection?.Close();
            _logger.LogInformation("Desconectado de RabbitMQ");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al desconectar de RabbitMQ");
        }
        
        await Task.CompletedTask;
    }

    public void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
    }
}

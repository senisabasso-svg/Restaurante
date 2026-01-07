using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación de política de retry con backoff exponencial
/// </summary>
public class RetryPolicy : IRetryPolicy
{
    private readonly ILogger<RetryPolicy> _logger;
    private readonly RetryPolicyConfig _config;
    private readonly Random _random = new();

    public RetryPolicy(
        ILogger<RetryPolicy> logger,
        IConfiguration configuration,
        string? name = null)
    {
        _logger = logger;
        _config = new RetryPolicyConfig();
        
        var configSection = string.IsNullOrEmpty(name)
            ? configuration.GetSection("RetryPolicy")
            : configuration.GetSection($"RetryPolicy:{name}");
        
        // Leer valores desde configuración
        _config.MaxRetryAttempts = configSection.GetValue<int>("MaxRetryAttempts", 3);
        var initialDelaySeconds = configSection.GetValue<int>("InitialDelaySeconds", 1);
        var maxDelaySeconds = configSection.GetValue<int>("MaxDelaySeconds", 30);
        _config.InitialDelay = TimeSpan.FromSeconds(initialDelaySeconds);
        _config.MaxDelay = TimeSpan.FromSeconds(maxDelaySeconds);
        _config.BackoffMultiplier = configSection.GetValue<double>("BackoffMultiplier", 2.0);
        
        // Leer estrategia
        var strategyStr = configSection.GetValue<string>("Strategy", "Exponential");
        _config.Strategy = Enum.TryParse<RetryStrategy>(strategyStr, true, out var strategy)
            ? strategy
            : RetryStrategy.Exponential;
    }

    public async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operation, null, cancellationToken);
    }

    public async Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default)
    {
        await ExecuteAsync(async () =>
        {
            await operation();
            return true;
        }, null, cancellationToken);
    }

    public async Task<T> ExecuteAsync<T>(
        Func<Task<T>> operation,
        Func<Exception, int, Task<bool>>? shouldRetry,
        CancellationToken cancellationToken = default)
    {
        int attempt = 0;
        Exception? lastException = null;

        while (attempt <= _config.MaxRetryAttempts)
        {
            try
            {
                var result = await operation();
                
                if (attempt > 0)
                {
                    _logger.LogInformation(
                        "Operación exitosa después de {Attempt} intentos",
                        attempt);
                }

                return result;
            }
            catch (Exception ex)
            {
                lastException = ex;
                attempt++;

                // Verificar si debemos hacer retry
                var shouldRetryThis = await ShouldRetryAsync(ex, attempt, shouldRetry);
                
                if (!shouldRetryThis || attempt > _config.MaxRetryAttempts)
                {
                    _logger.LogWarning(
                        ex,
                        "Operación falló después de {Attempt} intentos. No se reintentará más.",
                        attempt);
                    throw;
                }

                // Calcular delay para el siguiente intento
                var delay = CalculateDelay(attempt);
                
                _logger.LogWarning(
                    ex,
                    "Operación falló (intento {Attempt}/{MaxAttempts}). Reintentando en {Delay}ms",
                    attempt,
                    _config.MaxRetryAttempts,
                    delay.TotalMilliseconds);

                await Task.Delay(delay, cancellationToken);
            }
        }

        // No debería llegar aquí, pero por seguridad
        if (lastException != null)
        {
            throw lastException;
        }

        throw new InvalidOperationException("Operación falló sin excepción registrada");
    }

    private async Task<bool> ShouldRetryAsync(
        Exception exception,
        int attempt,
        Func<Exception, int, Task<bool>>? customShouldRetry)
    {
        // Si hay un callback personalizado, usarlo
        if (customShouldRetry != null)
        {
            return await customShouldRetry(exception, attempt);
        }

        // Verificar si la excepción es retryable según configuración
        if (_config.ShouldRetry != null)
        {
            return _config.ShouldRetry(exception);
        }

        // Verificar tipos de excepciones retryables
        if (_config.RetryableExceptions != null && _config.RetryableExceptions.Any())
        {
            var exceptionType = exception.GetType();
            return _config.RetryableExceptions.Any(t => t.IsAssignableFrom(exceptionType));
        }

        // Por defecto, retry para excepciones comunes de red/BD
        return IsRetryableException(exception);
    }

    private bool IsRetryableException(Exception exception)
    {
        // Excepciones comunes que son retryables
        var retryableTypes = new[]
        {
            typeof(System.Net.Http.HttpRequestException),
            typeof(System.Net.Sockets.SocketException),
            typeof(TimeoutException),
            typeof(Microsoft.Data.SqlClient.SqlException),
            typeof(System.Data.Common.DbException)
        };

        var exceptionType = exception.GetType();
        return retryableTypes.Any(t => t.IsAssignableFrom(exceptionType));
    }

    private TimeSpan CalculateDelay(int attempt)
    {
        var delay = _config.Strategy switch
        {
            RetryStrategy.Fixed => _config.InitialDelay,
            RetryStrategy.Linear => TimeSpan.FromMilliseconds(
                _config.InitialDelay.TotalMilliseconds * attempt),
            RetryStrategy.Exponential => TimeSpan.FromMilliseconds(
                _config.InitialDelay.TotalMilliseconds * Math.Pow(_config.BackoffMultiplier, attempt - 1)),
            RetryStrategy.Jitter => TimeSpan.FromMilliseconds(
                _config.InitialDelay.TotalMilliseconds * Math.Pow(_config.BackoffMultiplier, attempt - 1) +
                _random.Next(0, (int)(_config.InitialDelay.TotalMilliseconds * 0.2))),
            _ => _config.InitialDelay
        };

        // Limitar al máximo configurado
        return delay > _config.MaxDelay ? _config.MaxDelay : delay;
    }
}

/// <summary>
/// Factory para crear políticas de retry
/// </summary>
public class RetryPolicyFactory
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly IConfiguration _configuration;
    private readonly Dictionary<string, IRetryPolicy> _policies = new();

    public RetryPolicyFactory(ILoggerFactory loggerFactory, IConfiguration configuration)
    {
        _loggerFactory = loggerFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// Obtiene o crea una política de retry con el nombre especificado
    /// </summary>
    public IRetryPolicy GetOrCreate(string name)
    {
        if (!_policies.ContainsKey(name))
        {
            var logger = _loggerFactory.CreateLogger<RetryPolicy>();
            _policies[name] = new RetryPolicy(logger, _configuration, name);
        }

        return _policies[name];
    }

    /// <summary>
    /// Obtiene todas las políticas de retry
    /// </summary>
    public Dictionary<string, IRetryPolicy> GetAll()
    {
        return _policies;
    }
}

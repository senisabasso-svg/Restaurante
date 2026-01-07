using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación de Circuit Breaker pattern
/// </summary>
public class CircuitBreaker : ICircuitBreaker
{
    private readonly ILogger<CircuitBreaker> _logger;
    private readonly CircuitBreakerOptions _options;
    private CircuitBreakerState _state = CircuitBreakerState.Closed;
    private int _failureCount = 0;
    private DateTime? _lastFailureTime;
    private DateTime? _lastSuccessTime;
    private DateTime? _openedAt;
    private int _successCount = 0;
    private readonly object _lock = new object();

    public CircuitBreaker(
        ILogger<CircuitBreaker> logger,
        IConfiguration configuration,
        string? name = null)
    {
        _logger = logger;
        _options = new CircuitBreakerOptions();
        var configSection = string.IsNullOrEmpty(name) 
            ? configuration.GetSection("CircuitBreaker")
            : configuration.GetSection($"CircuitBreaker:{name}");
        configSection.Bind(_options);
        
        // Valores por defecto si no están configurados
        if (_options.FailureThreshold == 0)
            _options.FailureThreshold = 5;
        if (_options.TimeoutSeconds == 0)
            _options.TimeoutSeconds = 60;
        if (_options.SuccessThreshold == 0)
            _options.SuccessThreshold = 2;
    }

    public CircuitBreakerState State => _state;

    public async Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default)
    {
        lock (_lock)
        {
            // Verificar si debemos intentar resetear (HalfOpen)
            if (_state == CircuitBreakerState.Open)
            {
                if (_openedAt.HasValue && 
                    DateTime.UtcNow - _openedAt.Value >= TimeSpan.FromSeconds(_options.TimeoutSeconds))
                {
                    _logger.LogInformation("Circuit Breaker moviéndose a HalfOpen para probar recuperación");
                    _state = CircuitBreakerState.HalfOpen;
                    _failureCount = 0;
                }
                else
                {
                    _logger.LogWarning("Circuit Breaker está Open, rechazando request");
                    throw new CircuitBreakerOpenException("Circuit breaker está abierto. El servicio no está disponible temporalmente.");
                }
            }
        }

        try
        {
            var result = await operation();
            
            lock (_lock)
            {
                _successCount++;
                _lastSuccessTime = DateTime.UtcNow;
                
                if (_state == CircuitBreakerState.HalfOpen)
                {
                    // Si tenemos suficientes éxitos en HalfOpen, cerrar el circuit
                    if (_successCount >= _options.SuccessThreshold)
                    {
                        _logger.LogInformation("Circuit Breaker cerrado después de recuperación exitosa");
                        _state = CircuitBreakerState.Closed;
                        _failureCount = 0;
                        _openedAt = null;
                    }
                }
                else if (_state == CircuitBreakerState.Closed)
                {
                    // Resetear contador de fallos después de éxito
                    _failureCount = 0;
                }
            }

            return result;
        }
        catch (Exception ex)
        {
            lock (_lock)
            {
                _failureCount++;
                _lastFailureTime = DateTime.UtcNow;

                if (_state == CircuitBreakerState.HalfOpen)
                {
                    // Si falla en HalfOpen, volver a abrir
                    _logger.LogWarning(ex, "Circuit Breaker falló en HalfOpen, abriendo nuevamente");
                    _state = CircuitBreakerState.Open;
                    _openedAt = DateTime.UtcNow;
                }
                else if (_state == CircuitBreakerState.Closed && _failureCount >= _options.FailureThreshold)
                {
                    // Si alcanzamos el umbral de fallos, abrir el circuit
                    _logger.LogWarning(ex, "Circuit Breaker abierto después de {FailureCount} fallos", _failureCount);
                    _state = CircuitBreakerState.Open;
                    _openedAt = DateTime.UtcNow;
                }
            }

            throw;
        }
    }

    public async Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default)
    {
        await ExecuteAsync(async () =>
        {
            await operation();
            return true;
        }, cancellationToken);
    }

    public void Reset()
    {
        lock (_lock)
        {
            _logger.LogInformation("Circuit Breaker reiniciado manualmente");
            _state = CircuitBreakerState.Closed;
            _failureCount = 0;
            _successCount = 0;
            _openedAt = null;
            _lastFailureTime = null;
            _lastSuccessTime = null;
        }
    }

    public CircuitBreakerStats GetStats()
    {
        lock (_lock)
        {
            return new CircuitBreakerStats
            {
                State = _state,
                SuccessCount = _successCount,
                FailureCount = _failureCount,
                TotalRequests = _successCount + _failureCount,
                LastFailureTime = _lastFailureTime,
                LastSuccessTime = _lastSuccessTime,
                OpenedAt = _openedAt
            };
        }
    }
}

/// <summary>
/// Excepción lanzada cuando el circuit breaker está abierto
/// </summary>
public class CircuitBreakerOpenException : Exception
{
    public CircuitBreakerOpenException(string message) : base(message)
    {
    }
}

/// <summary>
/// Opciones de configuración para Circuit Breaker
/// </summary>
public class CircuitBreakerOptions
{
    public int FailureThreshold { get; set; } = 5; // Número de fallos antes de abrir
    public int TimeoutSeconds { get; set; } = 60; // Tiempo antes de intentar HalfOpen
    public int SuccessThreshold { get; set; } = 2; // Éxitos necesarios en HalfOpen para cerrar
}

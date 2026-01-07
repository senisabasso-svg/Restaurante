namespace CornerApp.API.Services;

/// <summary>
/// Interfaz para Circuit Breaker pattern
/// </summary>
public interface ICircuitBreaker
{
    /// <summary>
    /// Estado actual del circuit breaker
    /// </summary>
    CircuitBreakerState State { get; }

    /// <summary>
    /// Ejecuta una operación protegida por circuit breaker
    /// </summary>
    Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ejecuta una operación protegida sin valor de retorno
    /// </summary>
    Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Reinicia el circuit breaker manualmente
    /// </summary>
    void Reset();

    /// <summary>
    /// Obtiene estadísticas del circuit breaker
    /// </summary>
    CircuitBreakerStats GetStats();
}

/// <summary>
/// Estados del circuit breaker
/// </summary>
public enum CircuitBreakerState
{
    Closed,    // Normal, permitiendo requests
    Open,      // Bloqueando requests después de muchos fallos
    HalfOpen   // Probando si el servicio se recuperó
}

/// <summary>
/// Estadísticas del circuit breaker
/// </summary>
public class CircuitBreakerStats
{
    public CircuitBreakerState State { get; set; }
    public int SuccessCount { get; set; }
    public int FailureCount { get; set; }
    public int TotalRequests { get; set; }
    public DateTime? LastFailureTime { get; set; }
    public DateTime? LastSuccessTime { get; set; }
    public DateTime? OpenedAt { get; set; }
}

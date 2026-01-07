namespace CornerApp.API.Services;

/// <summary>
/// Interfaz para políticas de retry
/// </summary>
public interface IRetryPolicy
{
    /// <summary>
    /// Ejecuta una operación con retry automático
    /// </summary>
    Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ejecuta una operación sin valor de retorno con retry automático
    /// </summary>
    Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Ejecuta una operación con retry y callback de fallo
    /// </summary>
    Task<T> ExecuteAsync<T>(
        Func<Task<T>> operation,
        Func<Exception, int, Task<bool>>? shouldRetry,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Configuración de política de retry
/// </summary>
public class RetryPolicyConfig
{
    public int MaxRetryAttempts { get; set; } = 3;
    public TimeSpan InitialDelay { get; set; } = TimeSpan.FromSeconds(1);
    public TimeSpan MaxDelay { get; set; } = TimeSpan.FromSeconds(30);
    public double BackoffMultiplier { get; set; } = 2.0;
    public RetryStrategy Strategy { get; set; } = RetryStrategy.Exponential;
    public List<Type>? RetryableExceptions { get; set; }
    public Func<Exception, bool>? ShouldRetry { get; set; }
}

/// <summary>
/// Estrategias de retry
/// </summary>
public enum RetryStrategy
{
    Fixed,          // Delay fijo entre intentos
    Linear,         // Delay lineal creciente
    Exponential,    // Delay exponencial (backoff)
    Jitter          // Delay con jitter aleatorio
}

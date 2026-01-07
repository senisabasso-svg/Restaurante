using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CornerApp.API.Services;

/// <summary>
/// Factory para crear instancias de Circuit Breaker
/// </summary>
public class CircuitBreakerFactory
{
    private readonly ILoggerFactory _loggerFactory;
    private readonly IConfiguration _configuration;
    private readonly Dictionary<string, ICircuitBreaker> _breakers = new();

    public CircuitBreakerFactory(ILoggerFactory loggerFactory, IConfiguration configuration)
    {
        _loggerFactory = loggerFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// Obtiene o crea un circuit breaker con el nombre especificado
    /// </summary>
    public ICircuitBreaker GetOrCreate(string name)
    {
        if (!_breakers.ContainsKey(name))
        {
            var logger = _loggerFactory.CreateLogger<CircuitBreaker>();
            _breakers[name] = new CircuitBreaker(logger, _configuration, name);
        }

        return _breakers[name];
    }

    /// <summary>
    /// Obtiene todos los circuit breakers
    /// </summary>
    public Dictionary<string, ICircuitBreaker> GetAll()
    {
        return _breakers;
    }
}

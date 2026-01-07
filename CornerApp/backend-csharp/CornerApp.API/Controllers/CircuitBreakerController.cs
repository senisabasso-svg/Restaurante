using CornerApp.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controller para monitorear y gestionar circuit breakers
/// </summary>
[ApiController]
[Route("api/circuitbreaker")]
[Tags("Circuit Breaker")]
public class CircuitBreakerController : ControllerBase
{
    private readonly CircuitBreakerFactory _factory;
    private readonly ILogger<CircuitBreakerController> _logger;

    public CircuitBreakerController(
        CircuitBreakerFactory factory,
        ILogger<CircuitBreakerController> logger)
    {
        _factory = factory;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene el estado de todos los circuit breakers
    /// </summary>
    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        var breakers = _factory.GetAll();
        var status = breakers.ToDictionary(
            kvp => kvp.Key,
            kvp => new
            {
                state = kvp.Value.State.ToString(),
                stats = kvp.Value.GetStats()
            }
        );

        return Ok(new
        {
            success = true,
            message = "Estado de circuit breakers",
            data = status,
            requestId = HttpContext.Items["RequestId"]?.ToString(),
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Obtiene el estado de un circuit breaker específico
    /// </summary>
    [HttpGet("status/{name}")]
    public IActionResult GetStatus(string name)
    {
        try
        {
            var breaker = _factory.GetOrCreate(name);
            var stats = breaker.GetStats();

            return Ok(new
            {
                success = true,
                message = $"Estado del circuit breaker '{name}'",
                data = new
                {
                    name = name,
                    state = breaker.State.ToString(),
                    stats = stats
                },
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estado del circuit breaker {Name}", name);
            return NotFound(new
            {
                success = false,
                message = $"Circuit breaker '{name}' no encontrado",
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Reinicia un circuit breaker específico
    /// </summary>
    [HttpPost("reset/{name}")]
    public IActionResult Reset(string name)
    {
        try
        {
            var breaker = _factory.GetOrCreate(name);
            breaker.Reset();

            _logger.LogInformation("Circuit breaker {Name} reiniciado manualmente", name);

            return Ok(new
            {
                success = true,
                message = $"Circuit breaker '{name}' reiniciado exitosamente",
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al reiniciar circuit breaker {Name}", name);
            return StatusCode(500, new
            {
                success = false,
                message = $"Error al reiniciar circuit breaker '{name}'",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }
}

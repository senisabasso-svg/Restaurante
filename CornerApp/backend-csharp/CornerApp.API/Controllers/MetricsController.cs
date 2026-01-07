using Microsoft.AspNetCore.Mvc;
using CornerApp.API.Services;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador para obtener métricas de la API
/// </summary>
[ApiController]
[Route("api/metrics")]
[Tags("Métricas")]
public class MetricsController : ControllerBase
{
    private readonly IMetricsService _metricsService;
    private readonly ILogger<MetricsController> _logger;

    public MetricsController(IMetricsService metricsService, ILogger<MetricsController> logger)
    {
        _metricsService = metricsService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene las métricas actuales de la API
    /// </summary>
    [HttpGet]
    public ActionResult<ApiMetrics> GetMetrics()
    {
        try
        {
            var metrics = _metricsService.GetMetrics();
            return Ok(metrics);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener métricas");
            return StatusCode(500, new { error = "Error al obtener métricas", message = ex.Message });
        }
    }

    /// <summary>
    /// Reinicia las métricas (solo en desarrollo)
    /// </summary>
    [HttpPost("reset")]
    public ActionResult ResetMetrics()
    {
        try
        {
            _metricsService.ResetMetrics();
            _logger.LogInformation("Métricas reiniciadas");
            return Ok(new { message = "Métricas reiniciadas exitosamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al reiniciar métricas");
            return StatusCode(500, new { error = "Error al reiniciar métricas", message = ex.Message });
        }
    }
}

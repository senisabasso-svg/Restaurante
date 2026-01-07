using CornerApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controller para gestionar feature flags
/// </summary>
[ApiController]
[Route("api/featureflags")]
[Tags("Feature Flags")]
[Authorize] // Requiere autenticación para gestionar feature flags
public class FeatureFlagsController : ControllerBase
{
    private readonly IFeatureFlagsService _featureFlagsService;
    private readonly ILogger<FeatureFlagsController> _logger;

    public FeatureFlagsController(
        IFeatureFlagsService featureFlagsService,
        ILogger<FeatureFlagsController> logger)
    {
        _featureFlagsService = featureFlagsService;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene el estado de todas las feature flags
    /// </summary>
    [HttpGet]
    public IActionResult GetAllFeatures()
    {
        var features = _featureFlagsService.GetAllFeatures();
        
        return Ok(new
        {
            success = true,
            message = "Feature flags obtenidas",
            data = features,
            requestId = HttpContext.Items["RequestId"]?.ToString(),
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Verifica si una feature está habilitada
    /// </summary>
    [HttpGet("{featureName}")]
    public IActionResult IsFeatureEnabled(string featureName)
    {
        var isEnabled = _featureFlagsService.IsEnabled(featureName);
        
        return Ok(new
        {
            success = true,
            message = $"Estado de feature flag '{featureName}'",
            data = new
            {
                featureName = featureName,
                enabled = isEnabled
            },
            requestId = HttpContext.Items["RequestId"]?.ToString(),
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Verifica si una feature está habilitada para el usuario actual
    /// </summary>
    [HttpGet("{featureName}/user")]
    public IActionResult IsFeatureEnabledForUser(string featureName)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int? userId = null;
        
        if (int.TryParse(userIdClaim, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var isEnabled = _featureFlagsService.IsEnabledForUser(featureName, userId);
        
        return Ok(new
        {
            success = true,
            message = $"Estado de feature flag '{featureName}' para usuario",
            data = new
            {
                featureName = featureName,
                userId = userId,
                enabled = isEnabled
            },
            requestId = HttpContext.Items["RequestId"]?.ToString(),
            timestamp = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Habilita una feature flag
    /// </summary>
    [HttpPost("{featureName}/enable")]
    public IActionResult EnableFeature(string featureName)
    {
        try
        {
            _featureFlagsService.EnableFeature(featureName);
            
            _logger.LogInformation("Feature flag '{FeatureName}' habilitada por usuario {UserId}", 
                featureName, User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

            return Ok(new
            {
                success = true,
                message = $"Feature flag '{featureName}' habilitada",
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al habilitar feature flag {FeatureName}", featureName);
            return StatusCode(500, new
            {
                success = false,
                message = $"Error al habilitar feature flag '{featureName}'",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Deshabilita una feature flag
    /// </summary>
    [HttpPost("{featureName}/disable")]
    public IActionResult DisableFeature(string featureName)
    {
        try
        {
            _featureFlagsService.DisableFeature(featureName);
            
            _logger.LogInformation("Feature flag '{FeatureName}' deshabilitada por usuario {UserId}", 
                featureName, User.FindFirst(ClaimTypes.NameIdentifier)?.Value);

            return Ok(new
            {
                success = true,
                message = $"Feature flag '{featureName}' deshabilitada",
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al deshabilitar feature flag {FeatureName}", featureName);
            return StatusCode(500, new
            {
                success = false,
                message = $"Error al deshabilitar feature flag '{featureName}'",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }
}

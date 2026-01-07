using CornerApp.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controller para gestionar webhooks
/// </summary>
[ApiController]
[Route("api/webhooks")]
[Tags("Webhooks")]
[Authorize] // Requiere autenticación
public class WebhooksController : ControllerBase
{
    private readonly IWebhookService _webhookService;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        IWebhookService webhookService,
        ILogger<WebhooksController> logger)
    {
        _webhookService = webhookService;
        _logger = logger;
    }

    /// <summary>
    /// Suscribe un webhook para un tipo de evento
    /// </summary>
    [HttpPost("subscribe")]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeWebhookRequest request)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? userId = null;
            if (int.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var subscription = await _webhookService.SubscribeAsync(
                request.Url,
                request.EventType,
                userId,
                request.Secret);

            return CreatedAtAction(
                nameof(GetSubscription),
                new { id = subscription.Id },
                new
                {
                    success = true,
                    message = "Webhook suscrito exitosamente",
                    data = new
                    {
                        id = subscription.Id,
                        url = subscription.Url,
                        eventType = subscription.EventType,
                        secret = subscription.Secret,
                        createdAt = subscription.CreatedAt
                    },
                    requestId = HttpContext.Items["RequestId"]?.ToString(),
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al suscribir webhook");
            return BadRequest(new
            {
                success = false,
                message = "Error al suscribir webhook",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Obtiene una suscripción por ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetSubscription(int id)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? userId = null;
            if (int.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var subscriptions = await _webhookService.GetUserSubscriptionsAsync(userId ?? 0);
            var subscription = subscriptions.FirstOrDefault(s => s.Id == id);

            if (subscription == null)
            {
                return NotFound(new
                {
                    success = false,
                    message = "Suscripción no encontrada",
                    requestId = HttpContext.Items["RequestId"]?.ToString()
                });
            }

            return Ok(new
            {
                success = true,
                message = "Suscripción obtenida",
                data = subscription,
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener suscripción {Id}", id);
            return StatusCode(500, new
            {
                success = false,
                message = "Error al obtener suscripción",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Obtiene todas las suscripciones del usuario actual
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetSubscriptions()
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            int? userId = null;
            if (int.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }

            var subscriptions = await _webhookService.GetUserSubscriptionsAsync(userId ?? 0);

            return Ok(new
            {
                success = true,
                message = "Suscripciones obtenidas",
                data = subscriptions,
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener suscripciones");
            return StatusCode(500, new
            {
                success = false,
                message = "Error al obtener suscripciones",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }

    /// <summary>
    /// Desuscribe un webhook
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Unsubscribe(int id)
    {
        try
        {
            await _webhookService.UnsubscribeAsync(id);

            return Ok(new
            {
                success = true,
                message = "Webhook desuscrito exitosamente",
                requestId = HttpContext.Items["RequestId"]?.ToString(),
                timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al desuscribir webhook {Id}", id);
            return BadRequest(new
            {
                success = false,
                message = "Error al desuscribir webhook",
                error = ex.Message,
                requestId = HttpContext.Items["RequestId"]?.ToString()
            });
        }
    }
}

/// <summary>
/// Request para suscribir un webhook
/// </summary>
public class SubscribeWebhookRequest
{
    public string Url { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public string? Secret { get; set; }
}

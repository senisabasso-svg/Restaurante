using CornerApp.API.Data;
using CornerApp.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace CornerApp.API.Services;

/// <summary>
/// Implementación del servicio de webhooks
/// </summary>
public class WebhookService : IWebhookService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<WebhookService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IBackgroundTaskQueue _backgroundTaskQueue;
    private readonly IConfiguration _configuration;

    public WebhookService(
        ApplicationDbContext context,
        ILogger<WebhookService> logger,
        IHttpClientFactory httpClientFactory,
        IBackgroundTaskQueue backgroundTaskQueue,
        IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _backgroundTaskQueue = backgroundTaskQueue;
        _configuration = configuration;
    }

    public async Task<WebhookSubscription> SubscribeAsync(string url, string eventType, int? userId = null, string? secret = null)
    {
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(eventType))
        {
            throw new ArgumentException("URL y EventType son requeridos");
        }

        // Validar URL
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || 
            (uri.Scheme != "http" && uri.Scheme != "https"))
        {
            throw new ArgumentException("URL inválida. Debe ser HTTP o HTTPS");
        }

        // Generar secret si no se proporciona
        if (string.IsNullOrWhiteSpace(secret))
        {
            secret = GenerateSecret();
        }

        var subscription = new WebhookSubscription
        {
            Url = url,
            EventType = eventType,
            Secret = secret,
            UserId = userId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Set<WebhookSubscription>().Add(subscription);
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Webhook suscrito: {EventType} -> {Url} (ID: {SubscriptionId})",
            eventType,
            url,
            subscription.Id);

        return subscription;
    }

    public async Task UnsubscribeAsync(int subscriptionId)
    {
        var subscription = await _context.Set<WebhookSubscription>()
            .FirstOrDefaultAsync(s => s.Id == subscriptionId);

        if (subscription == null)
        {
            throw new ArgumentException($"Suscripción {subscriptionId} no encontrada");
        }

        subscription.IsActive = false;
        await _context.SaveChangesAsync();

        _logger.LogInformation("Webhook desuscrito: {SubscriptionId}", subscriptionId);
    }

    public async Task TriggerWebhookAsync(string eventType, object payload, Dictionary<string, string>? additionalHeaders = null)
    {
        var subscriptions = await GetSubscriptionsAsync(eventType);

        if (!subscriptions.Any())
        {
            _logger.LogDebug("No hay suscripciones activas para evento {EventType}", eventType);
        }

        // Verificar webhook global del negocio para pedidos completados
        if (eventType == "order.completed")
        {
            var businessInfo = await _context.BusinessInfo.AsNoTracking().FirstOrDefaultAsync();
            if (!string.IsNullOrEmpty(businessInfo?.OrderCompletionWebhookUrl))
            {
                subscriptions.Add(new WebhookSubscription
                {
                    Id = 0, // ID 0 indica que no está persistido
                    Url = businessInfo.OrderCompletionWebhookUrl,
                    EventType = eventType,
                    Secret = "",
                    IsActive = true
                });
            }
        }

        if (!subscriptions.Any())
        {
            _logger.LogDebug("No hay suscripciones activas para evento {EventType}", eventType);
            return;
        }

        _logger.LogInformation(
            "Disparando webhook para evento {EventType} a {Count} suscripciones",
            eventType,
            subscriptions.Count);

        foreach (var subscription in subscriptions)
        {
            // Encolar en background para no bloquear
            await _backgroundTaskQueue.QueueBackgroundWorkItemAsync(async cancellationToken =>
            {
                await SendWebhookAsync(subscription, eventType, payload, additionalHeaders, cancellationToken);
            });
        }
    }

    public async Task<List<WebhookSubscription>> GetSubscriptionsAsync(string eventType)
    {
        return await _context.Set<WebhookSubscription>()
            .Where(s => s.EventType == eventType && s.IsActive)
            .ToListAsync();
    }

    public async Task<List<WebhookSubscription>> GetUserSubscriptionsAsync(int userId)
    {
        return await _context.Set<WebhookSubscription>()
            .Where(s => s.UserId == userId)
            .ToListAsync();
    }

    private async Task SendWebhookAsync(
        WebhookSubscription subscription,
        string eventType,
        object payload,
        Dictionary<string, string>? additionalHeaders,
        CancellationToken cancellationToken)
    {
        try
        {
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            var jsonPayload = JsonSerializer.Serialize(new
            {
                @event = eventType,
                timestamp = DateTime.UtcNow,
                data = payload
            });

            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, subscription.Url)
            {
                Content = content
            };

            // Agregar headers
            request.Headers.Add("X-Webhook-Event", eventType);
            request.Headers.Add("X-Webhook-Signature", GenerateSignature(jsonPayload, subscription.Secret ?? string.Empty));
            request.Headers.Add("User-Agent", "CornerApp-Webhook/1.0");

            if (additionalHeaders != null)
            {
                foreach (var header in additionalHeaders)
                {
                    request.Headers.Add(header.Key, header.Value);
                }
            }

            // Parsear headers adicionales de la suscripción
            if (!string.IsNullOrWhiteSpace(subscription.Headers))
            {
                try
                {
                    var headers = JsonSerializer.Deserialize<Dictionary<string, string>>(subscription.Headers);
                    if (headers != null)
                    {
                        foreach (var header in headers)
                        {
                            request.Headers.Add(header.Key, header.Value);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error al parsear headers adicionales de suscripción {SubscriptionId}", subscription.Id);
                }
            }

            var response = await httpClient.SendAsync(request, cancellationToken);

            // Actualizar estadísticas
            // Actualizar estadísticas solo si la suscripción existe en la BD
            if (subscription.Id > 0)
            {
                subscription.LastTriggeredAt = DateTime.UtcNow;
                if (response.IsSuccessStatusCode)
                {
                    subscription.SuccessCount++;
                }
                else
                {
                    subscription.FailureCount++;
                }

                await _context.SaveChangesAsync(cancellationToken);
            }

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "Webhook enviado exitosamente: {EventType} -> {Url} (Status: {StatusCode})",
                    eventType,
                    subscription.Url,
                    response.StatusCode);
            }
            else
            {
                _logger.LogWarning(
                    "Webhook falló: {EventType} -> {Url} (Status: {StatusCode})",
                    eventType,
                    subscription.Url,
                    response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            if (subscription.Id > 0)
            {
                subscription.FailureCount++;
                subscription.LastTriggeredAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }

            _logger.LogError(
                ex,
                "Error al enviar webhook: {EventType} -> {Url}",
                eventType,
                subscription.Url);
        }
    }

    private string GenerateSecret()
    {
        var bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(bytes);
        }
        return Convert.ToBase64String(bytes);
    }

    private string GenerateSignature(string payload, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToBase64String(hash);
    }
}

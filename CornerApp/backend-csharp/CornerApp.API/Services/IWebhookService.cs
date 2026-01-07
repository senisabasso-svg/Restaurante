using CornerApp.API.Models;

namespace CornerApp.API.Services;

/// <summary>
/// Servicio para gestionar webhooks
/// </summary>
public interface IWebhookService
{
    /// <summary>
    /// Registra una suscripción a webhook
    /// </summary>
    Task<WebhookSubscription> SubscribeAsync(string url, string eventType, int? userId = null, string? secret = null);

    /// <summary>
    /// Desactiva una suscripción
    /// </summary>
    Task UnsubscribeAsync(int subscriptionId);

    /// <summary>
    /// Dispara un webhook para un evento
    /// </summary>
    Task TriggerWebhookAsync(string eventType, object payload, Dictionary<string, string>? additionalHeaders = null);

    /// <summary>
    /// Obtiene todas las suscripciones activas para un tipo de evento
    /// </summary>
    Task<List<WebhookSubscription>> GetSubscriptionsAsync(string eventType);

    /// <summary>
    /// Obtiene todas las suscripciones de un usuario
    /// </summary>
    Task<List<WebhookSubscription>> GetUserSubscriptionsAsync(int userId);
}

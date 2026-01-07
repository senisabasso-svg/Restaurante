namespace CornerApp.API.Models;

/// <summary>
/// Suscripción a webhooks
/// </summary>
public class WebhookSubscription
{
    public int Id { get; set; }
    public string Url { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty; // order.created, product.updated, etc.
    public string? Secret { get; set; } // Para validar que el webhook viene de nuestro sistema
    public bool IsActive { get; set; } = true;
    public int? UserId { get; set; } // Usuario que creó la suscripción
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastTriggeredAt { get; set; }
    public int SuccessCount { get; set; } = 0;
    public int FailureCount { get; set; } = 0;
    public string? Headers { get; set; } // JSON con headers adicionales
}

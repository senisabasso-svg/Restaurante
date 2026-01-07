using System.ComponentModel.DataAnnotations;
using CornerApp.API.Constants;

namespace CornerApp.API.Models;

/// <summary>
/// Información del negocio/tienda
/// </summary>
public class BusinessInfo
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string StoreName { get; set; } = "Mi Tienda";
    
    [MaxLength(500)]
    public string? Description { get; set; }
    
    [MaxLength(200)]
    public string? Address { get; set; }
    
    // Coordenadas del negocio (latitud y longitud)
    public double? StoreLatitude { get; set; }
    public double? StoreLongitude { get; set; }
    
    // Configuración geográfica para validación de coordenadas
    [MaxLength(100)]
    public string? CityName { get; set; } = "Salto, Uruguay"; // Nombre de la ciudad/región para mensajes y geocodificación
    
    // Límites geográficos para validación de coordenadas GPS
    public double? MinLatitude { get; set; } = -31.8;   // Latitud mínima (Sur)
    public double? MaxLatitude { get; set; } = -31.0;   // Latitud máxima (Norte)
    public double? MinLongitude { get; set; } = -58.3;  // Longitud mínima (Oeste)
    public double? MaxLongitude { get; set; } = -57.5;  // Longitud máxima (Este)
    
    [MaxLength(20)]
    public string? Phone { get; set; }
    
    [MaxLength(20)]
    public string? WhatsApp { get; set; }
    
    [MaxLength(100)]
    public string? Email { get; set; }
    
    [MaxLength(200)]
    public string? Instagram { get; set; }
    
    [MaxLength(200)]
    public string? Facebook { get; set; }
    
    // Horarios de atención
    [MaxLength(500)]
    public string? BusinessHours { get; set; } // JSON format: {"monday": "09:00-18:00", ...}
    
    // Horarios de operación para pedidos (formato HH:mm, ej: "20:00", "00:00")
    [MaxLength(5)]
    public string? OpeningTime { get; set; } = "20:00"; // Hora de apertura (default: 8:00 PM)
    
    [MaxLength(5)]
    public string? ClosingTime { get; set; } = "00:00"; // Hora de cierre (default: 12:00 AM)
    
    // Configuración de pedidos
    public decimal MinimumOrderAmount { get; set; } = 0;
    public int EstimatedDeliveryMinutes { get; set; } = 30;
    public bool IsOpen { get; set; } = true;
    public int PointsPerOrder { get; set; } = AppConstants.DEFAULT_POINTS_PER_ORDER;
    
    // Mensaje personalizado
    [MaxLength(500)]
    public string? WelcomeMessage { get; set; }
    
    [MaxLength(500)]
    public string? ClosedMessage { get; set; } = "Estamos cerrados. ¡Volvemos pronto!";

    // Webhook settings
    [MaxLength(500)]
    public string? OrderCompletionWebhookUrl { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}


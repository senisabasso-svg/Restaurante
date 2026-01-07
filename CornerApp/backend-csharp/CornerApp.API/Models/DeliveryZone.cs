using System.ComponentModel.DataAnnotations;

namespace CornerApp.API.Models;

/// <summary>
/// Configuración de zona de entrega almacenada en base de datos
/// </summary>
public class DeliveryZoneConfig
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = "Zona Principal";
    
    // Coordenadas del centro (tienda)
    public double StoreLatitude { get; set; } = -31.3833;
    public double StoreLongitude { get; set; } = -57.9667;
    
    // Radio máximo de entrega en kilómetros
    public double MaxDeliveryRadiusKm { get; set; } = 5.0;
    
    // ¿Está activa la validación de zona?
    public bool IsEnabled { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}


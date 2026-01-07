namespace CornerApp.API.Models;

/// <summary>
/// Representa una mesa del restaurante
/// </summary>
public class Table
{
    public int Id { get; set; }
    
    /// <summary>
    /// Número o nombre de la mesa (ej: "Mesa 1", "Mesa A", "Terraza 3")
    /// </summary>
    public string Number { get; set; } = string.Empty;
    
    /// <summary>
    /// Capacidad de la mesa (número de personas)
    /// </summary>
    public int Capacity { get; set; }
    
    /// <summary>
    /// Ubicación o zona de la mesa (ej: "Interior", "Terraza", "Ventana")
    /// </summary>
    public string? Location { get; set; }
    
    /// <summary>
    /// ID del espacio al que pertenece la mesa (opcional)
    /// </summary>
    public int? SpaceId { get; set; }
    
    /// <summary>
    /// Espacio al que pertenece la mesa
    /// </summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public Space? Space { get; set; }
    
    /// <summary>
    /// Posición X en el plano del salón (en píxeles o porcentaje)
    /// </summary>
    public double? PositionX { get; set; }
    
    /// <summary>
    /// Posición Y en el plano del salón (en píxeles o porcentaje)
    /// </summary>
    public double? PositionY { get; set; }
    
    /// <summary>
    /// Estado de la mesa: Available, Occupied, Reserved, Cleaning
    /// </summary>
    public string Status { get; set; } = "Available"; // Available, Occupied, Reserved, Cleaning
    
    /// <summary>
    /// Si la mesa está activa (no eliminada)
    /// </summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>
    /// Notas adicionales sobre la mesa
    /// </summary>
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Relación con pedidos (opcional, para tracking de pedidos por mesa)
    [System.Text.Json.Serialization.JsonIgnore]
    public List<Order> Orders { get; set; } = new();
}


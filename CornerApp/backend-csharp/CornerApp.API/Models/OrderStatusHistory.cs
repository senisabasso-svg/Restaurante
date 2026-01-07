namespace CornerApp.API.Models;

/// <summary>
/// Historial de cambios de estado de un pedido
/// </summary>
public class OrderStatusHistory
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string? ChangedBy { get; set; } // "admin", "delivery", "system", o nombre de usuario
    public string? Note { get; set; } // Nota opcional
    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public Order? Order { get; set; }
}


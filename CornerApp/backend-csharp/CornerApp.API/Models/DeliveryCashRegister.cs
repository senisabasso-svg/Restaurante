namespace CornerApp.API.Models;

/// <summary>
/// Representa una sesión de caja de repartidor (apertura/cierre)
/// Permite que los repartidores gestionen sus pedidos desde la app web
/// </summary>
public class DeliveryCashRegister
{
    public int Id { get; set; }
    
    // Multi-tenant: cada caja de repartidor pertenece a un restaurante
    public int RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }
    
    /// <summary>
    /// ID del repartidor que abrió la caja
    /// </summary>
    public int DeliveryPersonId { get; set; }
    public DeliveryPerson? DeliveryPerson { get; set; }
    
    /// <summary>
    /// Fecha y hora de apertura de la caja
    /// </summary>
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Fecha y hora de cierre de la caja (null si está abierta)
    /// </summary>
    public DateTime? ClosedAt { get; set; }
    
    /// <summary>
    /// Si la caja está actualmente abierta
    /// </summary>
    public bool IsOpen { get; set; } = true;
    
    /// <summary>
    /// Monto inicial de cambio en efectivo al abrir la caja
    /// </summary>
    public decimal InitialAmount { get; set; }
    
    /// <summary>
    /// Monto final en efectivo al cerrar la caja (calculado)
    /// </summary>
    public decimal? FinalAmount { get; set; }
    
    /// <summary>
    /// Total de ventas durante esta sesión de caja
    /// </summary>
    public decimal TotalSales { get; set; }
    
    /// <summary>
    /// Total recibido en efectivo
    /// </summary>
    public decimal TotalCash { get; set; }
    
    /// <summary>
    /// Total recibido en POS
    /// </summary>
    public decimal TotalPOS { get; set; }
    
    /// <summary>
    /// Total recibido en transferencias
    /// </summary>
    public decimal TotalTransfer { get; set; }
    
    /// <summary>
    /// Notas al cerrar la caja
    /// </summary>
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

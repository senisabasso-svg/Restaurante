namespace CornerApp.API.Models;

/// <summary>
/// Representa una sesión de caja (apertura/cierre)
/// </summary>
public class CashRegister
{
    public int Id { get; set; }
    
    /// <summary>
    /// Fecha y hora de apertura de la caja
    /// </summary>
    public DateTime OpenedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Fecha y hora de cierre de la caja (null si está abierta)
    /// </summary>
    public DateTime? ClosedAt { get; set; }
    
    /// <summary>
    /// Monto inicial de cambio en la caja al abrir
    /// </summary>
    public decimal InitialAmount { get; set; }
    
    /// <summary>
    /// Monto final en caja al cerrar (calculado)
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
    /// Si la caja está actualmente abierta
    /// </summary>
    public bool IsOpen { get; set; } = true;
    
    /// <summary>
    /// Usuario que abrió la caja
    /// </summary>
    public string? CreatedBy { get; set; }
    
    /// <summary>
    /// Usuario que cerró la caja
    /// </summary>
    public string? ClosedBy { get; set; }
    
    /// <summary>
    /// Notas al cerrar la caja
    /// </summary>
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

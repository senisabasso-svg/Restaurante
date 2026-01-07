using CornerApp.API.Constants;

namespace CornerApp.API.Models;

public class Order
{
    public int Id { get; set; }
    
    // Relación con Customer (opcional - para clientes registrados)
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    
    // Relación con DeliveryPerson (repartidor asignado)
    public int? DeliveryPersonId { get; set; }
    public DeliveryPerson? DeliveryPerson { get; set; }
    
    // Relación con Table (opcional - para pedidos en mesa)
    public int? TableId { get; set; }
    [System.Text.Json.Serialization.JsonIgnore]
    public Table? Table { get; set; }
    
    // Datos del cliente (para pedidos sin registro o como respaldo)
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = PaymentConstants.METHOD_CASH;
    public string Status { get; set; } = OrderConstants.STATUS_PENDING;
    public int EstimatedDeliveryMinutes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsArchived { get; set; } = false; // Para historial - pedidos archivados no se eliminan
    public DateTime? ArchivedAt { get; set; } // Fecha de archivado
    
    public List<OrderItem> Items { get; set; } = new();
    
    // Historial de cambios de estado
    public List<OrderStatusHistory> StatusHistory { get; set; } = new();
    
    // Información de pago Mercado Pago (legacy)
    public string? MercadoPagoPreferenceId { get; set; }
    public string? MercadoPagoPaymentId { get; set; }
    
    // Comprobante de transferencia (base64)
    public string? TransferReceiptImage { get; set; }
    public bool IsReceiptVerified { get; set; } = false; // Si el comprobante ha sido verificado
    public DateTime? ReceiptVerifiedAt { get; set; } // Fecha de verificación
    public string? ReceiptVerifiedBy { get; set; } // Usuario que verificó (admin)
    
    // Ubicación del repartidor (para tracking en tiempo real)
    public double? DeliveryLatitude { get; set; }
    public double? DeliveryLongitude { get; set; }
    public DateTime? DeliveryLocationUpdatedAt { get; set; }
    
    // Ubicación del cliente (para calcular ruta)
    public double? CustomerLatitude { get; set; }
    public double? CustomerLongitude { get; set; }
    
    // Comentarios del pedido (notas especiales, modificaciones, etc.)
    public string? Comments { get; set; }
}

public class OrderItem
{
    public int OrderId { get; set; } // Para EF Core
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal Subtotal => UnitPrice * Quantity;
}


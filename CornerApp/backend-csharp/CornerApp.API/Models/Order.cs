using CornerApp.API.Constants;

namespace CornerApp.API.Models;

public class Order
{
    public int Id { get; set; }
    
    // Multi-tenant: cada pedido pertenece a un restaurante
    public int RestaurantId { get; set; }
    public Restaurant? Restaurant { get; set; }
    
    // Relación con Customer (opcional - para clientes registrados)
    public int? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    
    // Relación con DeliveryPerson (repartidor asignado)
    public int? DeliveryPersonId { get; set; }
    public DeliveryPerson? DeliveryPerson { get; set; }
    
    // Relación con Table (opcional - para pedidos en mesa)
    public int? TableId { get; set; }
    public Table? Table { get; set; } // Incluido en JSON para mostrar número de mesa en frontend
    
    // Datos del cliente (para pedidos sin registro o como respaldo)
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string CustomerEmail { get; set; } = string.Empty;
    
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = PaymentConstants.METHOD_CASH;
    public string Status { get; set; } = OrderConstants.STATUS_PREPARING; // Por defecto ir directamente a cocina
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
    
    // Información de transacción POS
    public long? POSTransactionId { get; set; }
    public string? POSTransactionIdString { get; set; }
    public string? POSTransactionDateTime { get; set; }
    public string? POSResponse { get; set; } // Respuesta completa del POS para referencia
    
    // Información de devolución POS (refund/void)
    public long? POSRefundTransactionId { get; set; }
    public string? POSRefundTransactionIdString { get; set; }
    public string? POSRefundTransactionDateTime { get; set; }
    public string? POSRefundResponse { get; set; } // Respuesta completa de la devolución POS
    public DateTime? POSRefundedAt { get; set; } // Fecha/hora en que se procesó la devolución
    
    // Información de reverso POS (reverse)
    public long? POSReverseTransactionId { get; set; }
    public string? POSReverseTransactionIdString { get; set; }
    public string? POSReverseResponse { get; set; } // Respuesta completa del reverso POS
    public DateTime? POSReversedAt { get; set; } // Fecha/hora en que se procesó el reverso
    
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
    public int Id { get; set; } // ID del item (primary key)
    public int OrderId { get; set; } // Para EF Core
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int? CategoryId { get; set; } // ID de la categoría del producto
    public string? CategoryName { get; set; } // Nombre de la categoría del producto (para facilitar filtrado)
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal Subtotal => UnitPrice * Quantity;
    
    // Subproductos (guarniciones) asociados a este item
    // Se almacena como JSON string para flexibilidad
    public string? SubProductsJson { get; set; }
    
    // Propiedad calculada para deserializar subproductos
    // Se serializa como JSON en lugar de ignorarse para que esté disponible en las respuestas API
    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    [System.Text.Json.Serialization.JsonPropertyName("subProducts")]
    public List<OrderItemSubProduct>? SubProducts
    {
        get
        {
            if (string.IsNullOrWhiteSpace(SubProductsJson))
                return null;
            
            try
            {
                return System.Text.Json.JsonSerializer.Deserialize<List<OrderItemSubProduct>>(SubProductsJson);
            }
            catch
            {
                return null;
            }
        }
        set
        {
            if (value == null || !value.Any())
            {
                SubProductsJson = null;
            }
            else
            {
                SubProductsJson = System.Text.Json.JsonSerializer.Serialize(value);
            }
        }
    }
}

/// <summary>
/// Representa un subproducto (guarnición) asociado a un item de pedido
/// </summary>
public class OrderItemSubProduct
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
}


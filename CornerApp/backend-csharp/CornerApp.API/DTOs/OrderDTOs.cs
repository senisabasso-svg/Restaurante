using System.ComponentModel.DataAnnotations;

namespace CornerApp.API.DTOs;

/// <summary>
/// DTO para crear un pedido
/// </summary>
public class CreateOrderRequest
{
    [Required(ErrorMessage = "El nombre del cliente es requerido")]
    [StringLength(200, MinimumLength = 2, ErrorMessage = "El nombre debe tener entre 2 y 200 caracteres")]
    public string CustomerName { get; set; } = string.Empty;
    
    [StringLength(20, MinimumLength = 8, ErrorMessage = "El teléfono debe tener entre 8 y 20 caracteres")]
    [RegularExpression(@"^[\d\s\-\+\(\)]+$", ErrorMessage = "El formato del teléfono no es válido")]
    public string? CustomerPhone { get; set; }
    
    [StringLength(500, MinimumLength = 10, ErrorMessage = "La dirección debe tener entre 10 y 500 caracteres")]
    public string? CustomerAddress { get; set; }
    
    [EmailAddress(ErrorMessage = "El formato del email no es válido")]
    [StringLength(200, ErrorMessage = "El email no puede exceder 200 caracteres")]
    public string? CustomerEmail { get; set; }
    
    [StringLength(50, ErrorMessage = "El método de pago no puede exceder 50 caracteres")]
    public string? PaymentMethod { get; set; }
    
    public string? ReceiptImage { get; set; } // Base64 image para transferencia
    
    [StringLength(1000, ErrorMessage = "Los comentarios no pueden exceder 1000 caracteres")]
    public string? Comments { get; set; } // Comentarios o notas del pedido
    
    [Range(-90, 90, ErrorMessage = "La latitud debe estar entre -90 y 90")]
    public double? CustomerLatitude { get; set; } // Coordenadas GPS del cliente (opcional)
    
    [Range(-180, 180, ErrorMessage = "La longitud debe estar entre -180 y 180")]
    public double? CustomerLongitude { get; set; } // Coordenadas GPS del cliente (opcional)
    
    /// <summary>
    /// ID de la mesa desde la cual se realiza el pedido (opcional, para pedidos en mesa)
    /// </summary>
    public int? TableId { get; set; }
    
    [Required(ErrorMessage = "El pedido debe contener al menos un item")]
    [MinLength(1, ErrorMessage = "El pedido debe contener al menos un item")]
    public List<OrderItemRequest> Items { get; set; } = new();
}

/// <summary>
/// DTO para un item de pedido
/// </summary>
public class OrderItemRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "El ID del producto debe ser mayor a 0")]
    public int Id { get; set; }
    
    [Required(ErrorMessage = "El nombre del producto es requerido")]
    [StringLength(200, ErrorMessage = "El nombre no puede exceder 200 caracteres")]
    public string Name { get; set; } = string.Empty;
    
    [Range(0.01, 999999.99, ErrorMessage = "El precio debe estar entre 0.01 y 999999.99")]
    public decimal Price { get; set; }
    
    [Required(ErrorMessage = "La cantidad es requerida")]
    [Range(1, 100, ErrorMessage = "La cantidad debe estar entre 1 y 100")]
    public int Quantity { get; set; }
    
    /// <summary>
    /// Subproductos (guarniciones) asociados a este item
    /// </summary>
    public List<OrderItemSubProductRequest>? SubProducts { get; set; }
}

/// <summary>
/// DTO para un subproducto (guarnición) en un item de pedido
/// </summary>
public class OrderItemSubProductRequest
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
}

/// <summary>
/// DTO para actualizar el estado de un pedido
/// </summary>
public class UpdateOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

/// <summary>
/// DTO para actualizar el tiempo estimado de entrega
/// </summary>
public class UpdateEstimatedTimeRequest
{
    public int Minutes { get; set; }
}

/// <summary>
/// DTO para actualizar la ubicación de entrega
/// </summary>
public class UpdateDeliveryLocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

/// <summary>
/// DTO para actualizar la ubicación del cliente
/// </summary>
public class UpdateCustomerLocationRequest
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

/// <summary>
/// DTO para asignar un repartidor a un pedido
/// </summary>
public class AssignDeliveryPersonRequest
{
    public int? DeliveryPersonId { get; set; }
}

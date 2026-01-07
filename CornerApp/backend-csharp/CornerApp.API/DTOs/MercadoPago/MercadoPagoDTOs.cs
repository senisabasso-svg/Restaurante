namespace CornerApp.API.DTOs.MercadoPago;

/// <summary>
/// DTO para crear una preferencia de pago en MercadoPago
/// </summary>
public class CreatePreferenceRequest
{
    public decimal Total { get; set; }
    public List<PreferenceOrderItem> Items { get; set; } = new();
    public CustomerData Customer { get; set; } = new();
}

/// <summary>
/// Item de pedido para MercadoPago
/// </summary>
public class PreferenceOrderItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Quantity { get; set; }
}

/// <summary>
/// Datos del cliente para MercadoPago
/// </summary>
public class CustomerData
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

/// <summary>
/// Respuesta de creación de preferencia en MercadoPago
/// </summary>
public class CreatePreferenceResponse
{
    public bool Success { get; set; }
    public string CheckoutUrl { get; set; } = string.Empty;
    public string PreferenceId { get; set; } = string.Empty;
    public bool Sandbox { get; set; }
    public string? Error { get; set; }
    public string? Details { get; set; }
}

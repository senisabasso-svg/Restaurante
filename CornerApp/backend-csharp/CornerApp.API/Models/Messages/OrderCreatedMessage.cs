namespace CornerApp.API.Models.Messages;

/// <summary>
/// Mensaje publicado cuando se crea una nueva orden
/// </summary>
public class OrderCreatedMessage
{
    public int OrderId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<OrderItemMessage> Items { get; set; } = new();
}

/// <summary>
/// Item de orden en el mensaje
/// </summary>
public class OrderItemMessage
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
}

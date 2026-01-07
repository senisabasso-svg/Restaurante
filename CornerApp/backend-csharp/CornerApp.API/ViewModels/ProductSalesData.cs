namespace CornerApp.API.ViewModels;

/// <summary>
/// Datos de ventas de productos para informes
/// </summary>
public class ProductSalesData
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int TotalQuantity { get; set; }
    public decimal TotalRevenue { get; set; }
    public int OrderCount { get; set; }
}

namespace CornerApp.API.ViewModels;

/// <summary>
/// Estadísticas de informes
/// </summary>
public class ReportStats
{
    public decimal TotalRevenue { get; set; }
    public int TotalOrders { get; set; }
    public decimal AverageOrderValue { get; set; }
    public int UniqueCustomers { get; set; }
}

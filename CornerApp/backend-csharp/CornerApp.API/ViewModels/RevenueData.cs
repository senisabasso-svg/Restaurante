namespace CornerApp.API.ViewModels;

/// <summary>
/// Datos de ingresos para informes
/// </summary>
public class RevenueData
{
    public DateTime Date { get; set; }
    public decimal Revenue { get; set; }
    public int OrderCount { get; set; }
}

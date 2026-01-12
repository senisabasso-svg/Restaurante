using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using CornerApp.API.Data;
using CornerApp.API.Constants;
using System.Linq;

namespace CornerApp.API.Controllers;

/// <summary>
/// Controlador API para reportes e ingresos en administración
/// </summary>
[ApiController]
[Route("admin/api/reports")]
[Tags("Administración - Reportes")]
[Authorize(Roles = "Admin")]
public class AdminReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AdminReportsController> _logger;

    public AdminReportsController(
        ApplicationDbContext context,
        ILogger<AdminReportsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Obtiene estadísticas para el dashboard principal
    /// </summary>
    [HttpGet("dashboard-stats")]
    public async Task<ActionResult> GetDashboardStats()
    {
        try
        {
            var today = DateTime.UtcNow.Date;
            var tomorrow = today.AddDays(1);

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => !o.IsArchived)
                .ToListAsync();

            var todayOrders = orders.Where(o => o.CreatedAt >= today && o.CreatedAt < tomorrow).ToList();

            // Contar comprobantes pendientes: pedidos por transferencia que tienen comprobante pero no están verificados
            var transferOrders = orders.Where(o => 
            {
                if (o.PaymentMethod == null) return false;
                var method = o.PaymentMethod.ToLower().Trim();
                return method.Contains("transfer") || method.Contains("transferencia");
            }).ToList();
            
            var pendingReceiptsCount = transferOrders.Count(o => 
            {
                var hasReceipt = !string.IsNullOrWhiteSpace(o.TransferReceiptImage);
                var isUnverified = !o.IsReceiptVerified;
                return hasReceipt && isUnverified;
            });
            
            // Log resumido para debugging (solo si hay pedidos por transferencia)
            if (transferOrders.Any())
            {
                _logger.LogDebug(
                    "Dashboard Stats - Comprobantes pendientes: {Count}. Total pedidos transferencia: {Total}",
                    pendingReceiptsCount,
                    transferOrders.Count);
            }

            var stats = new
            {
                pendingOrders = orders.Count(o => o.Status == OrderConstants.STATUS_PENDING),
                preparingOrders = orders.Count(o => o.Status == OrderConstants.STATUS_PREPARING),
                deliveringOrders = orders.Count(o => o.Status == OrderConstants.STATUS_DELIVERING),
                todayRevenue = todayOrders
                    .Where(o => o.Status == OrderConstants.STATUS_COMPLETED)
                    .Sum(o => o.Total),
                todayOrders = todayOrders.Count,
                totalActiveOrders = orders.Count(o => 
                    o.Status != OrderConstants.STATUS_COMPLETED && 
                    o.Status != OrderConstants.STATUS_CANCELLED),
                pendingReceiptsCount
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estadísticas del dashboard: {Message}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            return StatusCode(500, new { error = "Error al obtener estadísticas del dashboard", details = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene datos de ingresos por período
    /// </summary>
    [HttpGet("revenue")]
    public async Task<ActionResult> GetRevenue([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= startDate && 
                           o.Status == OrderConstants.STATUS_COMPLETED && 
                           !o.IsArchived)
                .ToListAsync();

            var revenueByDay = orders
                .GroupBy(o => o.CreatedAt.Date)
                .Select(g => new
                {
                    Date = g.Key,
                    Revenue = g.Sum(o => o.Total),
                    OrdersCount = g.Count()
                })
                .OrderBy(x => x.Date)
                .ToList();

            var totalRevenue = orders.Sum(o => o.Total);
            var totalOrders = orders.Count;
            var averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            return Ok(new
            {
                period,
                startDate,
                endDate = now,
                totalRevenue,
                totalOrders,
                averageOrderValue,
                revenueByDay
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener ingresos");
            return StatusCode(500, new { error = "Error al obtener ingresos" });
        }
    }

    /// <summary>
    /// Obtiene productos más vendidos
    /// </summary>
    [HttpGet("top-products")]
    public async Task<ActionResult> GetTopProducts(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10)
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Items)
                .Where(o => o.CreatedAt >= startDate && 
                           o.Status == OrderConstants.STATUS_COMPLETED && 
                           !o.IsArchived)
                .ToListAsync();

            var topProducts = orders
                .SelectMany(o => o.Items)
                .GroupBy(item => new { item.ProductId, item.ProductName })
                .Select(g => new
                {
                    ProductId = g.Key.ProductId,
                    ProductName = g.Key.ProductName,
                    QuantitySold = g.Sum(x => x.Quantity),
                    Revenue = g.Sum(x => x.Subtotal)
                })
                .OrderByDescending(x => x.QuantitySold)
                .Take(limit)
                .ToList();

            return Ok(topProducts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener productos más vendidos");
            return StatusCode(500, new { error = "Error al obtener productos más vendidos" });
        }
    }

    /// <summary>
    /// Obtiene estadísticas generales del período
    /// </summary>
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= startDate && !o.IsArchived)
                .ToListAsync();

            var completedOrders = orders.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).ToList();
            var cancelledOrders = orders.Where(o => o.Status == OrderConstants.STATUS_CANCELLED).ToList();

            var stats = new
            {
                period,
                totalOrders = orders.Count,
                completedOrders = completedOrders.Count,
                cancelledOrders = cancelledOrders.Count,
                pendingOrders = orders.Count(o => o.Status == OrderConstants.STATUS_PENDING),
                totalRevenue = completedOrders.Sum(o => o.Total),
                averageOrderValue = completedOrders.Count > 0 
                    ? completedOrders.Average(o => o.Total) 
                    : 0,
                cancellationRate = orders.Count > 0 
                    ? (double)cancelledOrders.Count / orders.Count * 100 
                    : 0,
                completionRate = orders.Count > 0 
                    ? (double)completedOrders.Count / orders.Count * 100 
                    : 0
            };

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener estadísticas");
            return StatusCode(500, new { error = "Error al obtener estadísticas" });
        }
    }

    /// <summary>
    /// Obtiene ingresos por método de pago
    /// </summary>
    [HttpGet("revenue-by-payment-method")]
    public async Task<ActionResult> GetRevenueByPaymentMethod([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var revenueByMethod = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= startDate && 
                           o.Status == OrderConstants.STATUS_COMPLETED && 
                           !o.IsArchived)
                .GroupBy(o => o.PaymentMethod)
                .Select(g => new
                {
                    PaymentMethod = g.Key,
                    Revenue = g.Sum(o => o.Total),
                    OrdersCount = g.Count()
                })
                .OrderByDescending(x => x.Revenue)
                .ToListAsync();

            return Ok(revenueByMethod);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener ingresos por método de pago");
            return StatusCode(500, new { error = "Error al obtener ingresos por método de pago" });
        }
    }

    /// <summary>
    /// Obtiene comparativa con período anterior
    /// </summary>
    [HttpGet("comparison")]
    public async Task<ActionResult> GetComparison([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            
            // Calcular fechas para período actual y anterior
            DateTime currentStart, previousStart, previousEnd;
            switch (period.ToLower())
            {
                case "today":
                    currentStart = now.Date;
                    previousStart = now.Date.AddDays(-1);
                    previousEnd = now.Date;
                    break;
                case "week":
                    currentStart = now.AddDays(-7);
                    previousStart = now.AddDays(-14);
                    previousEnd = now.AddDays(-7);
                    break;
                case "year":
                    currentStart = now.AddYears(-1);
                    previousStart = now.AddYears(-2);
                    previousEnd = now.AddYears(-1);
                    break;
                default: // month
                    currentStart = now.AddMonths(-1);
                    previousStart = now.AddMonths(-2);
                    previousEnd = now.AddMonths(-1);
                    break;
            }

            var allOrders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= previousStart && !o.IsArchived)
                .ToListAsync();

            var currentOrders = allOrders.Where(o => o.CreatedAt >= currentStart).ToList();
            var previousOrders = allOrders.Where(o => o.CreatedAt >= previousStart && o.CreatedAt < previousEnd).ToList();

            var currentCompleted = currentOrders.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).ToList();
            var previousCompleted = previousOrders.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).ToList();

            var currentRevenue = currentCompleted.Sum(o => o.Total);
            var previousRevenue = previousCompleted.Sum(o => o.Total);

            var revenueChange = previousRevenue > 0 
                ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 
                : (currentRevenue > 0 ? 100 : 0);

            var ordersChange = previousCompleted.Count > 0 
                ? ((double)(currentCompleted.Count - previousCompleted.Count) / previousCompleted.Count) * 100 
                : (currentCompleted.Count > 0 ? 100 : 0);

            var currentAvg = currentCompleted.Count > 0 ? currentRevenue / currentCompleted.Count : 0;
            var previousAvg = previousCompleted.Count > 0 ? previousRevenue / previousCompleted.Count : 0;
            var avgChange = previousAvg > 0 
                ? ((currentAvg - previousAvg) / previousAvg) * 100 
                : (currentAvg > 0 ? 100 : 0);

            return Ok(new
            {
                period,
                current = new
                {
                    revenue = currentRevenue,
                    orders = currentCompleted.Count,
                    averageOrder = currentAvg
                },
                previous = new
                {
                    revenue = previousRevenue,
                    orders = previousCompleted.Count,
                    averageOrder = previousAvg
                },
                changes = new
                {
                    revenuePercent = Math.Round(revenueChange, 1),
                    ordersPercent = Math.Round(ordersChange, 1),
                    averagePercent = Math.Round(avgChange, 1)
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener comparativa");
            return StatusCode(500, new { error = "Error al obtener comparativa" });
        }
    }

    /// <summary>
    /// Obtiene horas pico de pedidos
    /// </summary>
    [HttpGet("peak-hours")]
    public async Task<ActionResult> GetPeakHours([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= startDate && !o.IsArchived)
                .ToListAsync();

            var ordersByHour = orders
                .GroupBy(o => o.CreatedAt.Hour)
                .Select(g => new
                {
                    Hour = g.Key,
                    OrdersCount = g.Count(),
                    Revenue = g.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).Sum(o => o.Total)
                })
                .OrderBy(x => x.Hour)
                .ToList();

            // Llenar las horas faltantes con 0
            var allHours = Enumerable.Range(0, 24).Select(h => 
            {
                var existing = ordersByHour.FirstOrDefault(x => x.Hour == h);
                return new
                {
                    Hour = h,
                    OrdersCount = existing?.OrdersCount ?? 0,
                    Revenue = existing?.Revenue ?? 0m
                };
            }).ToList();

            var peakHour = allHours.OrderByDescending(x => x.OrdersCount).FirstOrDefault();

            return Ok(new
            {
                hourlyData = allHours,
                peakHour = peakHour?.Hour ?? 12,
                peakOrders = peakHour?.OrdersCount ?? 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener horas pico");
            return StatusCode(500, new { error = "Error al obtener horas pico" });
        }
    }

    /// <summary>
    /// Obtiene top clientes por compras
    /// </summary>
    [HttpGet("top-customers")]
    public async Task<ActionResult> GetTopCustomers(
        [FromQuery] string period = "month",
        [FromQuery] int limit = 10)
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Where(o => o.CreatedAt >= startDate && 
                           o.Status == OrderConstants.STATUS_COMPLETED && 
                           !o.IsArchived)
                .ToListAsync();

            var topCustomers = orders
                .GroupBy(o => new { o.CustomerName, o.CustomerPhone })
                .Select(g => new
                {
                    CustomerName = g.Key.CustomerName,
                    CustomerPhone = g.Key.CustomerPhone,
                    OrdersCount = g.Count(),
                    TotalSpent = g.Sum(o => o.Total),
                    LastOrderDate = g.Max(o => o.CreatedAt)
                })
                .OrderByDescending(x => x.TotalSpent)
                .Take(limit)
                .ToList();

            return Ok(topCustomers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener top clientes");
            return StatusCode(500, new { error = "Error al obtener top clientes" });
        }
    }

    /// <summary>
    /// Obtiene rendimiento de repartidores
    /// </summary>
    [HttpGet("delivery-performance")]
    public async Task<ActionResult> GetDeliveryPerformance([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.DeliveryPerson)
                .Where(o => o.CreatedAt >= startDate && 
                           o.DeliveryPersonId != null &&
                           !o.IsArchived)
                .ToListAsync();

            var performance = orders
                .Where(o => o.DeliveryPerson != null)
                .GroupBy(o => new { o.DeliveryPersonId, o.DeliveryPerson!.Name })
                .Select(g => new
                {
                    DeliveryPersonId = g.Key.DeliveryPersonId,
                    Name = g.Key.Name,
                    TotalDeliveries = g.Count(),
                    CompletedDeliveries = g.Count(o => o.Status == OrderConstants.STATUS_COMPLETED),
                    CancelledDeliveries = g.Count(o => o.Status == OrderConstants.STATUS_CANCELLED),
                    TotalRevenue = g.Where(o => o.Status == OrderConstants.STATUS_COMPLETED).Sum(o => o.Total),
                    CompletionRate = g.Count() > 0 
                        ? Math.Round((double)g.Count(o => o.Status == OrderConstants.STATUS_COMPLETED) / g.Count() * 100, 1) 
                        : 0
                })
                .OrderByDescending(x => x.CompletedDeliveries)
                .ToList();

            return Ok(performance);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener rendimiento de repartidores");
            return StatusCode(500, new { error = "Error al obtener rendimiento de repartidores" });
        }
    }

    /// <summary>
    /// Obtiene reporte completo para exportación
    /// </summary>
    [HttpGet("export")]
    public async Task<ActionResult> GetExportData([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var orders = await _context.Orders
                .AsNoTracking()
                .Include(o => o.Items)
                .Include(o => o.DeliveryPerson)
                .Where(o => o.CreatedAt >= startDate && !o.IsArchived)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new
                {
                    o.Id,
                    o.CreatedAt,
                    o.CustomerName,
                    o.CustomerPhone,
                    o.CustomerAddress,
                    o.Status,
                    o.PaymentMethod,
                    o.Total,
                    DeliveryPerson = o.DeliveryPerson != null ? o.DeliveryPerson.Name : null,
                    ItemsCount = o.Items.Count,
                    Items = string.Join(", ", o.Items.Select(i => $"{i.Quantity}x {i.ProductName}"))
                })
                .ToListAsync();

            return Ok(orders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener datos de exportación");
            return StatusCode(500, new { error = "Error al obtener datos de exportación" });
        }
    }

    /// <summary>
    /// Obtiene reporte de cajas
    /// </summary>
    [HttpGet("cash-registers")]
    public async Task<ActionResult> GetCashRegisters([FromQuery] string period = "month")
    {
        try
        {
            var now = DateTime.UtcNow;
            DateTime startDate = period.ToLower() switch
            {
                "week" => now.AddDays(-7),
                "year" => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };

            var cashRegisters = await _context.CashRegisters
                .AsNoTracking()
                .Where(c => c.OpenedAt >= startDate)
                .OrderByDescending(c => c.OpenedAt)
                .ToListAsync();

            var cashRegisterReports = new List<object>();

            foreach (var cashRegister in cashRegisters)
            {
                var openedDate = cashRegister.OpenedAt.Date;
                var closedDate = cashRegister.ClosedAt?.Date ?? now.Date;

                // Obtener pedidos completados durante esta sesión de caja
                var orders = await _context.Orders
                    .AsNoTracking()
                    .Where(o => o.CreatedAt >= openedDate
                        && (cashRegister.ClosedAt == null || o.CreatedAt <= closedDate)
                        && o.Status == OrderConstants.STATUS_COMPLETED
                        && !o.IsArchived)
                    .ToListAsync();

                var totalSales = orders.Sum(o => o.Total);
                var totalCash = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_CASH.ToLower())
                    .Sum(o => o.Total);
                var totalPOS = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_POS.ToLower())
                    .Sum(o => o.Total);
                var totalTransfer = orders.Where(o => o.PaymentMethod.ToLower() == PaymentConstants.METHOD_TRANSFER.ToLower())
                    .Sum(o => o.Total);

                cashRegisterReports.Add(new
                {
                    id = cashRegister.Id,
                    openedAt = cashRegister.OpenedAt,
                    closedAt = cashRegister.ClosedAt,
                    initialAmount = cashRegister.InitialAmount,
                    finalAmount = cashRegister.FinalAmount ?? (cashRegister.InitialAmount + totalCash),
                    totalSales = totalSales,
                    totalCash = totalCash,
                    totalPOS = totalPOS,
                    totalTransfer = totalTransfer,
                    ordersCount = orders.Count,
                    isOpen = cashRegister.IsOpen,
                    createdBy = cashRegister.CreatedBy,
                    closedBy = cashRegister.ClosedBy,
                    notes = cashRegister.Notes,
                    duration = cashRegister.ClosedAt.HasValue 
                        ? (cashRegister.ClosedAt.Value - cashRegister.OpenedAt).TotalHours 
                        : (now - cashRegister.OpenedAt).TotalHours
                });
            }

            var summary = new
            {
                totalCashRegisters = cashRegisters.Count,
                openCashRegisters = cashRegisters.Count(c => c.IsOpen),
                closedCashRegisters = cashRegisters.Count(c => !c.IsOpen),
                totalSales = cashRegisterReports.Sum(r => (decimal)((dynamic)r).totalSales),
                totalCash = cashRegisterReports.Sum(r => (decimal)((dynamic)r).totalCash),
                totalPOS = cashRegisterReports.Sum(r => (decimal)((dynamic)r).totalPOS),
                totalTransfer = cashRegisterReports.Sum(r => (decimal)((dynamic)r).totalTransfer)
            };

            return Ok(new
            {
                period,
                startDate,
                endDate = now,
                summary,
                cashRegisters = cashRegisterReports
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener reporte de cajas");
            return StatusCode(500, new { error = "Error al obtener reporte de cajas", details = ex.Message });
        }
    }
}

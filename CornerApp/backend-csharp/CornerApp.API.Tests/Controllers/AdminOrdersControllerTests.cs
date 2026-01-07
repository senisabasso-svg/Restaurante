using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using CornerApp.API.Controllers;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using CornerApp.API.Constants;
using CornerApp.API.Hubs;
using CornerApp.API.DTOs;
using FluentAssertions;
using Xunit;
using System.Security.Claims;
using System.Text.Json;

namespace CornerApp.API.Tests.Controllers;

// Clase auxiliar para deserializar respuestas paginadas
internal class PaginatedOrdersResponse
{
    public List<Order> data { get; set; } = new();
    public int totalCount { get; set; }
    public int page { get; set; }
    public int pageSize { get; set; }
    public int totalPages { get; set; }
}

public class AdminOrdersControllerTests
{
    private readonly Mock<ILogger<AdminOrdersController>> _mockLogger;
    private readonly Mock<IDeliveryZoneService> _mockDeliveryZoneService;
    private readonly Mock<IAdminDashboardService> _mockAdminDashboardService;
    private readonly Mock<IOrderNotificationService> _mockOrderNotificationService;
    private readonly Mock<ICacheService> _mockCacheService;
    private readonly Mock<IMetricsService> _mockMetricsService;
    private readonly ApplicationDbContext _context;
    private readonly AdminOrdersController _controller;

    public AdminOrdersControllerTests()
    {
        _mockLogger = new Mock<ILogger<AdminOrdersController>>();
        _mockDeliveryZoneService = new Mock<IDeliveryZoneService>();
        _mockAdminDashboardService = new Mock<IAdminDashboardService>();
        _mockOrderNotificationService = new Mock<IOrderNotificationService>();
        _mockCacheService = new Mock<ICacheService>();
        _mockMetricsService = new Mock<IMetricsService>();
        
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        
        _context = new ApplicationDbContext(options);
        
        _controller = new AdminOrdersController(
            _context,
            _mockLogger.Object,
            _mockDeliveryZoneService.Object,
            _mockAdminDashboardService.Object,
            _mockOrderNotificationService.Object,
            _mockCacheService.Object,
            _mockMetricsService.Object);
        
        // Configurar HttpContext para el controller
        var httpContext = new DefaultHttpContext();
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, "1"),
            new Claim(ClaimTypes.Role, "Admin")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);
        httpContext.User = principal;
        
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
    }

    [Fact]
    public async Task GetOrders_WithNoOrders_ReturnsEmptyList()
    {
        // Act
        var result = await _controller.GetOrders();

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.Value.Should().NotBeNull();
        
        var json = JsonSerializer.Serialize(okResult.Value);
        var response = JsonSerializer.Deserialize<PaginatedOrdersResponse>(json);
        response.Should().NotBeNull();
        response!.data.Should().BeEmpty();
    }

    [Fact]
    public async Task GetOrders_WithOrders_ReturnsPaginatedOrders()
    {
        // Arrange
        var orders = new List<Order>
        {
            new Order 
            { 
                Id = 1, 
                CustomerName = "Cliente 1", 
                Total = 100, 
                Status = OrderConstants.STATUS_PENDING,
                CreatedAt = DateTime.UtcNow,
                IsArchived = false,
                Items = new List<OrderItem>()
            },
            new Order 
            { 
                Id = 2, 
                CustomerName = "Cliente 2", 
                Total = 200, 
                Status = OrderConstants.STATUS_COMPLETED,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                IsArchived = false,
                Items = new List<OrderItem>()
            }
        };
        
        _context.Orders.AddRange(orders);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetOrders(page: 1, pageSize: 10);

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        
        var json = JsonSerializer.Serialize(okResult!.Value);
        var response = JsonSerializer.Deserialize<PaginatedOrdersResponse>(json);
        response.Should().NotBeNull();
        response!.data.Should().HaveCount(2);
        response.totalCount.Should().Be(2);
    }

    [Fact]
    public async Task GetOrders_WithPagination_RespectsPageSize()
    {
        // Arrange
        var orders = Enumerable.Range(1, 25).Select(i => new Order
        {
            Id = i,
            CustomerName = $"Cliente {i}",
            Total = 100,
            Status = OrderConstants.STATUS_PENDING,
            CreatedAt = DateTime.UtcNow.AddMinutes(-i),
            IsArchived = false,
            Items = new List<OrderItem>()
        }).ToList();
        
        _context.Orders.AddRange(orders);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetOrders(page: 1, pageSize: 10);

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        var json = JsonSerializer.Serialize(okResult!.Value);
        var response = JsonSerializer.Deserialize<PaginatedOrdersResponse>(json);
        response.Should().NotBeNull();
        response!.data.Should().HaveCount(10);
        response.pageSize.Should().Be(10);
    }

    [Fact]
    public async Task GetOrders_WithInvalidPageSize_EnforcesMaxLimit()
    {
        // Arrange
        var orders = Enumerable.Range(1, 5).Select(i => new Order
        {
            Id = i,
            CustomerName = $"Cliente {i}",
            Total = 100,
            Status = OrderConstants.STATUS_PENDING,
            CreatedAt = DateTime.UtcNow,
            IsArchived = false,
            Items = new List<OrderItem>()
        }).ToList();
        
        _context.Orders.AddRange(orders);
        await _context.SaveChangesAsync();

        // Act - Intentar usar pageSize mayor al máximo (100)
        var result = await _controller.GetOrders(page: 1, pageSize: 200);

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        var json = JsonSerializer.Serialize(okResult!.Value);
        var response = JsonSerializer.Deserialize<PaginatedOrdersResponse>(json);
        response.Should().NotBeNull();
        response!.pageSize.Should().BeLessOrEqualTo(100);
    }

    [Fact]
    public async Task GetActiveOrders_WithActiveOrders_ReturnsOnlyActive()
    {
        // Arrange
        var orders = new List<Order>
        {
            new Order 
            { 
                Id = 1, 
                CustomerName = "Cliente 1", 
                Total = 100, 
                Status = OrderConstants.STATUS_PENDING,
                CreatedAt = DateTime.UtcNow,
                IsArchived = false,
                Items = new List<OrderItem>()
            },
            new Order 
            { 
                Id = 2, 
                CustomerName = "Cliente 2", 
                Total = 200, 
                Status = OrderConstants.STATUS_COMPLETED,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                IsArchived = false,
                Items = new List<OrderItem>()
            },
            new Order 
            { 
                Id = 3, 
                CustomerName = "Cliente 3", 
                Total = 300, 
                Status = OrderConstants.STATUS_PREPARING,
                CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                IsArchived = false,
                Items = new List<OrderItem>()
            }
        };
        
        _context.Orders.AddRange(orders);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetActiveOrders();

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        var pagedResponse = okResult!.Value as PagedResponse<Order>;
        pagedResponse.Should().NotBeNull();
        pagedResponse!.Data.Should().HaveCount(2); // Solo pending y preparing
        pagedResponse.Data.Should().NotContain(o => o.Status == OrderConstants.STATUS_COMPLETED);
    }

    [Fact]
    public async Task GetOrder_WithValidId_ReturnsOrder()
    {
        // Arrange
        var order = new Order
        {
            Id = 1,
            CustomerName = "Cliente Test",
            Total = 100,
            Status = OrderConstants.STATUS_PENDING,
            CreatedAt = DateTime.UtcNow,
            IsArchived = false,
            Items = new List<OrderItem>
            {
                new OrderItem { ProductName = "Producto 1", Quantity = 2, UnitPrice = 50 }
            }
        };
        
        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetOrder(1);

        // Assert
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        var returnedOrder = okResult!.Value as Order;
        returnedOrder.Should().NotBeNull();
        returnedOrder!.Id.Should().Be(1);
        returnedOrder.Items.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetOrder_WithInvalidId_ReturnsNotFound()
    {
        // Act
        var result = await _controller.GetOrder(999);

        // Assert
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task GetOrderStats_WithoutCache_CalculatesStatsFromDatabase()
    {
        // Arrange
        _mockCacheService.Setup(x => x.GetAsync<object>(It.IsAny<string>()))
            .ReturnsAsync((object?)null);

        var orders = new List<Order>
        {
            new Order 
            { 
                Id = 1, 
                CustomerName = "Cliente 1", 
                Total = 100, 
                Status = OrderConstants.STATUS_PENDING,
                CreatedAt = DateTime.UtcNow,
                IsArchived = false,
                Items = new List<OrderItem>()
            },
            new Order 
            { 
                Id = 2, 
                CustomerName = "Cliente 2", 
                Total = 200, 
                Status = OrderConstants.STATUS_COMPLETED,
                CreatedAt = DateTime.UtcNow,
                IsArchived = false,
                Items = new List<OrderItem>()
            }
        };
        
        _context.Orders.AddRange(orders);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetOrderStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();
        
        // Verificar que se intentó guardar en cache
        _mockCacheService.Verify(x => x.SetAsync(
            It.IsAny<string>(), 
            It.IsAny<object>(), 
            It.IsAny<TimeSpan?>()), 
            Times.Once);
    }

    [Fact]
    public async Task GetOrderStats_WithCache_ReturnsCachedStats()
    {
        // Arrange
        var cachedStats = new { totalOrders = 10, pendingOrders = 5 };
        _mockCacheService.Setup(x => x.GetAsync<object>(It.IsAny<string>()))
            .ReturnsAsync(cachedStats);

        // Act
        var result = await _controller.GetOrderStats();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult!.Value.Should().Be(cachedStats);
        
        // Verificar que se registró cache hit
        _mockMetricsService.Verify(x => x.RecordCacheHit(It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task UpdateOrderStatus_WithValidOrder_UpdatesStatus()
    {
        // Arrange
        var order = new Order
        {
            Id = 1,
            CustomerName = "Cliente Test",
            Total = 100,
            Status = OrderConstants.STATUS_PENDING,
            CreatedAt = DateTime.UtcNow,
            IsArchived = false,
            Items = new List<OrderItem>()
        };
        
        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        var request = new CornerApp.API.Controllers.UpdateOrderStatusRequest
        {
            Status = OrderConstants.STATUS_PREPARING
        };

        // Act
        var result = await _controller.UpdateOrderStatus(1, request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var updatedOrder = await _context.Orders.FindAsync(1);
        updatedOrder.Should().NotBeNull();
        updatedOrder!.Status.Should().Be(OrderConstants.STATUS_PREPARING);
        
        // Verificar que se invalidó el cache
        _mockCacheService.Verify(x => x.RemoveAsync(It.IsAny<string>()), Times.Once);
        
        // Verificar que se notificó el cambio
        _mockOrderNotificationService.Verify(x => x.NotifyOrderStatusChanged(
            It.IsAny<int>(), 
            It.IsAny<string>(), 
            It.IsAny<string?>()), 
            Times.Once);
    }

    [Fact]
    public async Task UpdateOrderStatus_WithInvalidOrderId_ReturnsNotFound()
    {
        // Arrange
        var request = new CornerApp.API.Controllers.UpdateOrderStatusRequest
        {
            Status = OrderConstants.STATUS_PREPARING
        };

        // Act
        var result = await _controller.UpdateOrderStatus(999, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    public async Task UpdateOrderStatus_ToDeliveringWithoutDeliveryPerson_ReturnsBadRequest()
    {
        // Arrange
        var order = new Order
        {
            Id = 1,
            CustomerName = "Cliente Test",
            Total = 100,
            Status = OrderConstants.STATUS_PREPARING,
            CreatedAt = DateTime.UtcNow,
            IsArchived = false,
            Items = new List<OrderItem>()
        };
        
        _context.Orders.Add(order);
        await _context.SaveChangesAsync();

        var request = new CornerApp.API.Controllers.UpdateOrderStatusRequest
        {
            Status = OrderConstants.STATUS_DELIVERING
            // Sin DeliveryPersonId
        };

        // Act
        var result = await _controller.UpdateOrderStatus(1, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }
}


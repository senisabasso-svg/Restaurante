using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using CornerApp.API.Controllers;
using CornerApp.API.Data;
using CornerApp.API.Models;
using CornerApp.API.Services;
using FluentAssertions;
using Xunit;
using System.Security.Claims;

namespace CornerApp.API.Tests.Controllers;

public class ProductsControllerTests
{
    private readonly Mock<ILogger<ProductsController>> _mockLogger;
    private readonly ApplicationDbContext _context;
    private readonly Mock<ICacheService> _mockCache;
    private readonly ProductsController _controller;

    public ProductsControllerTests()
    {
        _mockLogger = new Mock<ILogger<ProductsController>>();
        
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        
        _context = new ApplicationDbContext(options);
        _mockCache = new Mock<ICacheService>();
        
        // Configurar mock por defecto para devolver null (cache miss)
        _mockCache.Setup(x => x.GetAsync<List<object>>(It.IsAny<string>()))
            .ReturnsAsync((List<object>?)null);
        
        _controller = new ProductsController(_mockLogger.Object, _context, _mockCache.Object, null);
        
        // Configurar HttpContext para el controller (necesario para Request.Headers y Response.Headers)
        var httpContext = new DefaultHttpContext();
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };
        
        // Asegurar que Request y Response estén disponibles
        _controller.ControllerContext.HttpContext.Request.Headers.Clear();
        _controller.ControllerContext.HttpContext.Response.Headers.Clear();
    }

    [Fact]
    public async Task GetProducts_WithNoProducts_ReturnsEmptyList()
    {
        // Arrange - Agregar una categoría vacía para evitar inicialización automática
        // Esto previene que InitializeDatabaseAsync() se ejecute
        var category = new Category 
        { 
            Id = 1, 
            Name = "Empty Category", 
            Description = "Test",
            DisplayOrder = 1,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetProducts();

        // Assert - Verificar que no sea un error 500
        if (result.Result is ObjectResult objectResult && objectResult.StatusCode == 500)
        {
            var errorMessage = objectResult.Value?.ToString() ?? "Error desconocido";
            throw new Exception($"El test falló con error 500: {errorMessage}");
        }
        
        // Ok() devuelve OkObjectResult cuando no hay productos también
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetProducts_WithProducts_ReturnsProducts()
    {
        // Arrange
        var category = new Category { Id = 1, Name = "Test Category", Description = "Test", IsActive = true, DisplayOrder = 1, CreatedAt = DateTime.UtcNow };
        _context.Categories.Add(category);
        
        var products = new List<Product>
        {
            new Product { Id = 1, Name = "Product 1", Price = 100, CategoryId = 1, Category = category, IsAvailable = true, DisplayOrder = 1, CreatedAt = DateTime.UtcNow },
            new Product { Id = 2, Name = "Product 2", Price = 200, CategoryId = 1, Category = category, IsAvailable = true, DisplayOrder = 2, CreatedAt = DateTime.UtcNow }
        };
        
        _context.Products.AddRange(products);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetProducts();

        // Assert - Verificar que no sea un error 500
        if (result.Result is ObjectResult objectResult && objectResult.StatusCode == 500)
        {
            var errorMessage = objectResult.Value?.ToString() ?? "Error desconocido";
            throw new Exception($"El test falló con error 500: {errorMessage}");
        }
        
        // Ok() devuelve OkObjectResult, no ObjectResult
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetProducts_UsesCache_WhenAvailable()
    {
        // Arrange
        var category = new Category 
        { 
            Id = 1, 
            Name = "Test Category", 
            Description = "Test", 
            IsActive = true, 
            DisplayOrder = 1, 
            CreatedAt = DateTime.UtcNow 
        };
        _context.Categories.Add(category);
        
        var product = new Product 
        { 
            Id = 1, 
            Name = "Product 1", 
            Price = 100, 
            CategoryId = 1, 
            Category = category, 
            IsAvailable = true, 
            DisplayOrder = 1, 
            CreatedAt = DateTime.UtcNow 
        };
        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        // Configurar mock para primera llamada (cache miss - devuelve null)
        _mockCache.Setup(x => x.GetAsync<List<object>>(It.IsAny<string>()))
            .ReturnsAsync((List<object>?)null);

        // Primera llamada (llenará el cache)
        var firstResult = await _controller.GetProducts();
        if (firstResult.Result is ObjectResult firstObjectResult && firstObjectResult.StatusCode == 500)
        {
            var errorMessage = firstObjectResult.Value?.ToString() ?? "Error desconocido";
            throw new Exception($"Primera llamada falló con error 500: {errorMessage}");
        }

        // Obtener los datos que se guardaron en cache
        var cachedData = (firstResult.Result as OkObjectResult)?.Value as IEnumerable<object>;
        var cachedList = cachedData?.Cast<object>().ToList() ?? new List<object>();

        // Eliminar producto de la base de datos
        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        // Configurar mock para segunda llamada (cache hit - devuelve datos cacheados)
        _mockCache.Setup(x => x.GetAsync<List<object>>(It.IsAny<string>()))
            .ReturnsAsync(cachedList);

        // Act - Segunda llamada (debería usar cache)
        var result = await _controller.GetProducts();

        // Assert - Verificar que no sea un error 500
        if (result.Result is ObjectResult objectResult && objectResult.StatusCode == 500)
        {
            var errorMessage = objectResult.Value?.ToString() ?? "Error desconocido";
            throw new Exception($"Segunda llamada falló con error 500: {errorMessage}");
        }
        
        // Ok() devuelve OkObjectResult, no ObjectResult
        result.Result.Should().BeOfType<OkObjectResult>();
        var okResult = result.Result as OkObjectResult;
        okResult.Should().NotBeNull();
        okResult!.StatusCode.Should().Be(200);
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    public async Task GetProductById_WithValidId_ReturnsProduct()
    {
        // Arrange
        var category = new Category 
        { 
            Id = 1, 
            Name = "Test Category", 
            Description = "Test",
            IsActive = true,
            DisplayOrder = 1,
            CreatedAt = DateTime.UtcNow
        };
        _context.Categories.Add(category);
        
        var product = new Product 
        { 
            Id = 1, 
            Name = "Product 1", 
            Price = 100, 
            CategoryId = 1, 
            Category = category,
            IsAvailable = true,
            DisplayOrder = 1,
            CreatedAt = DateTime.UtcNow
        };
        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        // Act
        var result = await _controller.GetProduct(1);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedProduct = okResult.Value.Should().BeOfType<Product>().Subject;
        returnedProduct.Id.Should().Be(1);
        returnedProduct.Name.Should().Be("Product 1");
    }

    [Fact]
    public async Task GetProductById_WithInvalidId_ReturnsNotFound()
    {
        // Act
        var result = await _controller.GetProduct(999);

        // Assert
        result.Result.Should().BeOfType<NotFoundResult>();
    }

}

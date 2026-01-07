using CornerApp.API.Services;
using FluentAssertions;
using Xunit;

namespace CornerApp.API.Tests.Services;

public class MetricsServiceTests
{
    [Fact]
    public void RecordRequest_ShouldIncrementTotalRequests()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalRequests.Should().Be(1);
    }

    [Fact]
    public void RecordRequest_WithErrorStatusCode_ShouldIncrementTotalErrors()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 404, 50);

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalErrors.Should().Be(1);
        metrics.TotalRequests.Should().Be(1);
    }

    [Fact]
    public void RecordRequest_WithSuccessStatusCode_ShouldNotIncrementErrors()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalErrors.Should().Be(0);
        metrics.TotalRequests.Should().Be(1);
    }

    [Fact]
    public void RecordRequest_MultipleRequests_ShouldTrackEndpointMetrics()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);
        service.RecordRequest("/api/products", "GET", 200, 150);
        service.RecordRequest("/api/categories", "GET", 200, 80);

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalRequests.Should().Be(3);
        metrics.TopEndpoints.Should().HaveCount(2);
        metrics.TopEndpoints.Should().Contain(e => e.Endpoint == "/api/products" && e.RequestCount == 2);
        metrics.TopEndpoints.Should().Contain(e => e.Endpoint == "/api/categories" && e.RequestCount == 1);
    }

    [Fact]
    public void RecordRequest_ShouldCalculateAverageDuration()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);
        service.RecordRequest("/api/products", "GET", 200, 200);
        service.RecordRequest("/api/products", "GET", 200, 300);

        // Assert
        var metrics = service.GetMetrics();
        var endpoint = metrics.TopEndpoints.First(e => e.Endpoint == "/api/products");
        endpoint.AverageDurationMs.Should().Be(200);
    }

    [Fact]
    public void RecordRequest_ShouldTrackMinAndMaxDuration()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 50);
        service.RecordRequest("/api/products", "GET", 200, 300);
        service.RecordRequest("/api/products", "GET", 200, 150);

        // Assert
        var metrics = service.GetMetrics();
        var endpoint = metrics.TopEndpoints.First(e => e.Endpoint == "/api/products");
        endpoint.MinDurationMs.Should().Be(50);
        endpoint.MaxDurationMs.Should().Be(300);
    }

    [Fact]
    public void RecordError_ShouldIncrementTotalErrors()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordError("/api/products", "GET", "NotFoundException");

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalErrors.Should().Be(1);
    }

    [Fact]
    public void RecordError_MultipleErrors_ShouldTrackErrorTypes()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordError("/api/products", "GET", "NotFoundException");
        service.RecordError("/api/products", "GET", "NotFoundException");
        service.RecordError("/api/products", "GET", "ValidationException");

        // Assert
        var metrics = service.GetMetrics();
        var endpoint = metrics.TopEndpoints.First(e => e.Endpoint == "/api/products");
        endpoint.ErrorCount.Should().Be(3);
        endpoint.ErrorTypes.Should().ContainKey("NotFoundException").WhoseValue.Should().Be(2);
        endpoint.ErrorTypes.Should().ContainKey("ValidationException").WhoseValue.Should().Be(1);
    }

    [Fact]
    public void RecordCacheHit_ShouldIncrementCacheHits()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordCacheHit("products_list");
        service.RecordCacheHit("products_list");

        // Assert
        var metrics = service.GetMetrics();
        metrics.CacheHits.Should().Be(2);
        metrics.CacheMisses.Should().Be(0);
    }

    [Fact]
    public void RecordCacheMiss_ShouldIncrementCacheMisses()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordCacheMiss("products_list");
        service.RecordCacheMiss("categories_list");

        // Assert
        var metrics = service.GetMetrics();
        metrics.CacheHits.Should().Be(0);
        metrics.CacheMisses.Should().Be(2);
    }

    [Fact]
    public void GetMetrics_WithCacheHitsAndMisses_ShouldCalculateHitRate()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordCacheHit("products_list");
        service.RecordCacheHit("products_list");
        service.RecordCacheMiss("products_list");
        service.RecordCacheMiss("categories_list");

        // Assert
        var metrics = service.GetMetrics();
        metrics.CacheHits.Should().Be(2);
        metrics.CacheMisses.Should().Be(2);
        metrics.CacheHitRate.Should().Be(50.0);
    }

    [Fact]
    public void ResetMetrics_ShouldClearAllMetrics()
    {
        // Arrange
        var service = new MetricsService();
        service.RecordRequest("/api/products", "GET", 200, 100);
        service.RecordError("/api/products", "GET", "Error");
        service.RecordCacheHit("products_list");

        // Act
        service.ResetMetrics();

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalRequests.Should().Be(0);
        metrics.TotalErrors.Should().Be(0);
        metrics.CacheHits.Should().Be(0);
        metrics.CacheMisses.Should().Be(0);
        metrics.TopEndpoints.Should().BeEmpty();
    }

    [Fact]
    public void GetMetrics_ShouldCalculateRequestsPerSecond()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);
        
        // Esperar un poco para que el tiempo transcurra
        System.Threading.Thread.Sleep(1100); // Más de 1 segundo

        // Assert
        var metrics = service.GetMetrics();
        metrics.RequestsPerSecond.Should().BeGreaterThanOrEqualTo(0);
        metrics.UptimeSeconds.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public void GetMetrics_ShouldCalculateErrorRate()
    {
        // Arrange
        var service = new MetricsService();

        // Act
        service.RecordRequest("/api/products", "GET", 200, 100);
        service.RecordRequest("/api/products", "GET", 404, 50);
        service.RecordRequest("/api/products", "GET", 500, 30);

        // Assert
        var metrics = service.GetMetrics();
        metrics.TotalRequests.Should().Be(3);
        metrics.TotalErrors.Should().Be(2);
        metrics.ErrorRate.Should().BeApproximately(66.67, 0.1);
    }
}

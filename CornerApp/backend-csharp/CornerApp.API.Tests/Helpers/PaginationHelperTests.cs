using CornerApp.API.Helpers;
using CornerApp.API.DTOs;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using Xunit;

namespace CornerApp.API.Tests.Helpers;

public class PaginationHelperTests
{
    [Fact]
    public void NormalizePagination_WithValidValues_ReturnsSameValues()
    {
        // Arrange
        int? page = 2;
        int? pageSize = 10;

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        // Assert
        normalizedPage.Should().Be(2);
        normalizedPageSize.Should().Be(10);
    }

    [Fact]
    public void NormalizePagination_WithNullValues_ReturnsDefaults()
    {
        // Arrange
        int? page = null;
        int? pageSize = null;

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        // Assert
        normalizedPage.Should().Be(1);
        normalizedPageSize.Should().Be(20); // defaultPageSize
    }

    [Fact]
    public void NormalizePagination_WithZeroPage_ReturnsOne()
    {
        // Arrange
        int? page = 0;
        int? pageSize = 10;

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        // Assert
        normalizedPage.Should().Be(1);
        normalizedPageSize.Should().Be(10);
    }

    [Fact]
    public void NormalizePagination_WithNegativePage_ReturnsOne()
    {
        // Arrange
        int? page = -5;
        int? pageSize = 10;

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        // Assert
        normalizedPage.Should().Be(1);
        normalizedPageSize.Should().Be(10);
    }

    [Fact]
    public void NormalizePagination_WithPageSizeExceedingMax_ReturnsMaxPageSize()
    {
        // Arrange
        int? page = 1;
        int? pageSize = 200; // Excede maxPageSize (100)

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize, maxPageSize: 100);

        // Assert
        normalizedPage.Should().Be(1);
        normalizedPageSize.Should().Be(100);
    }

    [Fact]
    public void NormalizePagination_WithZeroPageSize_ReturnsDefault()
    {
        // Arrange
        int? page = 1;
        int? pageSize = 0;

        // Act
        var (normalizedPage, normalizedPageSize) = PaginationHelper.NormalizePagination(page, pageSize);

        // Assert
        normalizedPage.Should().Be(1);
        normalizedPageSize.Should().Be(20); // defaultPageSize
    }

    [Fact]
    public async Task ToPagedResponseAsync_WithEmptyQuery_ReturnsEmptyPagedResponse()
    {
        // Arrange
        var data = new List<int>().AsQueryable();
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new TestDbContext(options);
        var query = context.Numbers.AsQueryable();

        // Act
        var result = await PaginationHelper.ToPagedResponseAsync(query, 1, 10);

        // Assert
        result.Should().NotBeNull();
        result.Data.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task ToPagedResponseAsync_WithData_ReturnsCorrectPagedResponse()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new TestDbContext(options);
        context.Numbers.AddRange(new TestEntity { Id = 1 }, new TestEntity { Id = 2 }, new TestEntity { Id = 3 });
        await context.SaveChangesAsync();

        var query = context.Numbers.AsQueryable();

        // Act
        var result = await PaginationHelper.ToPagedResponseAsync(query, 1, 2);

        // Assert
        result.Should().NotBeNull();
        result.Data.Should().HaveCount(2);
        result.TotalCount.Should().Be(3);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(2);
    }

    [Fact]
    public async Task ToPagedResponseAsync_WithSecondPage_ReturnsCorrectData()
    {
        // Arrange
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var context = new TestDbContext(options);
        context.Numbers.AddRange(
            new TestEntity { Id = 1 },
            new TestEntity { Id = 2 },
            new TestEntity { Id = 3 },
            new TestEntity { Id = 4 }
        );
        await context.SaveChangesAsync();

        var query = context.Numbers.OrderBy(x => x.Id).AsQueryable();

        // Act
        var result = await PaginationHelper.ToPagedResponseAsync(query, 2, 2);

        // Assert
        result.Should().NotBeNull();
        result.Data.Should().HaveCount(2);
        result.TotalCount.Should().Be(4);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(2);
        result.Data.Cast<TestEntity>().Should().OnlyContain(x => x.Id >= 3);
    }
}

// Clases auxiliares para testing
public class TestDbContext : DbContext
{
    public TestDbContext(DbContextOptions<TestDbContext> options) : base(options) { }
    public DbSet<TestEntity> Numbers { get; set; } = null!;
}

public class TestEntity
{
    public int Id { get; set; }
}

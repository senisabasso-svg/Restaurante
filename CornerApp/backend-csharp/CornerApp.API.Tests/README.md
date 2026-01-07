# CornerApp.API.Tests

Proyecto de tests automatizados para CornerApp.API usando xUnit, Moq y FluentAssertions.

## Estructura

```
CornerApp.API.Tests/
├── Helpers/
│   ├── PaginationHelperTests.cs
│   └── ETagHelperTests.cs
├── Services/
│   └── MetricsServiceTests.cs
└── Controllers/
    └── ProductsControllerTests.cs
```

## Ejecutar Tests

```bash
# Ejecutar todos los tests
dotnet test

# Ejecutar tests con más detalles
dotnet test --verbosity normal

# Ejecutar tests de una clase específica
dotnet test --filter "FullyQualifiedName~PaginationHelperTests"

# Ejecutar tests con cobertura de código
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover
```

## Tipos de Tests

### Unit Tests (Tests Unitarios)
- **Helpers**: Prueban funciones individuales sin dependencias externas
- **Services**: Prueban lógica de negocio aislada

### Integration Tests (Tests de Integración)
- **Controllers**: Prueban endpoints completos con base de datos en memoria

## Dependencias

- **xUnit**: Framework de testing
- **Moq**: Para crear mocks y stubs
- **FluentAssertions**: Para aserciones más legibles
- **Microsoft.EntityFrameworkCore.InMemory**: Para base de datos en memoria en tests

## Ejemplos

### Test Unitario Simple

```csharp
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
```

### Test de Integración

```csharp
[Fact]
public async Task GetProducts_WithProducts_ReturnsProducts()
{
    // Arrange
    var category = new Category { Id = 1, Name = "Test Category" };
    _context.Categories.Add(category);
    
    var product = new Product { Id = 1, Name = "Product 1", CategoryId = 1 };
    _context.Products.Add(product);
    await _context.SaveChangesAsync();

    // Act
    var result = await _controller.GetProducts();

    // Assert
    var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
    var products = okResult.Value.Should().BeAssignableTo<IEnumerable<Product>>().Subject;
    products.Should().HaveCount(1);
}
```

## Convenciones

1. **Nomenclatura**: `{MethodName}_{Scenario}_Returns{ExpectedResult}`
2. **Estructura**: Arrange-Act-Assert (AAA)
3. **Aislamiento**: Cada test es independiente
4. **Base de datos**: Usar `UseInMemoryDatabase` con nombres únicos

## Cobertura de Código

Para generar reporte de cobertura:

```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover
```

Esto generará un archivo `coverage.opencover.xml` que puede visualizarse con herramientas como ReportGenerator.

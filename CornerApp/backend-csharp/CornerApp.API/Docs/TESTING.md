# Testing - Tests Automatizados

## Descripción

Este documento describe el sistema de tests automatizados implementado en CornerApp API para garantizar la calidad y confiabilidad del código.

## ¿Qué son los Tests Automatizados?

Los tests automatizados son código que verifica automáticamente que tu aplicación funciona correctamente. En lugar de probar manualmente cada vez que cambias algo, los tests se ejecutan automáticamente.

## Tipos de Tests

### 1. Unit Tests (Tests Unitarios)

Prueban funciones/métodos individuales de forma aislada, sin dependencias externas.

**Ejemplo**: Verificar que `PaginationHelper.NormalizePagination()` funciona correctamente.

**Ubicación**: `CornerApp.API.Tests/Helpers/`, `CornerApp.API.Tests/Services/`

### 2. Integration Tests (Tests de Integración)

Prueban que varios componentes funcionan juntos correctamente.

**Ejemplo**: Verificar que `ProductsController.GetProducts()` devuelve productos correctamente desde la base de datos.

**Ubicación**: `CornerApp.API.Tests/Controllers/`

## Estructura del Proyecto de Tests

```
CornerApp.API.Tests/
├── Helpers/
│   ├── PaginationHelperTests.cs      # Tests para PaginationHelper
│   └── ETagHelperTests.cs            # Tests para ETagHelper
├── Services/
│   └── MetricsServiceTests.cs        # Tests para MetricsService
└── Controllers/
    └── ProductsControllerTests.cs   # Tests para ProductsController
```

## Ejecutar Tests

### Ejecutar Todos los Tests

```bash
cd backend-csharp
dotnet test
```

### Ejecutar Tests con Detalles

```bash
dotnet test --verbosity normal
```

### Ejecutar Tests Específicos

```bash
# Por clase
dotnet test --filter "FullyQualifiedName~PaginationHelperTests"

# Por método
dotnet test --filter "FullyQualifiedName~NormalizePagination_WithValidValues_ReturnsSameValues"
```

### Ejecutar Tests con Cobertura

```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover
```

## Herramientas Utilizadas

### xUnit
Framework de testing para .NET.

```csharp
[Fact]
public void MyTest()
{
    // Test code
}
```

### FluentAssertions
Aserciones más legibles y expresivas.

```csharp
result.Should().Be(5);
result.Should().NotBeNull();
result.Should().HaveCount(3);
```

### Moq
Para crear objetos simulados (mocks).

```csharp
var mockLogger = new Mock<ILogger<ProductsController>>();
var controller = new ProductsController(mockLogger.Object, context, cache);
```

### Entity Framework In-Memory
Base de datos en memoria para tests.

```csharp
var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
    .Options;
```

## Ejemplos de Tests

### Test Unitario - PaginationHelper

```csharp
[Fact]
public void NormalizePagination_WithValidValues_ReturnsSameValues()
{
    // Arrange
    int? page = 2;
    int? pageSize = 10;

    // Act
    var (normalizedPage, normalizedPageSize) = 
        PaginationHelper.NormalizePagination(page, pageSize);

    // Assert
    normalizedPage.Should().Be(2);
    normalizedPageSize.Should().Be(10);
}
```

### Test de Integración - ProductsController

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

## Convenciones de Nomenclatura

### Nombres de Tests

Formato: `{MethodName}_{Scenario}_Returns{ExpectedResult}`

**Ejemplos**:
- `NormalizePagination_WithValidValues_ReturnsSameValues`
- `GetProducts_WithNoProducts_ReturnsEmptyList`
- `RecordRequest_ShouldIncrementTotalRequests`

### Estructura AAA (Arrange-Act-Assert)

1. **Arrange**: Preparar datos y configuración
2. **Act**: Ejecutar el código a probar
3. **Assert**: Verificar el resultado

## Mejores Prácticas

### 1. Tests Independientes

Cada test debe ser independiente y poder ejecutarse en cualquier orden.

```csharp
// ❌ Malo - Depende de otros tests
[Fact]
public void Test2()
{
    // Asume que Test1 ya se ejecutó
}

// ✅ Bueno - Independiente
[Fact]
public void Test2()
{
    // Configura todo lo necesario
}
```

### 2. Un Test, Una Aserción

Cada test debe verificar una sola cosa.

```csharp
// ❌ Malo - Múltiples verificaciones
[Fact]
public void Test()
{
    result.Should().Be(5);
    result.Should().NotBeNull();
    result.Should().HaveCount(3);
}

// ✅ Bueno - Una verificación principal
[Fact]
public void Test()
{
    result.Should().Be(5);
}
```

### 3. Nombres Descriptivos

Los nombres deben describir claramente qué se está probando.

```csharp
// ❌ Malo
[Fact]
public void Test1() { }

// ✅ Bueno
[Fact]
public void GetProducts_WithInvalidId_ReturnsNotFound() { }
```

### 4. Usar Base de Datos en Memoria

Para tests de integración, usar `UseInMemoryDatabase` con nombres únicos.

```csharp
var options = new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
    .Options;
```

## Cobertura de Código

La cobertura de código mide qué porcentaje del código está cubierto por tests.

### Generar Reporte

```bash
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=opencover
```

### Visualizar Reporte

Usar herramientas como:
- **ReportGenerator**: Genera reportes HTML
- **Visual Studio**: Muestra cobertura integrada
- **Azure DevOps**: Integración con pipelines

## CI/CD Integration

Los tests pueden ejecutarse automáticamente en pipelines de CI/CD:

```yaml
# GitHub Actions ejemplo
- name: Run tests
  run: dotnet test

# Azure DevOps ejemplo
- task: DotNetCoreCLI@2
  inputs:
    command: 'test'
```

## Troubleshooting

### Tests Fracasan Inesperadamente

1. Verificar que la base de datos en memoria esté limpia
2. Verificar que los mocks estén configurados correctamente
3. Revisar logs para ver errores específicos

### Tests Lentos

1. Usar `UseInMemoryDatabase` en lugar de SQL Server real
2. Evitar operaciones I/O innecesarias
3. Limitar el número de datos de prueba

### Tests Intermitentes

1. Verificar que no haya dependencias entre tests
2. Usar nombres únicos para bases de datos en memoria
3. Limpiar estado entre tests si es necesario

## Próximos Pasos

1. **Aumentar Cobertura**: Agregar tests para más controllers y servicios
2. **Tests de API**: Usar `WebApplicationFactory` para tests de endpoints completos
3. **Tests de Performance**: Agregar tests de carga y rendimiento
4. **Tests de Seguridad**: Verificar autenticación y autorización

## Referencias

- [xUnit Documentation](https://xunit.net/)
- [FluentAssertions Documentation](https://fluentassertions.com/)
- [Moq Documentation](https://github.com/moq/moq4)
- [Entity Framework Testing](https://docs.microsoft.com/en-us/ef/core/testing/)

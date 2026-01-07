# Circuit Breaker Pattern

## Descripción

Este documento describe el sistema de Circuit Breaker implementado en CornerApp API para mejorar la resiliencia ante fallos de servicios externos o operaciones que pueden fallar.

## ¿Qué es Circuit Breaker?

El Circuit Breaker es un patrón de diseño que previene que una aplicación intente ejecutar una operación que probablemente fallará. Actúa como un "interruptor" que se abre cuando detecta demasiados fallos, evitando sobrecargar el sistema.

## Estados del Circuit Breaker

### 1. Closed (Cerrado)
- **Estado normal**: Las requests pasan normalmente
- **Transición a Open**: Cuando se alcanza el umbral de fallos (`FailureThreshold`)

### 2. Open (Abierto)
- **Bloquea requests**: Rechaza inmediatamente sin intentar la operación
- **Transición a HalfOpen**: Después de un timeout (`TimeoutSeconds`)

### 3. HalfOpen (Semi-Abierto)
- **Estado de prueba**: Permite algunas requests para verificar si el servicio se recuperó
- **Transición a Closed**: Si se alcanzan suficientes éxitos (`SuccessThreshold`)
- **Transición a Open**: Si falla durante la prueba

## Componentes

### 1. ICircuitBreaker / CircuitBreaker

Interfaz e implementación del circuit breaker:

```csharp
public interface ICircuitBreaker
{
    CircuitBreakerState State { get; }
    Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default);
    Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default);
    void Reset();
    CircuitBreakerStats GetStats();
}
```

### 2. CircuitBreakerFactory

Factory para crear y gestionar múltiples circuit breakers:

```csharp
var factory = serviceProvider.GetRequiredService<CircuitBreakerFactory>();
var breaker = factory.GetOrCreate("ExternalApi");
```

### 3. CircuitBreakerController

Controller para monitorear y gestionar circuit breakers:
- `GET /api/circuitbreaker/status` - Estado de todos los breakers
- `GET /api/circuitbreaker/status/{name}` - Estado de un breaker específico
- `POST /api/circuitbreaker/reset/{name}` - Reiniciar un breaker

## Configuración

### appsettings.json

```json
{
  "CircuitBreaker": {
    "FailureThreshold": 5,
    "TimeoutSeconds": 60,
    "SuccessThreshold": 2,
    "ExternalApi": {
      "FailureThreshold": 3,
      "TimeoutSeconds": 30,
      "SuccessThreshold": 1
    }
  }
}
```

**Parámetros**:
- `FailureThreshold`: Número de fallos consecutivos antes de abrir (default: 5)
- `TimeoutSeconds`: Tiempo en segundos antes de intentar HalfOpen (default: 60)
- `SuccessThreshold`: Éxitos necesarios en HalfOpen para cerrar (default: 2)

### Configuración por Instancia

Puedes configurar circuit breakers específicos usando el nombre:

```json
{
  "CircuitBreaker": {
    "ExternalApi": {
      "FailureThreshold": 3,
      "TimeoutSeconds": 30,
      "SuccessThreshold": 1
    },
    "Database": {
      "FailureThreshold": 10,
      "TimeoutSeconds": 120,
      "SuccessThreshold": 3
    }
  }
}
```

## Uso

### Ejemplo Básico

```csharp
public class ExternalApiService
{
    private readonly ICircuitBreaker _circuitBreaker;
    private readonly HttpClient _httpClient;

    public ExternalApiService(CircuitBreakerFactory factory, HttpClient httpClient)
    {
        _circuitBreaker = factory.GetOrCreate("ExternalApi");
        _httpClient = httpClient;
    }

    public async Task<string> CallExternalApiAsync(string endpoint)
    {
        return await _circuitBreaker.ExecuteAsync(async () =>
        {
            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        });
    }
}
```

### Manejo de Excepciones

```csharp
try
{
    var result = await _circuitBreaker.ExecuteAsync(async () =>
    {
        // Operación que puede fallar
        return await RiskyOperationAsync();
    });
}
catch (CircuitBreakerOpenException ex)
{
    // Circuit breaker está abierto, servicio no disponible
    _logger.LogWarning("Servicio no disponible: {Message}", ex.Message);
    // Retornar respuesta de fallback o error
    return GetFallbackResponse();
}
catch (Exception ex)
{
    // Otro tipo de error
    _logger.LogError(ex, "Error en operación");
    throw;
}
```

### Operación sin Valor de Retorno

```csharp
await _circuitBreaker.ExecuteAsync(async () =>
{
    await SendNotificationAsync();
});
```

## Monitoreo

### Obtener Estado

```csharp
var stats = _circuitBreaker.GetStats();
Console.WriteLine($"Estado: {stats.State}");
Console.WriteLine($"Éxitos: {stats.SuccessCount}");
Console.WriteLine($"Fallos: {stats.FailureCount}");
```

### API Endpoints

**Obtener estado de todos los breakers**:
```bash
GET /api/circuitbreaker/status
```

**Obtener estado de un breaker específico**:
```bash
GET /api/circuitbreaker/status/ExternalApi
```

**Reiniciar un breaker**:
```bash
POST /api/circuitbreaker/reset/ExternalApi
```

## Casos de Uso

### 1. Llamadas a APIs Externas

```csharp
public class PaymentService
{
    private readonly ICircuitBreaker _breaker;
    
    public async Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request)
    {
        return await _breaker.ExecuteAsync(async () =>
        {
            // Llamada a servicio de pago externo
            return await _paymentGateway.ProcessAsync(request);
        });
    }
}
```

### 2. Operaciones de Base de Datos

```csharp
public class DataService
{
    private readonly ICircuitBreaker _breaker;
    
    public async Task<List<Data>> GetDataAsync()
    {
        return await _breaker.ExecuteAsync(async () =>
        {
            // Operación de BD que puede fallar
            return await _context.Data.ToListAsync();
        });
    }
}
```

### 3. Operaciones de Cache

```csharp
public class CacheService
{
    private readonly ICircuitBreaker _breaker;
    
    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            return await _breaker.ExecuteAsync(async () =>
            {
                return await _cache.GetAsync<T>(key);
            });
        }
        catch (CircuitBreakerOpenException)
        {
            // Si el cache falla, obtener de BD directamente
            return await GetFromDatabaseAsync<T>(key);
        }
    }
}
```

## Mejores Prácticas

1. **Configurar Thresholds Apropiados**:
   - `FailureThreshold`: Basado en la tolerancia a fallos
   - `TimeoutSeconds`: Basado en el tiempo de recuperación esperado
   - `SuccessThreshold`: Basado en la confianza necesaria

2. **Usar Nombres Descriptivos**:
   - `ExternalApi`, `Database`, `Cache`, etc.

3. **Implementar Fallbacks**:
   - Siempre tener una respuesta de fallback cuando el breaker está abierto

4. **Monitorear Estados**:
   - Usar los endpoints de monitoreo para observar el comportamiento

5. **Logging**:
   - El circuit breaker registra automáticamente cambios de estado

## Troubleshooting

### Circuit Breaker se abre frecuentemente

- Aumentar `FailureThreshold`
- Verificar si el servicio externo tiene problemas reales
- Revisar logs para identificar la causa de los fallos

### Circuit Breaker no se cierra

- Verificar que el servicio se haya recuperado
- Reducir `SuccessThreshold` en HalfOpen
- Reducir `TimeoutSeconds` para probar más rápido

### Necesito reiniciar manualmente

- Usar el endpoint `POST /api/circuitbreaker/reset/{name}`
- O llamar `breaker.Reset()` en código

## Referencias

- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Resilience Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Polly Library](https://github.com/App-vNext/Polly) (alternativa más completa)

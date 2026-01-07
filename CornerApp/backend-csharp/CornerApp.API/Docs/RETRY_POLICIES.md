# Retry Policies

## Descripción

Este documento describe el sistema de Retry Policies implementado en CornerApp API para manejar fallos temporales en operaciones críticas.

## ¿Qué son Retry Policies?

Las Retry Policies (Políticas de Reintento) permiten reintentar automáticamente operaciones que fallan temporalmente, mejorando la resiliencia de la aplicación ante fallos transitorios de red, base de datos, o servicios externos.

## Componentes

### 1. IRetryPolicy / RetryPolicy

Interfaz e implementación de políticas de retry:

```csharp
public interface IRetryPolicy
{
    Task<T> ExecuteAsync<T>(Func<Task<T>> operation, CancellationToken cancellationToken = default);
    Task ExecuteAsync(Func<Task> operation, CancellationToken cancellationToken = default);
    Task<T> ExecuteAsync<T>(
        Func<Task<T>> operation,
        Func<Exception, int, Task<bool>>? shouldRetry,
        CancellationToken cancellationToken = default);
}
```

### 2. RetryPolicyFactory

Factory para crear y gestionar múltiples políticas de retry:

```csharp
var factory = serviceProvider.GetRequiredService<RetryPolicyFactory>();
var policy = factory.GetOrCreate("HttpClient");
```

### 3. Estrategias de Retry

- **Fixed**: Delay fijo entre intentos
- **Linear**: Delay lineal creciente
- **Exponential**: Delay exponencial (backoff)
- **Jitter**: Delay con jitter aleatorio

## Configuración

### appsettings.json

```json
{
  "RetryPolicy": {
    "MaxRetryAttempts": 3,
    "InitialDelaySeconds": 1,
    "MaxDelaySeconds": 30,
    "BackoffMultiplier": 2.0,
    "Strategy": "Exponential",
    "HttpClient": {
      "MaxRetryAttempts": 5,
      "InitialDelaySeconds": 2,
      "MaxDelaySeconds": 60,
      "BackoffMultiplier": 2.0,
      "Strategy": "Exponential"
    },
    "Database": {
      "MaxRetryAttempts": 3,
      "InitialDelaySeconds": 1,
      "MaxDelaySeconds": 10,
      "BackoffMultiplier": 1.5,
      "Strategy": "Linear"
    }
  }
}
```

**Parámetros**:
- `MaxRetryAttempts`: Número máximo de reintentos (default: 3)
- `InitialDelaySeconds`: Delay inicial en segundos (default: 1)
- `MaxDelaySeconds`: Delay máximo en segundos (default: 30)
- `BackoffMultiplier`: Multiplicador para backoff exponencial (default: 2.0)
- `Strategy`: Estrategia de retry (Fixed, Linear, Exponential, Jitter)

## Uso

### Ejemplo Básico

```csharp
public class ExternalApiService
{
    private readonly IRetryPolicy _retryPolicy;
    private readonly HttpClient _httpClient;

    public ExternalApiService(RetryPolicyFactory factory, HttpClient httpClient)
    {
        _retryPolicy = factory.GetOrCreate("HttpClient");
        _httpClient = httpClient;
    }

    public async Task<string> CallApiAsync(string endpoint)
    {
        return await _retryPolicy.ExecuteAsync(async () =>
        {
            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        });
    }
}
```

### Retry con Callback Personalizado

```csharp
public async Task<string> CallApiWithCustomRetryAsync(string endpoint)
{
    return await _retryPolicy.ExecuteAsync(
        async () =>
        {
            var response = await _httpClient.GetAsync(endpoint);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        },
        async (exception, attempt) =>
        {
            // Lógica personalizada para decidir si hacer retry
            if (exception is HttpRequestException httpEx)
            {
                // Solo retry para errores 5xx o timeouts
                return httpEx.Message.Contains("timeout") || 
                       httpEx.Message.Contains("500") ||
                       httpEx.Message.Contains("503");
            }
            
            // No retry para otros errores
            return false;
        }
    );
}
```

### Operación sin Valor de Retorno

```csharp
public async Task SendNotificationAsync(string message)
{
    await _retryPolicy.ExecuteAsync(async () =>
    {
        await _notificationService.SendAsync(message);
    });
}
```

## Estrategias de Retry

### 1. Fixed (Fijo)

Delay constante entre intentos:

```
Intento 1: 0ms
Intento 2: 1000ms
Intento 3: 1000ms
Intento 4: 1000ms
```

### 2. Linear (Lineal)

Delay creciente linealmente:

```
Intento 1: 0ms
Intento 2: 1000ms
Intento 3: 2000ms
Intento 4: 3000ms
```

### 3. Exponential (Exponencial)

Delay creciente exponencialmente (backoff):

```
Intento 1: 0ms
Intento 2: 1000ms
Intento 3: 2000ms
Intento 4: 4000ms
Intento 5: 8000ms
```

### 4. Jitter (Con Variación Aleatoria)

Delay exponencial con variación aleatoria para evitar "thundering herd":

```
Intento 1: 0ms
Intento 2: 1000ms + random(0-200ms)
Intento 3: 2000ms + random(0-400ms)
Intento 4: 4000ms + random(0-800ms)
```

## Casos de Uso

### 1. Llamadas a APIs Externas

```csharp
public class PaymentService
{
    private readonly IRetryPolicy _retryPolicy;
    
    public async Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request)
    {
        return await _retryPolicy.ExecuteAsync(async () =>
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
    private readonly IRetryPolicy _retryPolicy;
    
    public async Task SaveDataAsync(Data data)
    {
        await _retryPolicy.ExecuteAsync(async () =>
        {
            // Operación de BD que puede fallar temporalmente
            await _context.Data.AddAsync(data);
            await _context.SaveChangesAsync();
        });
    }
}
```

### 3. Operaciones de Cache

```csharp
public class CacheService
{
    private readonly IRetryPolicy _retryPolicy;
    
    public async Task<T?> GetAsync<T>(string key)
    {
        return await _retryPolicy.ExecuteAsync(async () =>
        {
            return await _cache.GetAsync<T>(key);
        });
    }
}
```

## Excepciones Retryables

Por defecto, el sistema retry automáticamente para:

- `HttpRequestException` - Errores de red HTTP
- `SocketException` - Errores de conexión de red
- `TimeoutException` - Timeouts
- `SqlException` - Errores de SQL Server
- `DbException` - Errores de base de datos

## Mejores Prácticas

1. **Configurar según el Tipo de Operación**:
   - APIs externas: Más reintentos (5-7)
   - Base de datos: Menos reintentos (3-5)
   - Cache: Pocos reintentos (1-3)

2. **Usar Backoff Exponencial**: Para evitar sobrecargar servicios que están fallando

3. **Limitar Delay Máximo**: Evitar delays muy largos que afecten la experiencia del usuario

4. **Usar Jitter**: Para evitar "thundering herd" cuando múltiples clientes se recuperan simultáneamente

5. **Logging**: El sistema registra automáticamente los reintentos para monitoreo

6. **Callbacks Personalizados**: Usar para lógica específica de qué errores son retryables

## Troubleshooting

### Demasiados Reintentos

- Reducir `MaxRetryAttempts`
- Verificar si el servicio realmente se está recuperando
- Revisar logs para identificar la causa de los fallos

### Reintentos Muy Lentos

- Reducir `InitialDelaySeconds`
- Reducir `BackoffMultiplier`
- Cambiar a estrategia `Linear` o `Fixed`

### No Se Hacen Reintentos

- Verificar que la excepción sea retryable
- Usar callback personalizado `shouldRetry` si es necesario
- Verificar configuración en `appsettings.json`

## Comparación con EF Core Retry

Este sistema complementa el retry básico de EF Core:

- **EF Core Retry**: Solo para operaciones de base de datos, configuración limitada
- **RetryPolicy**: Para cualquier operación, configuración flexible, múltiples estrategias

## Referencias

- [Retry Pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)
- [Polly Library](https://github.com/App-vNext/Polly) (alternativa más completa)
- [Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)

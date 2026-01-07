# Redis Cache - Distributed Cache

## Descripción

Este documento describe la implementación de Redis como Distributed Cache en CornerApp API para mejorar el rendimiento y escalabilidad.

## ¿Por qué Redis?

- **Distributed Cache**: Compartido entre múltiples instancias de la API
- **Persistencia**: Los datos persisten aunque se reinicie el servidor
- **Alto Rendimiento**: Muy rápido para operaciones de lectura/escritura
- **Escalabilidad**: Fácil de escalar horizontalmente
- **Funciones Avanzadas**: Pub/Sub, Sets, Sorted Sets, etc.

## Arquitectura

### CacheService Unificado

El `CacheService` implementa una capa de abstracción que:
- Usa **Redis (Distributed Cache)** si está configurado
- Usa **Memory Cache** como fallback si Redis no está disponible
- Proporciona la misma interfaz (`ICacheService`) en ambos casos

### Flujo de Datos

```
Controller → ICacheService → CacheService → Redis (si disponible) o Memory Cache
```

## Configuración

### appsettings.json

```json
{
  "Redis": {
    "Enabled": false,
    "ConnectionString": "",
    "InstanceName": "CornerApp:"
  },
  "ConnectionStrings": {
    "Redis": "localhost:6379"
  }
}
```

### Variables de Entorno

```bash
# Opción 1: Connection String
ConnectionStrings__Redis=localhost:6379

# Opción 2: Configuración separada
Redis__ConnectionString=localhost:6379
Redis__InstanceName=CornerApp:
Redis__Enabled=true
```

### Docker Compose

Redis ya está configurado en `docker-compose.yml`:

```yaml
redis:
  image: redis:7-alpine
  container_name: cornerapp-redis
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
  command: redis-server --appendonly yes
```

## Uso en Controllers

### Ejemplo: ProductsController

```csharp
public class ProductsController : ControllerBase
{
    private readonly ICacheService _cache;
    
    public ProductsController(ICacheService cache)
    {
        _cache = cache;
    }
    
    [HttpGet]
    public async Task<ActionResult> GetProducts()
    {
        // Obtener del cache
        var cached = await _cache.GetAsync<List<Product>>("products_list");
        if (cached != null)
        {
            return Ok(cached);
        }
        
        // Obtener de BD
        var products = await _context.Products.ToListAsync();
        
        // Guardar en cache
        await _cache.SetAsync("products_list", products, TimeSpan.FromMinutes(5));
        
        return Ok(products);
    }
    
    [HttpPost]
    public async Task<ActionResult> CreateProduct(Product product)
    {
        // ... crear producto ...
        
        // Invalidar cache
        await _cache.RemoveAsync("products_list");
        
        return Ok(product);
    }
}
```

## Métodos Disponibles

### GetAsync<T>(string key)
Obtiene un valor del cache de forma asíncrona.

```csharp
var products = await _cache.GetAsync<List<Product>>("products_list");
```

### SetAsync<T>(string key, T value, TimeSpan? expiration)
Guarda un valor en el cache con expiración opcional.

```csharp
await _cache.SetAsync("products_list", products, TimeSpan.FromMinutes(5));
```

### RemoveAsync(string key)
Elimina un valor del cache.

```csharp
await _cache.RemoveAsync("products_list");
```

### ExistsAsync(string key)
Verifica si existe una clave en el cache.

```csharp
var exists = await _cache.ExistsAsync("products_list");
```

### Get<T>(string key) y Set<T>(string key, T value)
Métodos síncronos para compatibilidad (no recomendados para Redis).

## Ventajas sobre Memory Cache

### 1. Compartido entre Instancias
- **Memory Cache**: Cada instancia tiene su propio cache
- **Redis**: Todas las instancias comparten el mismo cache

### 2. Persistencia
- **Memory Cache**: Se pierde al reiniciar
- **Redis**: Persiste con `appendonly yes`

### 3. Escalabilidad
- **Memory Cache**: Limitado a memoria del servidor
- **Redis**: Puede escalar horizontalmente

### 4. Funciones Avanzadas
- **Memory Cache**: Solo key-value básico
- **Redis**: Pub/Sub, Sets, Sorted Sets, etc.

## Fallback Automático

Si Redis no está configurado o no está disponible:
- El sistema automáticamente usa **Memory Cache**
- No se requiere cambio de código
- Los logs indican qué tipo de cache se está usando

## Monitoreo

### Verificar Estado de Redis

```bash
# Desde Docker
docker exec -it cornerapp-redis redis-cli ping
# Debe responder: PONG

# Ver todas las claves
docker exec -it cornerapp-redis redis-cli KEYS "*"

# Ver información del servidor
docker exec -it cornerapp-redis redis-cli INFO
```

### Logs

El sistema registra qué tipo de cache se está usando:

```
[INFO] Redis configurado como Distributed Cache: localhost:6379
```

o

```
[INFO] Usando Memory Cache (Redis no configurado)
```

## Mejores Prácticas

### 1. Claves Descriptivas
```csharp
// ✅ Bueno
"products_list"
"category_1_products"
"user_123_profile"

// ❌ Malo
"p"
"data"
"cache1"
```

### 2. Expiración Apropiada
```csharp
// Datos que cambian frecuentemente: expiración corta
await _cache.SetAsync("products_list", products, TimeSpan.FromMinutes(5));

// Datos estables: expiración larga
await _cache.SetAsync("categories_list", categories, TimeSpan.FromHours(1));
```

### 3. Invalidación al Modificar
```csharp
[HttpPost]
public async Task<ActionResult> CreateProduct(Product product)
{
    // ... crear producto ...
    
    // Invalidar cache relacionado
    await _cache.RemoveAsync("products_list");
    await _cache.RemoveAsync($"category_{product.CategoryId}_products");
    
    return Ok(product);
}
```

### 4. Manejo de Errores
El `CacheService` maneja errores automáticamente:
- Si Redis falla, registra warning pero no rompe la aplicación
- Si Memory Cache falla, simplemente no cachea

## Troubleshooting

### Redis no se conecta

1. **Verificar que Redis esté corriendo**:
```bash
docker ps | grep redis
```

2. **Verificar connection string**:
```bash
# En appsettings.json o variables de entorno
ConnectionStrings__Redis=localhost:6379
```

3. **Verificar logs**:
```bash
docker-compose logs redis
```

### Cache no funciona

1. **Verificar configuración**:
```bash
# Debe aparecer en logs al iniciar
[INFO] Redis configurado como Distributed Cache
```

2. **Verificar claves en Redis**:
```bash
docker exec -it cornerapp-redis redis-cli KEYS "CornerApp:*"
```

### Performance

Si Redis es lento:
1. Verificar latencia de red
2. Considerar Redis en la misma red Docker
3. Verificar configuración de Redis (memoria, persistencia)

## Producción

### Configuración Recomendada

```json
{
  "Redis": {
    "Enabled": true,
    "ConnectionString": "redis-server:6379,password=strong-password",
    "InstanceName": "CornerApp:"
  }
}
```

### Seguridad

1. **Usar contraseña**:
```bash
Redis__ConnectionString=redis-server:6379,password=strong-password
```

2. **Redis en red privada** (no exponer puerto públicamente)

3. **TLS/SSL** para conexiones remotas

### Alta Disponibilidad

Para producción, considerar:
- **Redis Sentinel**: Para alta disponibilidad
- **Redis Cluster**: Para escalabilidad horizontal
- **Redis Replication**: Para redundancia

## Referencias

- [Redis Documentation](https://redis.io/docs/)
- [StackExchange.Redis](https://stackexchange.github.io/StackExchange.Redis/)
- [Microsoft Distributed Caching](https://docs.microsoft.com/en-us/aspnet/core/performance/caching/distributed)

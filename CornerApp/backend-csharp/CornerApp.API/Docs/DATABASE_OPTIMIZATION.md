# Optimización de Base de Datos

Este documento describe las optimizaciones implementadas en la base de datos para mejorar el rendimiento de las consultas.

## Índices Implementados

### Category (Categorías)
- **Índice único**: `Name` (ya existía)
- **Índice simple**: `IsActive`
- **Índice simple**: `DisplayOrder`
- **Índice compuesto**: `(IsActive, DisplayOrder)` - Optimiza consultas que filtran por estado activo y ordenan por DisplayOrder

### Product (Productos)
- **Índice simple**: `CategoryId` - Optimiza JOINs con categorías
- **Índice simple**: `IsAvailable` - Optimiza filtros de disponibilidad
- **Índice simple**: `DisplayOrder` - Optimiza ordenamiento
- **Índice compuesto**: `(CategoryId, IsAvailable, DisplayOrder)` - Optimiza la consulta más común: productos por categoría, disponibles, ordenados

### Order (Pedidos)
- **Índice simple**: `Status` - Optimiza filtros por estado (pending, preparing, delivering, etc.)
- **Índice simple**: `CreatedAt` - Optimiza ordenamiento y filtros por fecha
- **Índice simple**: `CustomerId` - Optimiza JOINs con clientes
- **Índice simple**: `DeliveryPersonId` - Optimiza JOINs con repartidores
- **Índice simple**: `IsArchived` - Optimiza filtros de archivado
- **Índice compuesto**: `(Status, CreatedAt)` - Optimiza consultas por estado y fecha (muy común en dashboard)
- **Índice compuesto**: `(CustomerId, IsArchived)` - Optimiza consultas de historial de cliente
- **Índice compuesto**: `(DeliveryPersonId, Status)` - Optimiza consultas de pedidos asignados a repartidor

### Customer (Clientes)
- **Índice único**: `Email` (ya existía)
- **Índice simple**: `Phone` (ya existía)

### DeliveryPerson (Repartidores)
- **Índice único**: `Username` (ya existía)
- **Índice único**: `Email` (ya existía)
- **Índice simple**: `Phone` (ya existía)

## Optimizaciones de Consultas

### AsNoTracking()
Se ha implementado `AsNoTracking()` en todas las consultas de solo lectura para mejorar el rendimiento:

- **Productos**: `GetProducts()`, `GetProduct(int id)`
- **Categorías**: `GetCategories()`, `GetCategory(int id)`

**Beneficios**:
- Reduce el overhead de tracking de cambios de EF Core
- Mejora el rendimiento en consultas de solo lectura
- Reduce el uso de memoria

### Uso de Índices Compuestos
Los índices compuestos están diseñados para optimizar las consultas más frecuentes:

1. **Productos por categoría**: `WHERE CategoryId = X AND IsAvailable = true ORDER BY DisplayOrder`
2. **Pedidos por estado y fecha**: `WHERE Status = X ORDER BY CreatedAt DESC`
3. **Pedidos de cliente**: `WHERE CustomerId = X AND IsArchived = false`

## Migraciones

Para aplicar estos índices a la base de datos existente, ejecuta:

```bash
dotnet ef migrations add AddDatabaseIndexes
dotnet ef database update
```

## Monitoreo

Para verificar el uso de índices en SQL Server:

```sql
-- Ver índices de una tabla
EXEC sp_helpindex 'Orders'

-- Ver estadísticas de uso de índices
SELECT 
    OBJECT_NAME(s.object_id) AS TableName,
    i.name AS IndexName,
    s.user_seeks,
    s.user_scans,
    s.user_lookups,
    s.user_updates
FROM sys.dm_db_index_usage_stats s
INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
WHERE OBJECT_NAME(s.object_id) IN ('Orders', 'Products', 'Categories')
ORDER BY s.user_seeks + s.user_scans + s.user_lookups DESC
```

## Mejores Prácticas

1. **Siempre usar AsNoTracking()** en consultas de solo lectura
2. **Evitar SELECT *** - Seleccionar solo las columnas necesarias
3. **Usar Include()** solo cuando sea necesario para evitar N+1 queries
4. **Monitorear queries lentas** usando SQL Server Profiler o Application Insights
5. **Revisar índices periódicamente** para asegurar que se están usando

## Impacto Esperado

- **Consultas de productos**: 30-50% más rápidas
- **Consultas de pedidos**: 40-60% más rápidas (especialmente con filtros por estado)
- **Uso de memoria**: Reducción del 20-30% en operaciones de solo lectura
- **Carga del servidor**: Reducción general del 15-25%

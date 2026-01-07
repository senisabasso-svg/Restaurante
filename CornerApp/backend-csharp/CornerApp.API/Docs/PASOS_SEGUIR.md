# Pasos para Continuar 🚀

## 1. Crear las Migraciones

Las migraciones crean las tablas en la base de datos según las entidades que definimos.

```bash
cd backend-csharp/CornerApp.API
dotnet ef migrations add InitialCreate
```

Este comando creará los archivos de migración en la carpeta `Migrations/`.

## 2. Aplicar las Migraciones

### Opción A: Automática (Recomendada para desarrollo)
Las migraciones se aplican automáticamente al ejecutar la aplicación en modo desarrollo.

### Opción B: Manual
```bash
dotnet ef database update
```

## 3. Ejecutar el Backend

```bash
dotnet run
```

El servidor estará disponible en:
- **HTTP**: http://localhost:5000
- **HTTPS**: https://localhost:5001
- **Swagger**: http://localhost:5000/swagger

## 4. Probar los Endpoints

### Usar Swagger UI (Más fácil)
1. Abre http://localhost:5000/swagger
2. Prueba los endpoints directamente desde la interfaz

### O probar con Postman/curl

**Productos:**
```bash
GET http://localhost:5000/api/products
```

**Categorías:**
```bash
GET http://localhost:5000/api/categories
```

**Crear pedido:**
```bash
POST http://localhost:5000/api/orders
Content-Type: application/json

{
  "customerName": "Juan Pérez",
  "customerPhone": "+541112345678",
  "customerAddress": "Av. Corrientes 1234",
  "paymentMethod": "cash",
  "items": [
    {
      "id": 1,
      "name": "Pizza Margarita",
      "price": 12.99,
      "quantity": 2
    }
  ]
}
```

## 5. Verificar la Base de Datos

### SQLite (Desarrollo)
El archivo `cornerapp.db` se crea en la raíz del proyecto. Puedes usar:
- **DB Browser for SQLite** (https://sqlitebrowser.org/)
- Abrir el archivo y ver las tablas creadas

## 6. Probar con el Frontend

1. Asegúrate de que el backend esté corriendo en `http://localhost:5000`
2. Ejecuta tu app React Native
3. La app debería conectarse automáticamente al backend

## 📝 Checklist de Verificación

- [ ] Migraciones creadas (`dotnet ef migrations add InitialCreate`)
- [ ] Base de datos creada (automático o manual)
- [ ] Backend ejecutándose (`dotnet run`)
- [ ] Swagger accesible en http://localhost:5000/swagger
- [ ] Endpoint `/api/products` devuelve productos
- [ ] Endpoint `/api/categories` devuelve categorías
- [ ] Frontend se conecta al backend

## 🐛 Si hay Errores

### Error: "dotnet ef command not found"
```bash
dotnet tool install --global dotnet-ef
```

### Error: "No database found"
Las migraciones se aplican automáticamente al iniciar. Si hay problema:
```bash
dotnet ef database update
```

### Error: "Migration already exists"
Elimina la carpeta `Migrations/` y crea nuevamente:
```bash
rmdir /s Migrations
dotnet ef migrations add InitialCreate
```

## 🎯 Próximos Pasos Opcionales

### Mejoras de Funcionalidad
1. **Autenticación de usuarios** - Login/registro
2. **Sistema de favoritos** - Productos favoritos por cliente
3. **Promociones/Descuentos** - Cupones y ofertas
4. **Sistema de evaluación** - Reseñas y calificaciones
5. **Notificaciones push** - Estado del pedido

### Mejoras Técnicas
1. **Paginación** - Para listas grandes de productos/pedidos
2. **Filtros avanzados** - Por precio, categoría, disponibilidad
3. **Cache** - Redis para mejor rendimiento
4. **Logging avanzado** - Serilog para mejor tracking
5. **Tests unitarios** - XUnit para validar funcionalidad

### Integraciones
1. **Email** - Confirmaciones de pedido
2. **SMS** - Notificaciones de entrega
3. **Mapeo de direcciones** - Google Maps API
4. **Tracking de entregas** - Tiempo real

## 📚 Recursos Útiles

- [Documentación EF Core](https://learn.microsoft.com/en-us/ef/core/)
- [ASP.NET Core API](https://learn.microsoft.com/en-us/aspnet/core/web-api/)
- [Swagger/OpenAPI](https://swagger.io/)


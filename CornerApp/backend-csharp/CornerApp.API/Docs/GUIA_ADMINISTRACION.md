# 🔧 Guía de Administración - CornerApp API

Esta guía te explica cómo gestionar productos, categorías y pedidos desde el panel de administración.

## 📋 Índice

1. [Acceso a Swagger UI](#acceso-a-swagger-ui)
2. [Gestionar Categorías](#gestionar-categorías)
3. [Gestionar Productos](#gestionar-productos)
4. [Ver Pedidos](#ver-pedidos)
5. [Gestión desde SQL Server](#gestión-desde-sql-server)

---

## 🌐 Acceso a Swagger UI

**Swagger** es la interfaz web que te permite gestionar la API de forma visual.

### Cómo acceder:

1. **Asegúrate de que el backend esté corriendo:**
   ```bash
   cd backend-csharp\CornerApp.API
   dotnet run
   ```

2. **Abre tu navegador en:**
   ```
   http://localhost:5000/swagger
   ```

3. **Verás una interfaz con todos los endpoints disponibles**

---

## 📂 Gestionar Categorías

### Ver todas las categorías
- **Endpoint:** `GET /api/categories`
- **En Swagger:** Busca "Categories" → `GET /api/categories` → Click en "Try it out" → "Execute"
- **Respuesta:** Lista de todas las categorías activas

### Ver una categoría específica
- **Endpoint:** `GET /api/categories/{id}`
- **Ejemplo:** `GET /api/categories/1` (ver categoría con ID 1)

### Crear una nueva categoría
- **Endpoint:** `POST /api/categories`
- **En Swagger:** 
  1. Busca "Categories" → `POST /api/categories`
  2. Click en "Try it out"
  3. Edita el JSON de ejemplo:
   ```json
   {
     "name": "ensaladas",
     "description": "Ensaladas frescas y saludables",
     "icon": "leaf",
     "displayOrder": 4,
     "isActive": true
   }
   ```
  4. Click en "Execute"

### Actualizar una categoría
- **Endpoint:** `PUT /api/categories/{id}` (actualización completa)
- **Endpoint:** `PATCH /api/categories/{id}` (actualización parcial)
- **Ejemplo PATCH** (solo actualizar nombre):
   ```json
   {
     "name": "Ensaladas Premium"
   }
   ```

### Eliminar una categoría (soft delete)
- **Endpoint:** `DELETE /api/categories/{id}`
- **Nota:** Solo marca la categoría como inactiva. No se puede eliminar si tiene productos disponibles.

### Eliminar permanentemente una categoría
- **Endpoint:** `DELETE /api/categories/{id}/permanent`
- **Advertencia:** Solo funciona si la categoría NO tiene productos asociados.

---

## 🍕 Gestionar Productos

### Ver todos los productos
- **Endpoint:** `GET /api/products`
- **Nota:** Solo muestra productos disponibles (`IsAvailable = true`)

### Ver un producto específico
- **Endpoint:** `GET /api/products/{id}`

### Crear un nuevo producto

**Endpoint:** `POST /api/products`

**En Swagger:**
1. Busca "Products" → `POST /api/products`
2. Click en "Try it out"
3. Edita el JSON de ejemplo:

```json
{
  "name": "Pizza Napolitana",
  "description": "Pizza italiana tradicional con tomate, mozzarella y albahaca",
  "price": 18.99,
  "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400",
  "categoryId": 1,
  "isAvailable": true
}
```

**Campos requeridos:**
- `name`: Nombre del producto
- `description`: Descripción
- `price`: Precio (decimal)
- `categoryId`: ID de la categoría (debe existir)
- `image`: URL de la imagen (opcional)
- `isAvailable`: true/false (por defecto: true)

**💡 Tip:** Para saber el `categoryId`, primero consulta las categorías con `GET /api/categories`.

**Ejemplo con IDs de categoría comunes:**
- `1` = pizza
- `2` = bebida
- `3` = postre

### Actualizar un producto

**Endpoint:** `PUT /api/products/{id}` (actualización completa)
**Endpoint:** `PATCH /api/products/{id}` (actualización parcial - recomendado)

**Ejemplo PATCH** (cambiar solo el precio):
```json
{
  "price": 20.99
}
```

**Ejemplo PATCH** (cambiar precio y descripción):
```json
{
  "price": 19.99,
  "description": "Nueva descripción del producto"
}
```

### Eliminar un producto (soft delete)
- **Endpoint:** `DELETE /api/products/{id}`
- **Acción:** Marca el producto como `IsAvailable = false`. No aparecerá en el menú pero se mantiene en la BD.

### Eliminar permanentemente un producto
- **Endpoint:** `DELETE /api/products/{id}/permanent`
- **Advertencia:** Elimina el producto de la base de datos permanentemente.

---

## 📦 Ver Pedidos

### Ver todos los pedidos
- **Endpoint:** `GET /api/orders`
- **En Swagger:** Busca "Orders" → `GET /api/orders`

### Ver un pedido específico
- **Endpoint:** `GET /api/orders/{id}`

### Actualizar estado de un pedido
- **Endpoint:** `PATCH /api/orders/{id}/status`
- **Ejemplo:**
   ```json
   {
     "status": "En preparación"
   }
   ```
- **Estados comunes:** "Pendiente", "En preparación", "En camino", "Entregado", "Cancelado"

### Actualizar método de pago
- **Endpoint:** `PATCH /api/orders/{id}/payment`
- **Ejemplo:**
   ```json
   {
     "paymentMethod": "efectivo",
     "paymentStatus": "pagado"
   }
   ```

---

## 🗄️ Gestión desde SQL Server

Si prefieres gestionar directamente desde SQL Server Management Studio:

### Ver categorías
```sql
SELECT * FROM Categories;
```

### Ver productos
```sql
SELECT p.Id, p.Name, p.Price, c.Name AS CategoryName
FROM Products p
INNER JOIN Categories c ON p.CategoryId = c.Id
WHERE p.IsAvailable = 1;
```

### Agregar una categoría
```sql
INSERT INTO Categories (Name, Description, DisplayOrder, IsActive, CreatedAt)
VALUES ('ensaladas', 'Ensaladas frescas', 4, 1, GETUTCDATE());
```

### Agregar un producto
```sql
-- Primero obtén el CategoryId (por ejemplo, 1 para pizza)
INSERT INTO Products (Name, Description, Price, Image, CategoryId, IsAvailable, CreatedAt)
VALUES (
    'Pizza Napolitana',
    'Pizza italiana tradicional',
    18.99,
    'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
    1, -- CategoryId (1=pizza, 2=bebida, 3=postre)
    1, -- IsAvailable
    GETUTCDATE()
);
```

### Actualizar precio de un producto
```sql
UPDATE Products
SET Price = 20.99, UpdatedAt = GETUTCDATE()
WHERE Id = 1; -- ID del producto
```

### Desactivar un producto
```sql
UPDATE Products
SET IsAvailable = 0, UpdatedAt = GETUTCDATE()
WHERE Id = 1; -- ID del producto
```

---

## 📝 Ejemplos Completos

### Ejemplo 1: Crear una nueva categoría "Bebidas Alcohólicas"

**En Swagger:**
```json
POST /api/categories
{
  "name": "bebida_alcoholica",
  "description": "Bebidas alcohólicas para adultos",
  "icon": "wine",
  "displayOrder": 5,
  "isActive": true
}
```

### Ejemplo 2: Agregar un nuevo producto "Cerveza Artesanal"

**Primero, obten el ID de la categoría creada (por ejemplo, ID = 4)**

**En Swagger:**
```json
POST /api/products
{
  "name": "Cerveza Artesanal",
  "description": "Cerveza artesanal 500ml",
  "price": 8.99,
  "image": "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400",
  "categoryId": 4,
  "isAvailable": true
}
```

### Ejemplo 3: Actualizar el precio de la "Pizza Margarita"

**Primero, encuentra el ID del producto (ej: ID = 1)**

**En Swagger:**
```json
PATCH /api/products/1
{
  "price": 15.99
}
```

---

## ⚠️ Notas importantes

1. **Soft Delete:** Por defecto, `DELETE` marca los registros como inactivos, no los elimina. Esto preserva el historial.
2. **Relaciones:** No puedes eliminar una categoría si tiene productos activos.
3. **Precios:** Usa formato decimal (ej: `18.99`, no `"18.99"` en JSON).
4. **Imágenes:** Usa URLs válidas de imágenes (recomendado: Unsplash, Imgur, etc.).
5. **CategoryId:** Siempre debe existir antes de crear un producto.

---

## 🔍 Troubleshooting

### Error: "La categoría con ID X no existe"
- Verifica que la categoría exista con `GET /api/categories`
- Asegúrate de usar el ID correcto

### Error: "No se puede eliminar una categoría que tiene productos"
- Primero desactiva todos los productos de esa categoría
- O elimina/mueve los productos a otra categoría

### Producto no aparece en la app
- Verifica que `isAvailable` sea `true`
- Revisa que `categoryId` sea correcto
- Refresca la app móvil

---

## 📞 Próximos pasos

Si quieres una **interfaz web de administración** más amigable (panel de admin), puedo crear una pantalla de admin en la app móvil o una página web separada.

¿Necesitas ayuda con algo específico? ¡Pregúntame!


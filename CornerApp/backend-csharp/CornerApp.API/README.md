# Backend C# - Integración Mercado Pago

Backend completo en C# (.NET 8) para integrar Mercado Pago con CornerApp.

## 📋 Requisitos

- .NET 8.0 SDK o superior
- Visual Studio 2022 o VS Code
- Cuenta de Mercado Pago con Access Token (opcional para modo simulado)

## 🚀 Instalación

1. **Instala .NET SDK** (si no lo tienes):
   - Descarga desde: https://dotnet.microsoft.com/download

2. **Navega a la carpeta del proyecto**:
   ```bash
   cd backend-csharp/CornerApp.API
   ```

3. **Restaura los paquetes NuGet**:
   ```bash
   dotnet restore
   ```

4. **Configura las credenciales** en `appsettings.json`:
   ```json
   {
     "MercadoPago": {
       "AccessToken": "TU_ACCESS_TOKEN_AQUI",
       "SuccessUrl": "https://tu-app.com/mercadopago/success",
       "FailureUrl": "https://tu-app.com/mercadopago/failure",
       "PendingUrl": "https://tu-app.com/mercadopago/pending",
       "WebhookUrl": "https://tu-backend.com/api/mercadopago/webhook"
     }
   }
   ```

   **Nota**: Si no tienes Access Token o prefieres usar modo simulado, déjalo como "TU_ACCESS_TOKEN_AQUI" y el backend usará URLs simuladas.

## 🏃 Ejecución

### Desarrollo

```bash
dotnet run
```

El servidor estará disponible en:
- HTTP: http://localhost:5000
- HTTPS: https://localhost:5001
- Swagger UI: http://localhost:5000/swagger

### Producción

```bash
dotnet publish -c Release
cd bin/Release/net8.0/publish
dotnet CornerApp.API.dll
```

## 📝 Endpoints

### Productos

#### GET `/api/products`
Obtiene todos los productos disponibles.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Pizza Margarita",
    "category": "pizza",
    "description": "Deliciosa pizza...",
    "price": 12.99,
    "image": "https://..."
  }
]
```

### Pedidos

#### POST `/api/orders`
Crea un nuevo pedido.

**Request:**
```json
{
  "customerName": "Juan Pérez",
  "customerPhone": "+541112345678",
  "customerAddress": "Av. Corrientes 1234",
  "customerEmail": "juan@example.com",
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

**Response:**
```json
{
  "id": 1,
  "customerName": "Juan Pérez",
  "total": 25.98,
  "status": "pending",
  "estimatedDeliveryMinutes": 35,
  "createdAt": "2024-01-01T12:00:00Z"
}
```

#### GET `/api/orders/{id}`
Obtiene un pedido por ID.

#### GET `/api/orders`
Obtiene todos los pedidos (útil para administración).

### Mercado Pago

#### POST `/api/mercadopago/create-preference`
Crea una preferencia de pago en Mercado Pago.

**Nota**: Si no tienes Access Token configurado, devolverá una URL simulada para testing.

#### GET `/api/mercadopago/payment/{paymentId}`
Obtiene el estado de un pago específico.

#### POST `/api/mercadopago/webhook`
Endpoint para recibir notificaciones de Mercado Pago.

## 🔧 Modo Simulado vs Real

### Modo Simulado (sin Access Token)
- Funciona sin credenciales de Mercado Pago
- Devuelve URLs simuladas para testing
- Perfecto para desarrollo y testing
- Puedes probar todo el flujo sin necesidad de cuenta de Mercado Pago

### Modo Real (con Access Token)
- Requiere credenciales reales de Mercado Pago
- Crea preferencias reales (en sandbox o producción)
- Procesa pagos reales

## 🧪 Pruebas

### Con Swagger UI

1. Ejecuta el servidor: `dotnet run`
2. Abre http://localhost:5000/swagger
3. Prueba los endpoints directamente desde la interfaz

### Con el Frontend

1. Asegúrate de que el servidor esté corriendo en `http://localhost:5000`
2. El frontend se conectará automáticamente
3. Si el backend no está disponible, el frontend usará datos simulados como fallback

## 📦 Estructura del Proyecto

```
CornerApp.API/
├── Controllers/
│   ├── MercadoPagoController.cs    # Endpoints de Mercado Pago
│   ├── ProductsController.cs       # Endpoints de productos
│   └── OrdersController.cs         # Endpoints de pedidos
├── Services/
│   ├── IMercadoPagoService.cs      # Interface del servicio
│   └── MercadoPagoService.cs       # Implementación con SDK
├── Models/
│   ├── Product.cs                  # Modelo de producto
│   ├── Order.cs                    # Modelo de pedido
│   ├── CreatePreferenceRequest.cs  # Request models
│   └── CreatePreferenceResponse.cs # Response models
├── Program.cs                       # Configuración de la app
└── appsettings.json                 # Configuración
```

## 🔐 Próximos Pasos (Base de Datos)

Actualmente los datos se guardan en memoria. Para producción, deberías:

1. Agregar Entity Framework Core
2. Configurar SQL Server, PostgreSQL o tu base de datos preferida
3. Crear migraciones
4. Reemplazar las listas en memoria con consultas a la BD

Ejemplo de agregar EF Core:
```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Tools
```

## 📚 Recursos

- [Documentación .NET](https://docs.microsoft.com/dotnet/)
- [SDK Mercado Pago .NET](https://github.com/mercadopago/dotnet-sdk)
- [Documentación Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs)


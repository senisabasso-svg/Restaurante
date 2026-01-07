# Estructura del Proyecto CornerApp.API

## 📁 Organización de Carpetas

```
CornerApp.API/
├── Controllers/          # Controladores de la API
│   ├── AdminController.cs
│   ├── AuthController.cs
│   ├── CategoriesController.cs
│   ├── CustomersController.cs
│   ├── DeliveryPersonController.cs
│   ├── OrdersController.cs
│   ├── PointsController.cs
│   └── ProductsController.cs
│
├── Data/                 # Acceso a datos
│   └── ApplicationDbContext.cs
│
├── DTOs/                 # Data Transfer Objects (DTOs)
│   ├── AuthDTOs.cs
│   ├── CategoryDTOs.cs
│   ├── CustomerDTOs.cs
│   ├── DeliveryPersonDTOs.cs
│   ├── OrderDTOs.cs
│   ├── PaymentMethodDTOs.cs
│   ├── PointsDTOs.cs
│   ├── ProductDTOs.cs
│   └── MercadoPago/      # DTOs específicos de MercadoPago
│       └── MercadoPagoDTOs.cs
│
├── Constants/            # Constantes de la aplicación
│   ├── AppConstants.cs   # Constantes generales (tiempos, tamaños de archivo, paths, URLs)
│   ├── OrderConstants.cs # Constantes de pedidos y estados
│   ├── PaymentConstants.cs # Constantes de métodos de pago
│   └── SortConstants.cs  # Constantes de ordenamiento
│
├── Helpers/              # Funciones auxiliares y utilidades
│   ├── OrderHelpers.cs   # Helpers para pedidos
│   └── StringHelpers.cs  # Helpers para operaciones con strings
│
├── Models/               # Entidades del dominio
│   ├── Category.cs
│   ├── Customer.cs
│   ├── DeliveryPerson.cs
│   ├── DeliveryZoneOptions.cs
│   ├── Order.cs
│   ├── PaymentMethod.cs
│   ├── Product.cs
│   └── WebhookNotification.cs
│
├── Services/             # Servicios de negocio
│   ├── DeliveryZoneService.cs
│   └── IDeliveryZoneService.cs
│
├── ViewModels/           # ViewModels para vistas y reportes
│   ├── ProductSalesData.cs
│   ├── ReportStats.cs
│   └── RevenueData.cs
│
├── Migrations/           # Migraciones de Entity Framework
│
├── Docs/                 # Documentación del proyecto
│   ├── CONFIGURAR_SQL_SERVER.md
│   ├── DASHBOARD_WEB.md
│   ├── GUIA_ADMINISTRACION.md
│   ├── INTEGRATION_GUIDE.md
│   └── PASOS_SEGUIR.md
│
└── wwwroot/              # Archivos estáticos
    ├── assets/
    └── images/
```

## 📝 Convenciones

### DTOs (Data Transfer Objects)
- Ubicación: `DTOs/`
- Propósito: Objetos para transferir datos entre capas
- Nomenclatura: `{Entity}DTOs.cs` o `{Feature}DTOs.cs`
- Ejemplo: `ProductDTOs.cs`, `OrderDTOs.cs`

### ViewModels
- Ubicación: `ViewModels/`
- Propósito: Modelos para vistas y reportes
- Nomenclatura: `{Purpose}Data.cs` o `{Purpose}Stats.cs`
- Ejemplo: `RevenueData.cs`, `ReportStats.cs`

### Helpers
- Ubicación: `Helpers/`
- Propósito: Funciones auxiliares reutilizables
- Nomenclatura: `{Domain}Helpers.cs`
- Ejemplo: `OrderHelpers.cs`

### Models
- Ubicación: `Models/`
- Propósito: Entidades del dominio (Entity Framework)
- Nomenclatura: Nombre de la entidad
- Ejemplo: `Product.cs`, `Order.cs`

## 🔄 Flujo de Datos

1. **Request** → `DTOs` → **Controller** → **Service/Data** → **Model**
2. **Model** → **Service/Data** → **Controller** → **DTOs/ViewModels** → **Response**

## 📚 Mejores Prácticas

- ✅ Separar DTOs de Models
- ✅ Usar ViewModels para reportes y vistas
- ✅ Extraer lógica común a Helpers
- ✅ Mantener documentación en `Docs/`
- ✅ Organizar DTOs por dominio cuando sea necesario

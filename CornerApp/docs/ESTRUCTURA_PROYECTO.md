# Estructura del Proyecto CornerApp (Frontend)

## 📁 Organización de Carpetas

```
CornerApp/
├── App.js                 # Punto de entrada de la aplicación
├── app.json              # Configuración de Expo
├── package.json          # Dependencias del proyecto
│
├── assets/               # Recursos estáticos
│   ├── logo.png
│   └── images/
│       ├── categories/   # Iconos de categorías
│       └── products/     # Imágenes de productos
│
├── components/           # Componentes reutilizables
│   ├── common/          # Componentes comunes (ErrorBoundary, Toast, etc.)
│   ├── cart/            # Componentes del carrito (CartItem)
│   └── product/         # Componentes de productos (ProductCard, LazyImage)
│
├── constants/           # Constantes de la aplicación
│   ├── api.js           # Endpoints y configuración de API
│   └── app.js           # Constantes generales (estados, métodos de pago, etc.)
│
├── context/             # Context API de React
│   └── ThemeContext.js  # Contexto de tema
│
├── docs/                # Documentación del proyecto
│   ├── CONFIGURAR_CONEXION.md
│   ├── EXPO_CONFIGURACION.md
│   ├── EXPO_GO_GUIA.md
│   ├── MERCADOPAGO_INTEGRATION.md
│   ├── SOLUCIONAR_CONEXION.md
│   ├── SOLUCIONAR_EXPO_GO.md
│   ├── TESTING_CHECKLIST.md
│   └── TESTING_GUIDE.md
│
├── redux/               # Estado global con Redux
│   ├── slices/          # Redux slices
│   │   ├── authSlice.js
│   │   └── cartSlice.js
│   └── store.js         # Configuración del store
│
├── screens/             # Pantallas de la aplicación
│   ├── HomeScreen.js
│   ├── MenuScreen.js
│   ├── CartScreen.js
│   ├── CheckoutScreen.js
│   ├── LoginScreen.js
│   ├── RegisterScreen.js
│   ├── ProfileScreen.js
│   ├── EditProfileScreen.js
│   ├── MyOrdersScreen.js
│   ├── OrderTrackingScreen.js
│   ├── PointsScreen.js
│   ├── DeliveryOrdersScreen.js
│   └── DeliveryOrderDetailScreen.js
│
├── services/            # Servicios y lógica de negocio
│   ├── api.js           # Cliente HTTP (axios)
│   ├── auth.js          # Servicio de autenticación
│   ├── analytics.js     # Servicio de analíticas
│   ├── geocoding.js     # Servicio de geocodificación
│   └── locationTask.js  # Tarea de ubicación en segundo plano
│
└── utils/               # Utilidades y funciones auxiliares
    └── gradients.js     # Utilidades de gradientes
```

## 📝 Convenciones

### Componentes
- **Ubicación**: `components/`
- **Organización**: Por funcionalidad (common, cart, product)
- **Nomenclatura**: PascalCase (ej: `ProductCard.js`, `CartItem.js`)

### Screens
- **Ubicación**: `screens/`
- **Nomenclatura**: PascalCase con sufijo "Screen" (ej: `HomeScreen.js`, `LoginScreen.js`)

### Services
- **Ubicación**: `services/`
- **Propósito**: Lógica de negocio y comunicación con API
- **Nomenclatura**: camelCase (ej: `api.js`, `auth.js`)

### Constants
- **Ubicación**: `constants/`
- **Propósito**: Valores constantes y configuración
- **Nomenclatura**: camelCase (ej: `api.js`, `app.js`)

### Redux
- **Ubicación**: `redux/slices/`
- **Nomenclatura**: camelCase con sufijo "Slice" (ej: `authSlice.js`, `cartSlice.js`)

## 🔄 Flujo de Datos

1. **User Action** → **Screen** → **Service** → **API**
2. **API Response** → **Service** → **Redux Slice** → **Screen Update**
3. **Redux State** → **Components** → **UI Update**

## 📚 Mejores Prácticas

- ✅ Separar lógica de negocio en services
- ✅ Usar Redux para estado global
- ✅ Componentes reutilizables en `components/`
- ✅ Constantes centralizadas en `constants/`
- ✅ Documentación en `docs/`
- ✅ Assets organizados por tipo en `assets/`

## 🎨 Estructura de Componentes

```
components/
├── common/          # Componentes genéricos
│   ├── ErrorBoundary.js
│   └── Toast.js
├── cart/            # Componentes del carrito
│   └── CartItem.js
└── product/         # Componentes de productos
    ├── ProductCard.js
    └── LazyImage.js
```

## 🔧 Configuración

- **Expo**: `app.json`
- **Babel**: `babel.config.js`
- **Metro**: `metro.config.js`
- **Dependencias**: `package.json`

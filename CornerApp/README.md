# CornerApp - Aplicación de Pizzería

Aplicación móvil desarrollada con React Native y Expo para una pizzería que permite ver el menú, agregar productos al carrito y realizar pedidos.

## Características

- 🍕 Visualización del menú con pizzas, bebidas y postres
- 🛒 Carrito de compras con gestión de cantidad
- 📝 Formulario de checkout con información de entrega
- 💾 Persistencia del carrito con AsyncStorage
- 🎨 Diseño moderno con Tailwind CSS (NativeWind)

## Estructura del Proyecto

```
CornerApp/
├── screens/          # Pantallas principales
├── components/        # Componentes reutilizables
├── redux/            # Store y slices de Redux
│   ├── store.js
│   └── slices/
│       └── cartSlice.js
├── services/         # Servicios API
│   └── api.js
├── App.js           # Punto de entrada
├── global.css       # Estilos Tailwind
├── package.json
└── README.md
```

## Instalación

1. Instala las dependencias:
```bash
npm install
```

## Uso

1. Inicia el servidor de desarrollo:
```bash
npm start
```

2. Escanea el código QR con la app Expo Go en tu dispositivo móvil o presiona:
   - `a` para Android
   - `i` para iOS
   - `w` para Web

## Tecnologías Utilizadas

- React Native (Expo)
- React Navigation
- Redux Toolkit
- NativeWind (Tailwind CSS)
- AsyncStorage
- Axios

## Funcionalidades

### Pantalla de Inicio
- Muestra el logo/nombre de la pizzería
- Botón para navegar al menú

### Pantalla de Menú
- Lista de productos organizados por categoría (Pizzas, Bebidas, Postres)
- Cada producto muestra: imagen, nombre, descripción y precio
- Botón para agregar productos al carrito

### Pantalla de Carrito
- Muestra los productos agregados con cantidad y subtotal
- Permite modificar la cantidad o eliminar productos
- Muestra el total general
- Botón para confirmar el pedido

### Pantalla de Checkout
- Formulario con nombre, teléfono y dirección
- Método de pago: Efectivo al entregar
- Confirmación del pedido con alerta de éxito

## Estado de Redux

El carrito se gestiona con Redux Toolkit y se persiste automáticamente en AsyncStorage.

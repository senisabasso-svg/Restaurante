# CornerApp Frontend

Frontend moderno para CornerApp, construido con React + TypeScript + Vite.

## 🚀 Tecnologías

- **React 18** - Biblioteca de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool ultra rápido
- **Tailwind CSS** - Estilos utilitarios
- **React Router** - Navegación
- **Lucide React** - Iconos

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Construir para producción
npm run build

# Preview de producción
npm run preview
```

## 🏗️ Estructura del Proyecto

```
frontend/
├── src/
│   ├── api/              # Cliente API centralizado
│   ├── components/       # Componentes reutilizables
│   │   ├── Layout/       # Layout principal
│   │   ├── Modal/        # Componentes de modal
│   │   ├── Navbar/       # Barra de navegación
│   │   └── Toast/        # Sistema de notificaciones
│   ├── pages/            # Páginas de la aplicación
│   │   ├── Dashboard.tsx
│   │   ├── Orders.tsx
│   │   ├── Products.tsx
│   │   ├── Categories.tsx
│   │   ├── DeliveryPersons.tsx
│   │   └── Settings.tsx
│   ├── types/            # Tipos TypeScript
│   ├── App.tsx           # Componente principal con rutas
│   ├── main.tsx          # Punto de entrada
│   └── index.css         # Estilos globales
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🔧 Configuración

### Proxy API

El frontend está configurado para hacer proxy de las peticiones al backend en `localhost:5000`. Ver `vite.config.ts`:

```typescript
server: {
  port: 3000,
  proxy: {
    '/api': 'http://localhost:5000',
    '/admin/api': 'http://localhost:5000',
    '/images': 'http://localhost:5000',
  },
}
```

## 🎨 Características

- ✅ Dashboard con estadísticas
- ✅ Gestión de pedidos (CRUD)
- ✅ Gestión de productos con subida de imágenes
- ✅ Gestión de categorías con selector de iconos
- ✅ Gestión de repartidores
- ✅ Diseño responsive
- ✅ Notificaciones toast
- ✅ Modales de confirmación
- ✅ Estados de carga

## 📱 Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin` | Dashboard principal |
| `/admin/orders` | Gestión de pedidos |
| `/admin/products` | Gestión de productos |
| `/admin/categories` | Gestión de categorías |
| `/admin/delivery-persons` | Gestión de repartidores |
| `/admin/settings` | Configuración |

## 🔗 Conexión con Backend

El frontend consume la API REST del backend C#. Asegúrate de que el backend esté corriendo en `http://localhost:5000` antes de iniciar el frontend.

```bash
# En el directorio del backend
cd backend-csharp/cornerapp.api
dotnet run
```

Luego inicia el frontend:

```bash
# En el directorio del frontend
cd frontend
npm run dev
```

Abre `http://localhost:3000` en tu navegador.


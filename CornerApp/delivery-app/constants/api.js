/**
 * Constantes de configuración de la API
 */

// URL base de la API
export const API_BASE_URL = __DEV__
  ? 'http://localhost:5000' // Desarrollo local
  : 'https://tu-api-produccion.com'; // Producción

// Endpoints de la API
export const API_ENDPOINTS = {
  // Autenticación
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE: '/api/auth/profile',
  },
  
  // Productos
  PRODUCTS: {
    LIST: '/api/products',
    BY_ID: (id) => `/api/products/${id}`,
    BY_CATEGORY: (category) => `/api/products?category=${category}`,
  },
  
  // Categorías
  CATEGORIES: {
    LIST: '/api/categories',
    BY_ID: (id) => `/api/categories/${id}`,
  },
  
  // Pedidos
  ORDERS: {
    CREATE: '/api/orders',
    LIST: '/api/orders',
    BY_ID: (id) => `/api/orders/${id}`,
    UPDATE_STATUS: (id) => `/api/orders/${id}/status`,
    TRACKING: (id) => `/api/orders/${id}/tracking`,
  },
  
  // Clientes
  CUSTOMERS: {
    PROFILE: '/api/customers/profile',
    UPDATE: '/api/customers/profile',
  },
  
  // Puntos
  POINTS: {
    BALANCE: '/api/points/balance',
    HISTORY: '/api/points/history',
    REDEEM: '/api/points/redeem',
  },
  
  // Repartidores
  DELIVERY: {
    ORDERS: '/api/delivery/orders',
    ORDER_DETAIL: (id) => `/api/delivery/orders/${id}`,
    UPDATE_LOCATION: '/api/delivery/location',
    UPDATE_ORDER_STATUS: (id) => `/api/delivery/orders/${id}/status`,
  },
};

// Timeouts
export const API_TIMEOUT = 30000; // 30 segundos

// Headers por defecto
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

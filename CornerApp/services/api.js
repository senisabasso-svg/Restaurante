import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { secureStorage } from './secureStorage';

// Control para evitar spam de warnings
let lastWarningTime = 0;
const WARNING_THROTTLE_MS = 30000; // Solo mostrar warning cada 30 segundos

// Datos falsos de productos
const mockProducts = [
  // Pizzas (5)
  {
    id: 1,
    name: 'Pizza Margarita',
    category: 'pizza',
    description: 'Deliciosa pizza con salsa de tomate, mozzarella fresca y albahaca',
    price: 12.99,
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400',
  },
  {
    id: 2,
    name: 'Pizza Pepperoni',
    category: 'pizza',
    description: 'Clásica pizza con pepperoni, mozzarella y salsa de tomate',
    price: 14.99,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400',
  },
  {
    id: 3,
    name: 'Pizza Hawaiana',
    category: 'pizza',
    description: 'Pizza tropical con jamón, piña y mozzarella',
    price: 15.99,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400',
  },
  {
    id: 4,
    name: 'Pizza Cuatro Quesos',
    category: 'pizza',
    description: 'Pizza gourmet con mozzarella, gorgonzola, parmesano y fontina',
    price: 16.99,
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400',
  },
  {
    id: 5,
    name: 'Pizza Vegetariana',
    category: 'pizza',
    description: 'Pizza saludable con pimientos, champiñones, cebolla y aceitunas',
    price: 13.99,
    image: 'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400',
  },
  // Bebidas (3)
  {
    id: 6,
    name: 'Coca Cola',
    category: 'bebida',
    description: 'Refresco de cola 500ml',
    price: 2.50,
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',
  },
  {
    id: 7,
    name: 'Agua Mineral',
    category: 'bebida',
    description: 'Agua mineral natural 500ml',
    price: 1.50,
    image: 'https://images.unsplash.com/photo-1548839140-5a176c94e9ff?w=400',
  },
  {
    id: 8,
    name: 'Jugo de Naranja',
    category: 'bebida',
    description: 'Jugo de naranja natural 350ml',
    price: 3.00,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400',
  },
  // Postres (2)
  {
    id: 9,
    name: 'Tiramisú',
    category: 'postre',
    description: 'Delicioso postre italiano con café y cacao',
    price: 5.99,
    image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400',
  },
  {
    id: 10,
    name: 'Brownie con Helado',
    category: 'postre',
    description: 'Brownie caliente con helado de vainilla',
    price: 6.99,
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400',
  },
];

// IMPORTANTE: Cambia esta URL por la URL de tu backend
// Para desarrollo local:
// - Emulador Android: 'http://10.0.2.2:5000'
// - Emulador iOS: 'http://localhost:5000'
// - Dispositivo físico: 'http://TU_IP_LOCAL:5000' (ej: http://192.168.1.100:5000)
// Para producción: 'https://tu-backend.com'

// Configuración para Expo
// IMPORTANTE: La IP se detecta automáticamente desde el servidor de desarrollo de Expo
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Función para detectar automáticamente la IP local desde el servidor de desarrollo de Expo
const detectLocalIP = () => {
  try {
    // Intentar obtener la IP desde la configuración de Expo (la más confiable en desarrollo)
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        console.log('🔍 IP detectada automáticamente via Expo:', ip);
        return ip;
      }
    }

    // Método 2: Intentar obtener desde las variables de entorno de Expo
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const expoDevServer = process.env.EXPO_PUBLIC_DEV_SERVER_URL || 
                           process.env.REACT_NATIVE_PACKAGER_HOSTNAME;
      
      if (expoDevServer) {
        const match = expoDevServer.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (match && match[1]) {
          console.log('🔍 IP detectada desde dev server:', match[1]);
          return match[1];
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ Error detectando IP automática:', error);
  }

  return null;
};

// Función para obtener la IP (con caché en AsyncStorage)
let cachedIP = null;
const getLocalIP = async () => {
  // Ya no forzamos la IP manualmente, dejamos que la detección automática trabaje
  // pero mantendremos una por defecto solo como último recurso extremo.
  const DEFAULT_IP = '192.168.1.36'; 

  // Si ya tenemos la IP en caché, usarla
  if (cachedIP) {
    return cachedIP;
  }

  // Intentar obtener de AsyncStorage (última IP que funcionó)
  try {
    const savedIP = await AsyncStorage.getItem('@CornerApp:localIP');
    if (savedIP) {
      cachedIP = savedIP;
      console.log('💾 IP recuperada de caché:', savedIP);
      return savedIP;
    }
  } catch (error) {
    // Ignorar errores de AsyncStorage
  }

  // Intentar detectar automáticamente
  const detectedIP = detectLocalIP();
  if (detectedIP) {
    cachedIP = detectedIP;
    // Guardar en AsyncStorage para la próxima vez
    try {
      await AsyncStorage.setItem('@CornerApp:localIP', detectedIP);
    } catch (error) {
      // Ignorar errores de AsyncStorage
    }
    return detectedIP;
  }

  // Si no se pudo detectar, usar IP por defecto
  const defaultIP = '192.168.1.36';
  console.log('⚠️ No se pudo detectar la IP automáticamente, usando IP por defecto:', defaultIP);
  console.log('💡 Para actualizar la IP automáticamente, asegúrate de que Expo esté mostrando la IP en la consola');
  return defaultIP;
};

const getBaseUrl = async () => {
  if (__DEV__) {
    // Android Emulator (Expo/Android Studio)
    if (Platform.OS === 'android' && Platform.isTV === false) {
      // Para emulador Android, usa 10.0.2.2
      // Para Expo Go en dispositivo Android físico, detecta la IP automáticamente
      // return 'http://10.0.2.2:5000'; // Descomenta para emulador
      const ip = await getLocalIP();
      return `http://${ip}:5000`;
    }
    
    // iOS Simulator o Expo Go iOS
    if (Platform.OS === 'ios') {
      // Para iOS Simulator, localhost funciona
      // Para Expo Go en dispositivo iOS físico, detecta la IP automáticamente
      // return 'http://localhost:5000'; // Descomenta para simulador
      const ip = await getLocalIP();
      return `http://${ip}:5000`;
    }
    
    // Fallback: Detectar IP automáticamente
    const ip = await getLocalIP();
    return `http://${ip}:5000`;
  }
  return 'https://tu-backend.com'; // Producción
};

// Inicializar API_BASE_URL de forma asíncrona
let API_BASE_URL = 'http://192.168.1.36:5000'; // Valor por defecto

// Crear cliente axios (se actualizará cuando se detecte la IP)
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inicializar la URL base
getBaseUrl().then(url => {
  API_BASE_URL = url;
  console.log('🌐 URL base del backend configurada:', API_BASE_URL);
  // Actualizar el cliente axios con la nueva URL
  apiClient.defaults.baseURL = API_BASE_URL;
}).catch(error => {
  console.warn('⚠️ Error al detectar IP, usando IP por defecto:', error);
});

// Interceptor para agregar token de autenticación
apiClient.interceptors.request.use(
  async (config) => {
    const token = await secureStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNREFUSED' || error.message.includes('Network Error') || error.message?.includes('timeout')) {
      // Solo mostrar warning cada 30 segundos para evitar spam
      const now = Date.now();
      if ((now - lastWarningTime) > WARNING_THROTTLE_MS) {
        console.warn('⚠️ Backend no disponible, usando datos simulados');
        console.warn('💡 Verifica que el backend esté corriendo en:', API_BASE_URL);
        console.warn('🔧 Asegúrate de que:');
        console.warn('   1. El backend esté ejecutándose (dotnet run)');
        console.warn('   2. Tu dispositivo y PC estén en la misma red WiFi');
        console.warn('   3. El firewall permita conexiones al puerto 5000');
        lastWarningTime = now;
      }
      // Fallback a datos simulados si el backend no está disponible
      return Promise.reject(new Error('BACKEND_UNAVAILABLE'));
    }
    return Promise.reject(error);
  }
);

// Obtener categorías del backend real
// Obtener estado del negocio (horarios, si está abierto, etc.)
export const getBusinessStatus = async () => {
  try {
    const response = await apiClient.get('/api/orders/business-status');
    return response.data;
  } catch (error) {
    console.error('Error getting business status:', error);
    // Si falla, asumir que está abierto para no bloquear la app
    return { isOpen: true, isWithinHours: true, message: '¡Bienvenido!' };
  }
};

// Obtener métodos de pago activos
export const getPaymentMethods = async () => {
  try {
    const response = await apiClient.get('/api/orders/payment-methods');
    return response.data;
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return [];
  }
};

export const getCategories = async () => {
  try {
    console.log('🔌 Obteniendo categorías del backend en:', API_BASE_URL);
    const response = await apiClient.get('/api/categories');
    console.log('✅ Categorías recibidas del backend:', response.data.length);
    return {
      data: response.data,
    };
  } catch (error) {
    // Si el backend no está disponible, usar categorías por defecto
    if (error.message === 'BACKEND_UNAVAILABLE' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      console.warn('⚠️ Backend no disponible, usando categorías por defecto');
      return {
        data: [
          { id: 1, name: 'pizza', description: 'Pizzas', icon: 'pizza', displayOrder: 1, isActive: true },
          { id: 2, name: 'bebida', description: 'Bebidas', icon: 'water', displayOrder: 2, isActive: true },
          { id: 3, name: 'postre', description: 'Postres', icon: 'ice-cream', displayOrder: 3, isActive: true },
        ],
      };
    }
    console.error('❌ Error obteniendo categorías:', error.message);
    throw error;
  }
};

// Obtener productos del backend real
export const getProducts = async () => {
  try {
    console.log('🔌 Conectando al backend en:', API_BASE_URL);
    const response = await apiClient.get('/api/products');
    console.log('✅ Productos recibidos del backend:', response.data.length);
    
    // Normalizar estructura del backend (Category object -> category string)
    const normalizedData = response.data.map(product => ({
      ...product,
      category: product.Category?.name || product.category || '', // Convertir Category object a string
    }));
    
    console.log('📦 Productos normalizados:', normalizedData.length);
    return {
      data: normalizedData,
    };
  } catch (error) {
    // Si el backend no está disponible, usar datos simulados como fallback
    if (error.message === 'BACKEND_UNAVAILABLE' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      // El warning ya se mostró en el interceptor, no repetir aquí
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        data: mockProducts,
      };
    }
    // Solo loguear errores que no sean de conexión
    console.error('❌ Error conectando al backend:', error.message);
    throw error;
  }
};

// Crear un pedido en el backend
export const createOrder = async (orderData) => {
  try {
    // Usar PascalCase para coincidir con el DTO de C#
    const requestData = {
      CustomerName: orderData.name,
      PaymentMethod: orderData.paymentMethod || 'cash',
      Items: orderData.items.map(item => ({
        Id: item.id,
        Name: item.name,
        Price: parseFloat(item.price) || 0, // Asegurar que sea un número
        Quantity: parseInt(item.quantity) || 1, // Asegurar que sea un entero
      })),
    };

    // Solo agregar campos opcionales si tienen valor (para evitar errores de validación)
    if (orderData.phone && orderData.phone.trim().length > 0) {
      requestData.CustomerPhone = orderData.phone.trim();
    }
    
    if (orderData.address && orderData.address.trim().length > 0) {
      requestData.CustomerAddress = orderData.address.trim();
    }
    
    if (orderData.email && orderData.email.trim().length > 0) {
      requestData.CustomerEmail = orderData.email.trim();
    }
    
    if (orderData.comments && orderData.comments.trim().length > 0) {
      requestData.Comments = orderData.comments.trim();
    }

    // Agregar coordenadas GPS del cliente si están disponibles
    if (orderData.customerLatitude && orderData.customerLongitude) {
      requestData.CustomerLatitude = orderData.customerLatitude;
      requestData.CustomerLongitude = orderData.customerLongitude;
      console.log('📍 Enviando coordenadas GPS al backend:', {
        latitude: requestData.CustomerLatitude,
        longitude: requestData.CustomerLongitude,
      });
    }

    // Agregar comprobante si existe (para transferencia)
    if (orderData.receiptImage) {
      requestData.ReceiptImage = orderData.receiptImage;
    }

    console.log('📤 Creando pedido con datos:', {
      CustomerName: requestData.CustomerName,
      CustomerPhone: requestData.CustomerPhone,
      CustomerAddress: requestData.CustomerAddress,
      Items: requestData.Items.length,
      PaymentMethod: requestData.PaymentMethod,
    });

    const response = await apiClient.post('/api/orders', requestData);
    console.log('✅ Pedido creado exitosamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error creating order:', error);
    console.error('❌ Detalles del error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    
    // Si es un error de validación, extraer los errores específicos
    if (error.response?.status === 400 && error.response?.data?.validationErrors) {
      const validationErrors = error.response.data.validationErrors;
      console.error('❌ Errores de validación:', validationErrors);
      
      // Construir mensaje con todos los errores de validación
      let errorMessage = 'Error de validación:\n';
      if (Array.isArray(validationErrors)) {
        validationErrors.forEach((err, index) => {
          if (err.field && err.message) {
            errorMessage += `${index + 1}. ${err.field}: ${err.message}\n`;
          } else if (typeof err === 'string') {
            errorMessage += `${index + 1}. ${err}\n`;
          }
        });
      } else if (typeof validationErrors === 'object') {
        Object.keys(validationErrors).forEach(key => {
          errorMessage += `${key}: ${validationErrors[key]}\n`;
        });
      }
      
      const backendError = new Error(errorMessage.trim() || error.response.data.message || 'Datos inválidos');
      backendError.status = 400;
      backendError.validationErrors = validationErrors;
      throw backendError;
    }
    
    // Extraer mensaje de error del backend si está disponible
    if (error.response?.data?.error || error.response?.data?.message) {
      const errorMsg = error.response.data.error || error.response.data.message;
      const backendError = new Error(errorMsg);
      backendError.status = error.response.status;
      throw backendError;
    }
    
    // Si es un error 400 genérico
    if (error.response?.status === 400) {
      const validationError = 'Datos inválidos. Por favor, verifica la información del pedido.';
      const backendError = new Error(validationError);
      backendError.status = 400;
      throw backendError;
    }
    
    throw error;
  }
};

// Obtener un pedido por ID
export const getOrder = async (orderId) => {
  try {
    const response = await apiClient.get(`/api/orders/${orderId}`);
    return response.data;
  } catch (error) {
    // Si es un 404, el pedido no existe (probablemente eliminado o archivado)
    // Esto es un comportamiento esperado, no un error crítico
    if (error.response?.status === 404) {
      console.log(`ℹ️ Pedido ${orderId} no encontrado (probablemente eliminado o archivado)`);
    } else {
      // Otros errores son críticos (servidor, red, etc.)
      console.error('Error getting order:', error);
    }
    throw error;
  }
};

// Obtener pedidos del usuario autenticado
export const getMyOrders = async () => {
  try {
    const response = await apiClient.get('/api/orders/my-orders');
    return response.data;
  } catch (error) {
    console.error('Error getting my orders:', error);
    throw error;
  }
};

// Eliminar un pedido
export const deleteOrder = async (orderId) => {
  try {
    const response = await apiClient.delete(`/api/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting order:', error);
    throw error;
  }
};

// Cancelar un pedido (solo si está pendiente)
export const cancelOrder = async (orderId) => {
  try {
    const response = await apiClient.patch(`/api/orders/${orderId}/status`, {
      status: 'cancelled',
      note: 'Cancelado por el cliente desde la aplicación móvil'
    });
    return response.data;
  } catch (error) {
    console.error('Error cancelling order:', error);
    throw error;
  }
};

// Actualizar ubicación del repartidor (para admin/repartidor)
export const updateDeliveryLocation = async (orderId, latitude, longitude) => {
  try {
    const response = await apiClient.patch(`/api/orders/${orderId}/delivery-location`, {
      latitude,
      longitude,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating delivery location:', error);
    throw error;
  }
};

// Actualizar ubicación del cliente (para calcular ruta)
export const updateCustomerLocation = async (orderId, latitude, longitude) => {
  try {
    const response = await apiClient.patch(`/api/orders/${orderId}/customer-location`, {
      latitude,
      longitude,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating customer location:', error);
    throw error;
  }
};

// ========== Servicios para Repartidores ==========

// Obtener pedidos asignados al repartidor autenticado
export const getDeliveryPersonOrders = async () => {
  try {
    const response = await apiClient.get('/api/DeliveryPerson/orders');
    return response.data;
  } catch (error) {
    console.error('Error getting delivery person orders:', error);
    throw error;
  }
};

// Obtener un pedido específico asignado al repartidor
export const getDeliveryPersonOrder = async (orderId) => {
  try {
    const response = await apiClient.get(`/api/DeliveryPerson/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting delivery person order:', error);
    throw error;
  }
};

// Actualizar ubicación del repartidor para un pedido
export const updateDeliveryPersonLocation = async (orderId, latitude, longitude) => {
  try {
    const response = await apiClient.patch(`/api/DeliveryPerson/orders/${orderId}/location`, {
      latitude,
      longitude,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating delivery person location:', error);
    throw error;
  }
};

// Actualizar estado del pedido (solo delivering o completed)
export const updateDeliveryOrderStatus = async (orderId, status) => {
  try {
    const response = await apiClient.patch(`/api/DeliveryPerson/orders/${orderId}/status`, {
      status,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating delivery order status:', error);
    throw error;
  }
};

// Eliminar un pedido completado (solo para repartidores)
export const deleteDeliveryOrder = async (orderId) => {
  try {
    const response = await apiClient.delete(`/api/DeliveryPerson/orders/${orderId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting delivery order:', error);
    throw error;
  }
};

export default apiClient;

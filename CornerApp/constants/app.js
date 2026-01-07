/**
 * Constantes de la aplicación
 */

// Configuración de la app
export const APP_CONFIG = {
  NAME: 'CornerApp',
  VERSION: '1.0.0',
};

// Estados de pedidos
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PREPARING: 'preparing',
  DELIVERING: 'delivering',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Nombres de estados en español
export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pendiente',
  [ORDER_STATUS.CONFIRMED]: 'Confirmado',
  [ORDER_STATUS.PREPARING]: 'En Preparación',
  [ORDER_STATUS.DELIVERING]: 'En Camino',
  [ORDER_STATUS.COMPLETED]: 'Completado',
  [ORDER_STATUS.CANCELLED]: 'Cancelado',
};

// Métodos de pago
export const PAYMENT_METHODS = {
  CASH: 'cash',
  POS: 'pos',
  TRANSFER: 'transfer',
};

// Nombres de métodos de pago en español
export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.CASH]: 'Efectivo',
  [PAYMENT_METHODS.POS]: 'POS a Domicilio',
  [PAYMENT_METHODS.TRANSFER]: 'Transferencia',
};

// Configuración de ubicación
export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 5000, // 5 segundos
  ACCURACY: 6, // High accuracy
  MAX_AGE: 10000, // 10 segundos
};

// Configuración de notificaciones
export const NOTIFICATION_CONFIG = {
  TOAST_DURATION: 3000, // 3 segundos
};

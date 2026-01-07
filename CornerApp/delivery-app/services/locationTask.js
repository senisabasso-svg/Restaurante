import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './api';

const LOCATION_TASK_NAME = 'background-location-task';

// Definir la tarea de ubicación en segundo plano
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Error en tarea de ubicación en segundo plano:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    if (location) {
      try {
        // Obtener el orderId del almacenamiento
        const activeOrderId = await AsyncStorage.getItem('@CornerApp:activeDeliveryOrderId');
        
        if (activeOrderId) {
          // Actualizar ubicación en el servidor
          await apiClient.patch(`/api/DeliveryPerson/orders/${activeOrderId}/location`, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          console.log('Ubicación actualizada en segundo plano para pedido:', activeOrderId);
        }
      } catch (error) {
        // Solo loguear errores que no sean de autenticación para evitar spam
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          console.error('Error actualizando ubicación en segundo plano:', error.response?.status, error.response?.data?.error || error.message);
        } else {
          console.warn('Error de autenticación al actualizar ubicación. El token puede haber expirado.');
        }
      }
    }
  }
});

export { LOCATION_TASK_NAME };


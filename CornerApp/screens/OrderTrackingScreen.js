import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getOrder, deleteOrder, updateCustomerLocation, cancelOrder } from '../services/api';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

const OrderTrackingScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { orderId } = route.params || {};

  console.log('🚀 OrderTrackingScreen - Params recibidos:', route.params);
  console.log('🚀 OrderTrackingScreen - orderId:', orderId);
  console.log('🚀 OrderTrackingScreen - colors:', colors);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const fadeAnim = new Animated.Value(0);

  // Mostrar siempre algo, incluso si hay error
  if (!orderId) {
    console.error('❌ No hay orderId en route.params');
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#000000', marginBottom: 10 }}>
          ⚠️ Error
        </Text>
        <Text style={{ fontSize: 16, color: '#666666', textAlign: 'center', marginBottom: 20 }}>
          No se recibió el ID del pedido
        </Text>
        <Text style={{ fontSize: 14, color: '#999999', textAlign: 'center', marginBottom: 20 }}>
          Params: {JSON.stringify(route.params || {})}
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#ea580c', padding: 12, paddingHorizontal: 24, borderRadius: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  useEffect(() => {
    console.log('🎯 OrderTrackingScreen montado, orderId:', orderId);
    console.log('🎯 Colors del tema:', colors);
    
    if (orderId) {
      console.log('✅ OrderId válido, cargando pedido...');
      loadOrder();
      requestLocationPermission();
      // Auto-refresh cada 15 segundos
      const interval = setInterval(() => {
        loadOrder(true);
      }, 15000);
      return () => clearInterval(interval);
    } else {
      console.error('❌ No se proporcionó orderId');
      setError('No se proporcionó un ID de pedido');
      setLoading(false);
    }

    // Animación de entrada (después de cargar el pedido)
    if (order) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [orderId]);

  // Obtener ubicación del usuario cuando el pedido está en camino
  useEffect(() => {
    if (order && (order.status === 'delivering' || order.status === 'preparing') && locationPermission) {
      getCurrentLocation();
      // Actualizar ubicación cada 30 segundos si el pedido está en camino
      const locationInterval = setInterval(() => {
        if (order.status === 'delivering') {
          getCurrentLocation();
        }
      }, 30000);
      return () => clearInterval(locationInterval);
    }
  }, [order, locationPermission]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        setLocationPermission(false);
        console.log('Permiso de ubicación denegado');
      }
    } catch (error) {
      console.error('Error solicitando permiso de ubicación:', error);
      setLocationPermission(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Máxima precisión para forzar GPS
        timeout: 30000, // 30 segundos para dar tiempo al GPS
        maximumAge: 0, // No usar caché, obtener siempre la ubicación más reciente
      });
      
      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      const accuracy = location.coords.accuracy;
      
      console.log('📍 Ubicación obtenida:', { 
        latitude, 
        longitude, 
        accuracy: accuracy ? accuracy.toFixed(0) + ' metros' : 'desconocida',
        source: accuracy && accuracy < 100 ? 'GPS' : accuracy && accuracy > 500 ? 'Red/WiFi' : 'Desconocido'
      });
      
      // Rechazar ubicaciones con baja precisión (> 500m) - probablemente red/WiFi
      if (accuracy && accuracy > 500) {
        console.warn('⚠️ Precisión muy baja (' + accuracy.toFixed(0) + 'm). Probablemente ubicación basada en red/WiFi, no GPS.');
        console.warn('📍 Esta ubicación será rechazada. Se necesita GPS activo.');
        console.warn('💡 SOLUCIÓN:');
        console.warn('   1. Ve a Configuración > Ubicación en tu celular');
        console.warn('   2. Activa "Alta precisión" (GPS + Wi‑Fi + Redes)');
        console.warn('   3. Desactiva "Ahorro de batería"');
        console.warn('   4. Sal al aire libre');
        console.warn('   5. Espera 10-15 segundos');
        // No actualizar la ubicación si la precisión es baja
        return;
      }
      
      // Validar que las coordenadas estén dentro de Salto, Uruguay
      const isWithinSalto = latitude >= -31.8 && latitude <= -31.0 && 
                            longitude >= -58.3 && longitude <= -57.5;
      
      if (!isWithinSalto) {
        // Detectar ciudad basada en coordenadas
        let detectedCity = 'Ubicación desconocida';
        if (latitude < -34 && longitude > -56.5) {
          detectedCity = 'Montevideo/Las Piedras';
        } else if (latitude < -34) {
          detectedCity = 'Montevideo';
        }
        
        console.warn('⚠️ Coordenadas fuera de Salto, Uruguay:', latitude.toFixed(6), longitude.toFixed(6));
        console.warn('📍 Estas coordenadas corresponden a:', detectedCity);
        console.warn('💡 SOLUCIÓN:');
        console.warn('   1. Ve a Configuración > Ubicación en tu celular');
        console.warn('   2. Activa "Alta precisión" (GPS + Wi‑Fi + Redes)');
        console.warn('   3. Desactiva "Ahorro de batería"');
        console.warn('   4. Sal al aire libre');
        console.warn('   5. Espera 10-15 segundos');
        // No actualizar la ubicación si está fuera de Salto
        return;
      }
      
      setUserLocation({
        latitude,
        longitude,
      });
      
      console.log('✅ Coordenadas validadas dentro de Salto, Uruguay (GPS activo)');
      
      // Enviar ubicación al backend si el pedido está en camino
      if (order && (order.status === 'delivering' || order.status === 'preparing')) {
        try {
          await updateCustomerLocation(orderId, location.coords.latitude, location.coords.longitude);
        } catch (error) {
          console.error('Error actualizando ubicación en backend:', error);
        }
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
    }
  };

  // Calcular distancia entre dos puntos (fórmula de Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distancia en km
  };

  // Calcular tiempo estimado basado en distancia
  // Si el pedido está en camino, solo calcular tiempo de viaje (sin preparación)
  // Si está en preparación, incluir tiempo base de preparación
  const calculateEstimatedTime = (distanceKm, orderStatus) => {
    const averageSpeedKmh = 30;
    const timeInHours = distanceKm / averageSpeedKmh;
    const travelTimeMinutes = Math.ceil(timeInHours * 60);
    
    // Si el pedido ya está en camino, solo calcular tiempo de viaje (sin preparación)
    if (orderStatus === 'delivering') {
      // Tiempo mínimo de 5 minutos, máximo de 60 minutos para entregas en curso
      return Math.max(5, Math.min(60, travelTimeMinutes));
    }
    
    // Si está en preparación, incluir tiempo base de preparación (igual que el backend)
    const baseTimeMinutes = 10; // Tiempo base de preparación
    const totalTime = baseTimeMinutes + travelTimeMinutes;
    // Limitar entre 15 y 120 minutos (igual que el backend)
    return Math.max(15, Math.min(120, totalTime));
  };

  const loadOrder = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      console.log('🔍 Cargando pedido ID:', orderId);
      const orderData = await getOrder(orderId);
      console.log('✅ Pedido cargado:', orderData);
      
      if (!orderData) {
        throw new Error('El pedido no existe');
      }
      
      setOrder(orderData);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error('❌ Error loading order:', err);
      console.error('Error details:', err.message, err.response?.data);
      
      // Si es un 404 (pedido no encontrado), limpiar de AsyncStorage
      if (err.response?.status === 404 || err.message?.includes('404') || err.message?.includes('no encontrado')) {
        console.log('ℹ️ Pedido no existe (404), limpiando de AsyncStorage...');
        try {
          const normalizedOrderId = typeof orderId === 'number' ? orderId : parseInt(orderId);
          
          // Eliminar de savedOrderIds
          const savedOrderIds = await AsyncStorage.getItem('savedOrderIds');
          if (savedOrderIds) {
            let orderIds = JSON.parse(savedOrderIds);
            orderIds = orderIds.map(id => typeof id === 'number' ? id : parseInt(id));
            const filteredIds = orderIds.filter(id => id !== normalizedOrderId);
            await AsyncStorage.setItem('savedOrderIds', JSON.stringify(filteredIds));
            console.log('🧹 Pedido removido de savedOrderIds');
          }
          
          // Si es el último pedido, limpiar también
          const lastOrderId = await AsyncStorage.getItem('lastOrderId');
          if (lastOrderId && parseInt(lastOrderId) === normalizedOrderId) {
            await AsyncStorage.removeItem('lastOrderId');
            console.log('🧹 Pedido removido de lastOrderId');
          }
        } catch (storageErr) {
          console.error('Error limpiando AsyncStorage:', storageErr);
        }
        
        setError('Pedido no encontrado. Este pedido ha sido eliminado o ya no está disponible.');
      } else {
        setError(`No se pudo cargar el pedido: ${err.message || 'Error desconocido'}`);
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrder(true);
  };

  const handleDeleteOrder = () => {
    Alert.alert(
      'Eliminar Pedido',
      `¿Estás seguro de que deseas eliminar el pedido #${orderId} de tu lista?\n\nEste pedido solo se eliminará de tu dispositivo. El pedido permanecerá en el historial del restaurante.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const normalizedOrderId = typeof orderId === 'number' ? orderId : parseInt(orderId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              
              // NO llamar al backend - solo eliminar de AsyncStorage del cliente
              // Esto mantiene el historial completo en el dashboard
              try {
                const savedOrderIds = await AsyncStorage.getItem('savedOrderIds');
                if (savedOrderIds) {
                  const orderIds = JSON.parse(savedOrderIds);
                  const filteredIds = orderIds
                    .map(id => typeof id === 'number' ? id : parseInt(id))
                    .filter(id => id !== normalizedOrderId);
                  await AsyncStorage.setItem('savedOrderIds', JSON.stringify(filteredIds));
                  console.log(`🗑️ Pedido ${normalizedOrderId} removido de AsyncStorage (solo del dispositivo)`);
                }
                
                // Si es el último pedido, limpiar también
                const lastOrderId = await AsyncStorage.getItem('lastOrderId');
                if (lastOrderId && parseInt(lastOrderId) === normalizedOrderId) {
                  await AsyncStorage.removeItem('lastOrderId');
                }
              } catch (err) {
                console.error('Error removing order from storage:', err);
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Pedido Eliminado', 'El pedido ha sido eliminado de tu lista de pedidos.', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('Error deleting order:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'No se pudo eliminar el pedido. Intenta nuevamente.');
            }
          },
        },
      ]
    );
  };

  const handleCancelOrder = () => {
    Alert.alert(
      'Cancelar Pedido',
      '¿Estás seguro de que deseas cancelar este pedido?',
      [
        {
          text: 'No, mantener pedido',
          style: 'cancel',
        },
        {
          text: 'Sí, cancelar pedido',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsCancelling(true);
              await cancelOrder(orderId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Pedido Cancelado', 'Tu pedido ha sido cancelado exitosamente.');
              loadOrder(true); // Recargar datos
            } catch (error) {
              console.error('Error al cancelar pedido:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'No se pudo cancelar el pedido. Por favor, intenta de nuevo o contacta al restaurante.');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };


  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return {
          name: 'Pendiente',
          icon: 'time-outline',
          color: '#ffd700',
          description: 'Tu pedido está esperando confirmación',
          step: 1,
        };
      case 'confirmed':
        return {
          name: 'Confirmado',
          icon: 'checkmark-circle-outline',
          color: '#4CAF50',
          description: 'Tu pedido ha sido confirmado',
          step: 2,
        };
      case 'preparing':
        return {
          name: 'En Preparación',
          icon: 'restaurant-outline',
          color: '#2196F3',
          description: 'Estamos preparando tu pedido',
          step: 3,
        };
      case 'delivering':
        return {
          name: 'En Camino',
          icon: 'car-outline',
          color: '#FF9800',
          description: 'Tu pedido está en camino',
          step: 4,
        };
      case 'completed':
        return {
          name: 'Completado',
          icon: 'checkmark-done-circle',
          color: '#9E9E9E',
          description: 'Tu pedido ha sido entregado',
          step: 5,
        };
      case 'cancelled':
        return {
          name: 'Cancelado',
          icon: 'close-circle',
          color: '#f44336',
          description: 'Tu pedido fue cancelado',
          step: 0,
        };
      default:
        return {
          name: status,
          icon: 'help-circle-outline',
          color: '#9E9E9E',
          description: 'Estado desconocido',
          step: 0,
        };
    }
  };

  const statusSteps = [
    { key: 'pending', name: 'Pendiente' },
    { key: 'confirmed', name: 'Confirmado' },
    { key: 'preparing', name: 'En Preparación' },
    { key: 'delivering', name: 'En Camino' },
    { key: 'completed', name: 'Completado' },
  ];

  // Asegurar que colors tenga valores por defecto
  const safeColors = {
    background: colors?.background || '#ffffff',
    cardBackground: colors?.cardBackground || '#ffffff',
    border: colors?.border || '#e0e0e0',
    text: colors?.text || '#000000',
    textSecondary: colors?.textSecondary || '#666666',
    primary: colors?.primary || '#ea580c',
  };

  const dynamicStyles = {
    container: { backgroundColor: safeColors.background },
    card: { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border },
    text: { color: safeColors.text },
    textSecondary: { color: safeColors.textSecondary },
  };

  if (loading && !order) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: safeColors.background }]}>
        <ActivityIndicator size="large" color={safeColors.primary} />
        <Text style={[styles.loadingText, { color: safeColors.textSecondary }]}>Cargando pedido...</Text>
      </View>
    );
  }

  if (error && !order) {
    return (
      <View style={[styles.container, { backgroundColor: safeColors.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border }]}>
          <Ionicons name="alert-circle" size={64} color="#f44336" />
          <Text style={[styles.errorText, { color: '#000000' }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: safeColors.primary }]}
            onPress={() => loadOrder()}
          >
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: safeColors.cardBackground, marginTop: 10, borderWidth: 1, borderColor: safeColors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.retryButtonText, { color: '#000000' }]}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.container, { backgroundColor: safeColors.background }]}>
        <View style={[styles.errorContainer, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border }]}>
          <Ionicons name="document-outline" size={64} color="#000000" />
          <Text style={[styles.errorText, { color: '#000000' }]}>No se encontró información del pedido</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: safeColors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusInfo = getStatusInfo(order.status || 'pending');
  
  console.log('📋 Renderizando pedido:', {
    id: order.id,
    status: order.status,
    itemsCount: order.items?.length || 0,
    total: order.total,
    order: JSON.stringify(order).substring(0, 200), // Primeros 200 chars para debug
  });

  console.log('🎨 safeColors:', safeColors);

  return (
    <View style={[styles.container, { backgroundColor: safeColors.background }]}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: safeColors.background }]}
        contentContainerStyle={{ paddingBottom: 20, backgroundColor: safeColors.background }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={safeColors.primary} />
        }
      >
        <Animated.View style={{ opacity: 1 }}>
          {/* Header con ID del pedido */}
          <View style={[styles.header, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border, borderWidth: 1 }]}>
            <View style={styles.headerTop}>
              <Ionicons name="receipt-outline" size={32} color="#000000" />
              <Text style={[styles.orderId, { color: '#000000' }]}>Pedido #{order.id || 'N/A'}</Text>
            </View>
            <Text style={[styles.orderDate, { color: '#4b5563' }]}>
              {order.createdAt ? new Date(order.createdAt).toLocaleString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) : 'Fecha no disponible'}
            </Text>
          </View>

          {/* Estado actual */}
          <View style={[styles.statusCard, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border, borderWidth: 1 }]}>
            <View style={styles.statusHeader}>
              <Ionicons name={statusInfo.icon} size={48} color={statusInfo.color} />
              <View style={styles.statusTextContainer}>
                <Text style={[styles.statusName, { color: statusInfo.color }]}>
                  {statusInfo.name}
                </Text>
                <Text style={[styles.statusDescription, { color: '#4b5563' }]}>
                  {statusInfo.description}
                </Text>
              </View>
            </View>

            {/* Timeline de estados */}
            <View style={styles.timeline}>
              {statusSteps.map((step, index) => {
                // Un paso está completado si:
                // 1. El estado actual es mayor que el índice del paso (pasos anteriores)
                // 2. El estado es "completed" (step 5) y este es el último paso
                const isCompleted = statusInfo.step > index + 1 || (statusInfo.step === 5 && index === 4);
                // Un paso está en progreso solo si es el actual Y no está completado (no aplica a "completed")
                const isCurrent = statusInfo.step === index + 1 && statusInfo.step !== 5;

                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={styles.timelineLine}>
                      {isCompleted ? (
                        <View style={[styles.timelineDot, styles.timelineDotCompleted]}>
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        </View>
                      ) : isCurrent ? (
                        <View style={[styles.timelineDot, { backgroundColor: statusInfo.color }]}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.timelineDot, styles.timelineDotPending, { 
                          backgroundColor: '#e0e0e0',
                          borderColor: '#bdbdbd'
                        }]} />
                      )}
                      {index < statusSteps.length - 1 && (
                        <View
                          style={[
                            styles.timelineLineConnector,
                            { backgroundColor: isCompleted ? '#4CAF50' : '#e0e0e0' },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.timelineLabel,
                        { color: '#4b5563' },
                        isCompleted && { color: '#4CAF50', fontWeight: 'bold' },
                        isCurrent && { color: statusInfo.color, fontWeight: 'bold' },
                      ]}
                    >
                      {step.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Información del pedido */}
          <View style={[styles.infoCard, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border }]}>
            <Text style={[styles.cardTitle, { color: '#000000' }]}>📦 Detalles del Pedido</Text>

            {order.items && order.items.length > 0 ? (
              order.items.map((item, index) => (
                <View key={index} style={[styles.orderItem, { borderBottomColor: safeColors.border }]}>
                  <View style={styles.orderItemLeft}>
                    <Text style={[styles.orderItemName, { color: '#000000' }]}>
                      {item.productName || `Producto ${index + 1}`}
                    </Text>
                    <Text style={[styles.orderItemQuantity, { color: '#4b5563' }]}>
                      Cantidad: {item.quantity || 1}
                    </Text>
                  </View>
                  <Text style={[styles.orderItemPrice, { color: '#000000' }]}>
                    ${(item.subtotal || (item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.emptyItemsText, { color: '#4b5563' }]}>
                No hay items en este pedido
              </Text>
            )}

            <View style={[styles.totalContainer, { borderTopColor: safeColors.primary }]}>
              <Text style={[styles.totalLabel, { color: '#000000' }]}>Total:</Text>
              <Text style={[styles.totalAmount, { color: '#000000' }]}>
                ${order.total?.toFixed(2) || '0.00'}
              </Text>
            </View>
          </View>

          {/* Mapa de seguimiento - Solo mostrar si el pedido está en preparación o en camino */}
          {(order.status === 'preparing' || order.status === 'delivering') && 
           (order.deliveryLatitude && order.deliveryLongitude || userLocation) && (
            <View style={[styles.infoCard, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border }]}>
              <Text style={[styles.cardTitle, { color: '#000000' }]}>🗺️ Seguimiento en Tiempo Real</Text>
              
              {order.deliveryLatitude && order.deliveryLongitude && userLocation && (
                <View style={[styles.distanceInfo, { backgroundColor: safeColors.background }]}>
                  <Ionicons name="navigate" size={20} color={safeColors.primary} />
                  <Text style={[styles.distanceText, { color: safeColors.text }]}>
                    {(() => {
                      const distance = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        order.deliveryLatitude,
                        order.deliveryLongitude
                      );
                      // Si está en camino, calcular tiempo dinámico basado en distancia actual
                      // Si está en preparación, usar el tiempo del backend (incluye preparación)
                      let estimatedTime;
                      if (order.status === 'delivering') {
                        // Tiempo dinámico basado en distancia actual (solo viaje, sin preparación)
                        estimatedTime = calculateEstimatedTime(distance, 'delivering');
                      } else {
                        // Usar tiempo del backend que incluye preparación
                        estimatedTime = order.estimatedDeliveryMinutes || calculateEstimatedTime(distance, 'preparing');
                      }
                      return `Distancia: ${distance.toFixed(2)} km • Tiempo estimado: ${estimatedTime} min`;
                    })()}
                  </Text>
                </View>
              )}

              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    // Prioridad: coordenadas del repartidor > cliente (del pedido) > ubicación actual del usuario > Salto, Uruguay
                    latitude: order.deliveryLatitude || order.customerLatitude || userLocation?.latitude || -31.3833,
                    longitude: order.deliveryLongitude || order.customerLongitude || userLocation?.longitude || -57.9667,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  region={{
                    // Prioridad: coordenadas del repartidor > cliente (del pedido) > ubicación actual del usuario > Salto, Uruguay
                    latitude: order.deliveryLatitude || order.customerLatitude || userLocation?.latitude || -31.3833,
                    longitude: order.deliveryLongitude || order.customerLongitude || userLocation?.longitude || -57.9667,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                >
                  {/* Marcador del repartidor */}
                  {order.deliveryLatitude && order.deliveryLongitude && (
                    <Marker
                      coordinate={{
                        latitude: order.deliveryLatitude,
                        longitude: order.deliveryLongitude,
                      }}
                      title="Repartidor"
                      description="Ubicación del repartidor"
                    >
                      <View style={styles.deliveryMarker}>
                        <Ionicons name="bicycle" size={24} color="#fff" />
                      </View>
                    </Marker>
                  )}

                  {/* Marcador del cliente (usar coordenadas del pedido o ubicación actual) */}
                  {(order.customerLatitude && order.customerLongitude) || userLocation ? (
                    <Marker
                      coordinate={{
                        latitude: order.customerLatitude || userLocation.latitude,
                        longitude: order.customerLongitude || userLocation.longitude,
                      }}
                      title="Tu ubicación"
                      description={order.customerLatitude ? "Dirección de entrega" : "Tu ubicación actual"}
                    >
                      <View style={styles.customerMarker}>
                        <Ionicons name="person" size={20} color="#fff" />
                      </View>
                    </Marker>
                  ) : null}

                  {/* Línea entre repartidor y cliente */}
                  {order.deliveryLatitude && order.deliveryLongitude && 
                   (order.customerLatitude && order.customerLongitude || userLocation) && (
                    <Polyline
                      coordinates={[
                        {
                          latitude: order.deliveryLatitude,
                          longitude: order.deliveryLongitude,
                        },
                        {
                          latitude: order.customerLatitude || userLocation.latitude,
                          longitude: order.customerLongitude || userLocation.longitude,
                        },
                      ]}
                      strokeColor={safeColors.primary}
                      strokeWidth={3}
                      lineDashPattern={[5, 5]}
                    />
                  )}
                </MapView>
              </View>

              {!locationPermission && (
                <View style={[styles.permissionWarning, { backgroundColor: safeColors.background }]}>
                  <Ionicons name="warning-outline" size={20} color={safeColors.textSecondary} />
                  <Text style={[styles.permissionText, { color: safeColors.textSecondary }]}>
                    Activa la ubicación para ver el seguimiento en tiempo real
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Información de entrega */}
          <View style={[styles.infoCard, { backgroundColor: safeColors.cardBackground, borderColor: safeColors.border }]}>
            <Text style={[styles.cardTitle, { color: '#000000' }]}>📍 Información de Entrega</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={20} color="#000000" />
              <Text style={[styles.infoText, { color: '#000000' }]}>{order.customerName || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color="#000000" />
              <Text style={[styles.infoText, { color: '#000000' }]}>{order.customerPhone || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={20} color="#000000" />
              <Text style={[styles.infoText, { color: '#000000' }]}>{order.customerAddress || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color="#000000" />
              <Text style={[styles.infoText, { color: '#000000' }]}>
                {order.status === 'delivering' && order.deliveryLatitude && order.deliveryLongitude && userLocation
                  ? (() => {
                      const distance = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        order.deliveryLatitude,
                        order.deliveryLongitude
                      );
                      const dynamicTime = calculateEstimatedTime(distance, 'delivering');
                      return `Tiempo estimado: ${dynamicTime} minutos (en tiempo real)`;
                    })()
                  : `Tiempo estimado: ${order.estimatedDeliveryMinutes ?? 30} minutos${(!order.customerLatitude || !order.customerLongitude) && order.estimatedDeliveryMinutes === 30 ? ' (tiempo aproximado - sin ubicación)' : ''}`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={20} color="#000000" />
              <Text style={[styles.infoText, { color: '#000000' }]}>
                Pago: {order.paymentMethod === 'cash' ? 'Efectivo al entregar' : 
                       order.paymentMethod === 'pos' ? 'POS a domicilio' : 
                       order.paymentMethod === 'transfer' ? 'Transferencia' : 
                       order.paymentMethod || 'Efectivo al entregar'}
              </Text>
            </View>
          </View>

          {/* Botón de actualizar */}
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: safeColors.primary }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.refreshButtonText}>Actualizar Estado</Text>
          </TouchableOpacity>

          {/* Botón de cancelar - solo para pedidos pendientes */}
          {order.status === 'pending' && (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: '#fee2e2', borderColor: '#ef4444' }]}
              onPress={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
                  <Text style={[styles.cancelButtonText, { color: '#ef4444' }]}>Cancelar Pedido</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Botón de eliminar - solo para pedidos completados o cancelados */}
          {(order.status === 'completed' || order.status === 'cancelled') && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: '#f44336', borderColor: '#d32f2f' }]}
              onPress={handleDeleteOrder}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.deleteButtonText}>Eliminar del Historial</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Fondo por defecto (se sobrescribe con dynamicStyles)
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff', // Fondo por defecto
  },
  header: {
    margin: 16,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  orderDate: {
    fontSize: 14,
    marginLeft: 44,
  },
  statusCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusTextContainer: {
    marginLeft: 15,
    flex: 1,
  },
  statusName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statusDescription: {
    fontSize: 14,
    marginTop: 4,
  },
  timeline: {
    marginTop: 10,
  },
  timelineStep: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineLine: {
    width: 30,
    alignItems: 'center',
    marginRight: 15,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineDotCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineDotPending: {
    backgroundColor: '#e0e0e0',
    borderWidth: 2,
    borderColor: '#bdbdbd',
  },
  timelineLineConnector: {
    width: 2,
    height: 30,
    backgroundColor: '#e0e0e0',
    marginTop: 2,
  },
  timelineLineConnectorCompleted: {
    backgroundColor: '#4CAF50',
  },
  timelineLabel: {
    flex: 1,
    fontSize: 14,
    marginTop: 4,
  },
  infoCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderItemLeft: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '500',
  },
  orderItemQuantity: {
    fontSize: 14,
    marginTop: 4,
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#667eea',
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    margin: 16,
    marginTop: 0,
    borderRadius: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    margin: 20,
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  emptyItemsText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  retryButton: {
    padding: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
    marginHorizontal: 16,
    borderWidth: 1,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 0,
    marginBottom: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  map: {
    flex: 1,
  },
  deliveryMarker: {
    backgroundColor: '#ea580c',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customerMarker: {
    backgroundColor: '#4CAF50',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
  },
  distanceText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  permissionText: {
    marginLeft: 8,
    fontSize: 12,
    flex: 1,
  },
});

export default OrderTrackingScreen;


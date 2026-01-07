import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
  AppState,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ORDER_STATUS, ORDER_STATUS_LABELS } from '../constants/app';
import {
  getDeliveryPersonOrder,
  updateDeliveryPersonLocation,
  updateDeliveryOrderStatus,
} from '../services/api';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCATION_TASK_NAME } from '../services/locationTask';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { geocodeAddress } from '../services/geocoding';

const DeliveryOrderDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { orderId } = route.params || {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [backgroundLocationActive, setBackgroundLocationActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [customerCoordinates, setCustomerCoordinates] = useState(null);
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const locationSubscriptionRef = useRef(null);
  const lastLocationUpdateRef = useRef(null);
  const mapRef = useRef(null);

  useFocusEffect(
    React.useCallback(() => {
      if (orderId) {
        loadOrder();
      }
    }, [orderId])
  );

  useEffect(() => {
    if (orderId) {
      loadOrder();
      requestLocationPermission();
    }
  }, [orderId]);

  useEffect(() => {
    if (order && order.status === 'delivering' && locationPermission) {
      // Iniciar rastreo de ubicación en segundo plano
      startBackgroundLocationTracking();
      
      return () => {
        // Detener rastreo cuando el componente se desmonte o el pedido cambie
        stopBackgroundLocationTracking();
      };
    } else {
      // Detener rastreo si el pedido no está en delivering
      stopBackgroundLocationTracking();
    }
  }, [order, locationPermission, startBackgroundLocationTracking, stopBackgroundLocationTracking]);

  // Manejar cuando la app vuelve a primer plano
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && order && order.status === 'delivering') {
        // Cuando la app vuelve a primer plano, actualizar ubicación
        updateLocation(true);
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [order, updateLocation]);

  // Ajustar mapa cuando se cargan los datos del pedido
  useEffect(() => {
    if (order && mapRef.current) {
      const deliveryLat = currentLocation?.latitude || order.deliveryLatitude;
      const deliveryLng = currentLocation?.longitude || order.deliveryLongitude;
      const customerLat = customerCoordinates?.latitude || order.customerLatitude;
      const customerLng = customerCoordinates?.longitude || order.customerLongitude;
      
      if (deliveryLat && deliveryLng && customerLat && customerLng) {
        // Ajustar mapa para mostrar ambos puntos
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.fitToCoordinates([
              { latitude: deliveryLat, longitude: deliveryLng },
              { latitude: customerLat, longitude: customerLng },
            ], {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }, 500);
      } else if (customerLat && customerLng) {
        // Solo centrar en la ubicación del cliente
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: customerLat,
              longitude: customerLng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        }, 500);
      } else if (deliveryLat && deliveryLng) {
        // Solo centrar en la ubicación del repartidor
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion({
              latitude: deliveryLat,
              longitude: deliveryLng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }, 500);
          }
        }, 500);
      }
    }
  }, [order, currentLocation, customerCoordinates]);

  const requestLocationPermission = async () => {
    try {
      // Solicitar permisos de ubicación en primer plano
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus === 'granted') {
        setLocationPermission(true);
        
        // Solicitar permisos de ubicación en segundo plano
        try {
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus === 'granted') {
            console.log('Permiso de ubicación en segundo plano concedido');
          } else {
            console.log('Permiso de ubicación en segundo plano denegado, pero funcionará en primer plano');
          }
        } catch (error) {
          console.log('No se pudo solicitar permiso de segundo plano (puede no estar disponible en esta plataforma)');
        }
      } else {
        setLocationPermission(false);
      }
    } catch (error) {
      console.error('Error solicitando permiso de ubicación:', error);
      setLocationPermission(false);
    }
  };

  const startBackgroundLocationTracking = useCallback(async () => {
    try {
      // Verificar si ya hay una suscripción activa
      if (locationSubscriptionRef.current) {
        return;
      }

      // Guardar el orderId activo para la tarea en segundo plano
      await AsyncStorage.setItem('@CornerApp:activeDeliveryOrderId', orderId.toString());

      // Verificar permisos
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.log('Permisos de ubicación no concedidos');
        return;
      }

      // Intentar iniciar rastreo en segundo plano
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (!isRegistered) {
          // Solicitar permisos de segundo plano si no están concedidos
          const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
          
          if (backgroundStatus === 'granted') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.High,
              timeInterval: 30000, // Actualizar cada 30 segundos
              distanceInterval: 50, // O cuando se mueva 50 metros
              foregroundService: {
                notificationTitle: 'CornerApp - Rastreo de Entrega',
                notificationBody: 'Actualizando tu ubicación para el seguimiento del pedido',
              },
              pausesUpdatesAutomatically: false,
            });
            setBackgroundLocationActive(true);
            console.log('Rastreo de ubicación en segundo plano iniciado');
          } else {
            console.log('Permiso de ubicación en segundo plano no concedido, usando solo primer plano');
          }
        } else {
          setBackgroundLocationActive(true);
        }
      } catch (error) {
        console.log('No se pudo iniciar rastreo en segundo plano, usando rastreo en primer plano:', error);
        // Fallback: usar rastreo en primer plano con setInterval
        startForegroundLocationTracking();
      }

      // También iniciar rastreo en primer plano como respaldo
      startForegroundLocationTracking();
    } catch (error) {
      console.error('Error iniciando rastreo de ubicación:', error);
      // Fallback: usar rastreo en primer plano
      startForegroundLocationTracking();
    }
  }, [orderId, startForegroundLocationTracking]);

  const startForegroundLocationTracking = useCallback(() => {
    // Limpiar cualquier intervalo anterior
    if (locationSubscriptionRef.current) {
      clearInterval(locationSubscriptionRef.current);
    }

    // Actualizar ubicación cada 30 segundos cuando la app está en primer plano
    locationSubscriptionRef.current = setInterval(() => {
      updateLocation(true); // true = actualización automática (silenciosa)
    }, 30000);
  }, [updateLocation]);

  const stopBackgroundLocationTracking = useCallback(async () => {
    try {
      // Detener intervalo de primer plano
      if (locationSubscriptionRef.current) {
        clearInterval(locationSubscriptionRef.current);
        locationSubscriptionRef.current = null;
      }

      // Limpiar orderId activo
      await AsyncStorage.removeItem('@CornerApp:activeDeliveryOrderId');

      // Detener rastreo en segundo plano
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        setBackgroundLocationActive(false);
        console.log('Rastreo de ubicación en segundo plano detenido');
      }
    } catch (error) {
      console.error('Error deteniendo rastreo de ubicación:', error);
    }
  }, []);

  const loadOrder = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const orderData = await getDeliveryPersonOrder(orderId);
      // Normalizar el status a minúsculas
      const normalizedOrder = {
        ...orderData,
        status: (orderData.status || orderData.Status || 'pending').toLowerCase(),
      };
      setOrder(normalizedOrder);
      
      // Si hay ubicación del repartidor en el pedido, actualizar estado
      if (normalizedOrder.deliveryLatitude && normalizedOrder.deliveryLongitude) {
        setCurrentLocation({
          latitude: normalizedOrder.deliveryLatitude,
          longitude: normalizedOrder.deliveryLongitude,
        });
      }
      
      // Si hay coordenadas del cliente, usarlas directamente
      if (normalizedOrder.customerLatitude && normalizedOrder.customerLongitude) {
        setCustomerCoordinates({
          latitude: normalizedOrder.customerLatitude,
          longitude: normalizedOrder.customerLongitude,
        });
      } else if (normalizedOrder.customerAddress) {
        // Si no hay coordenadas pero sí hay dirección, geocodificar
        geocodeCustomerAddress(normalizedOrder.customerAddress);
      }
    } catch (error) {
      console.error('Error loading order:', error);
      if (error.response?.status === 404) {
        Alert.alert('Error', 'Pedido no encontrado');
        navigation.goBack();
      } else if (error.response?.status === 401) {
        Alert.alert('Error', 'Sesión expirada. Por favor inicia sesión nuevamente.');
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const geocodeCustomerAddress = async (address) => {
    if (!address || geocodingAddress) return;
    
    try {
      setGeocodingAddress(true);
      const coordinates = await geocodeAddress(address);
      
      if (coordinates) {
        setCustomerCoordinates(coordinates);
        console.log('Dirección geocodificada exitosamente:', coordinates);
      } else {
        console.warn('No se pudo geocodificar la dirección:', address);
      }
    } catch (error) {
      console.error('Error al geocodificar dirección:', error);
    } finally {
      setGeocodingAddress(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrder();
  };

  const updateLocation = useCallback(async (isAutomatic = false) => {
    if (!locationPermission) {
      if (!isAutomatic) {
        Alert.alert(
          'Permiso de ubicación',
          'Necesitas permitir el acceso a la ubicación para actualizar tu posición.'
        );
      }
      requestLocationPermission();
      return;
    }

    try {
      if (!isAutomatic) {
        setUpdatingLocation(true);
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Evitar actualizaciones muy frecuentes (mínimo 10 segundos entre actualizaciones)
      const now = Date.now();
      if (lastLocationUpdateRef.current && (now - lastLocationUpdateRef.current) < 10000 && isAutomatic) {
        return; // Saltar si fue actualizado hace menos de 10 segundos
      }
      lastLocationUpdateRef.current = now;

      await updateDeliveryPersonLocation(
        orderId,
        location.coords.latitude,
        location.coords.longitude
      );

      // Actualizar ubicación actual para el mapa
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Actualizar región del mapa para mostrar repartidor y cliente
      if (mapRef.current && order) {
        const deliveryLat = location.coords.latitude;
        const deliveryLng = location.coords.longitude;
        const customerLat = customerCoordinates?.latitude || order.customerLatitude;
        const customerLng = customerCoordinates?.longitude || order.customerLongitude;
        
        if (customerLat && customerLng) {
          // Ajustar mapa para mostrar ambos puntos
          mapRef.current.fitToCoordinates([
            { latitude: deliveryLat, longitude: deliveryLng },
            { latitude: customerLat, longitude: customerLng },
          ], {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          });
        } else {
          // Solo centrar en la ubicación del repartidor
          mapRef.current.animateToRegion({
            latitude: deliveryLat,
            longitude: deliveryLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      }

      if (!isAutomatic) {
        // Solo mostrar alert y haptic feedback si es actualización manual
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Éxito', 'Ubicación actualizada correctamente');
      }
      // Recargar datos del pedido silenciosamente
      loadOrder(true);
    } catch (error) {
      console.error('Error updating location:', error);
      if (!isAutomatic) {
        // Solo mostrar alert si es actualización manual
        Alert.alert('Error', 'No se pudo actualizar la ubicación');
      }
    } finally {
      if (!isAutomatic) {
        setUpdatingLocation(false);
      }
    }
  }, [locationPermission, orderId]);

  const updateStatus = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      await updateDeliveryOrderStatus(orderId, newStatus);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Éxito', `Estado actualizado a: ${getStatusName(newStatus)}`);
      loadOrder(true);
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo actualizar el estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = () => {
    if (!order) return;

    if (order.status === 'preparing' || order.status === 'confirmed') {
      Alert.alert(
        'Iniciar Entrega',
        '¿Deseas iniciar la entrega de este pedido?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Iniciar',
            onPress: () => updateStatus('delivering'),
          },
        ]
      );
    } else if (order.status === 'delivering') {
      Alert.alert(
        'Completar Pedido',
        '¿Confirmas que el pedido fue entregado?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Completar',
            onPress: () => updateStatus('completed'),
          },
        ]
      );
    }
  };

  const handleDeleteOrder = () => {
    if (!order) return;

    Alert.alert(
      'Ocultar Pedido',
      '¿Deseas ocultar este pedido de tu lista? El pedido seguirá existiendo en el sistema.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingOrder(true);
              
              // Obtener lista actual de pedidos eliminados
              const deletedOrdersJson = await AsyncStorage.getItem('@CornerApp:deletedDeliveryOrders');
              const deletedOrderIds = deletedOrdersJson ? JSON.parse(deletedOrdersJson) : [];
              
              // Agregar el nuevo ID si no está ya en la lista
              if (!deletedOrderIds.includes(orderId)) {
                deletedOrderIds.push(orderId);
                await AsyncStorage.setItem('@CornerApp:deletedDeliveryOrders', JSON.stringify(deletedOrderIds));
              }
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Éxito', 'Pedido oculto de tu lista', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('Error hiding order:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'No se pudo ocultar el pedido');
            } finally {
              setDeletingOrder(false);
            }
          },
        },
      ]
    );
  };

  const getStatusName = (status) => {
    return ORDER_STATUS_LABELS[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: '#ffd700',
      confirmed: '#4CAF50',
      preparing: '#2196F3',
      delivering: '#FF9800',
      completed: '#9E9E9E',
      cancelled: '#f44336',
    };
    return colorMap[status] || '#9E9E9E';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price) => {
    if (price == null || isNaN(price) || price === undefined) {
      return '$0.00';
    }
    return `$${parseFloat(price).toFixed(2)}`;
  };

  if (loading && !order) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Cargando pedido...
        </Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={80} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          No se pudo cargar el pedido
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calcular total usando los nombres correctos del backend (UnitPrice, Quantity) o los del frontend (price, quantity)
  const total = order.items?.reduce((sum, item) => {
    const price = item.unitPrice || item.UnitPrice || item.price || 0;
    const quantity = item.quantity || item.Quantity || 0;
    return sum + (parseFloat(price) * parseInt(quantity));
  }, 0) || order.total || 0;
  const canUpdateStatus = order.status === 'preparing' || order.status === 'confirmed' || order.status === 'delivering';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header con estado */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.orderId, { color: '#000000' }]}>Pedido #{order.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
              {getStatusName(order.status)}
            </Text>
          </View>
        </View>
        <Text style={[styles.orderDate, { color: '#4b5563' }]}>
          {formatDate(order.createdAt || order.CreatedAt)}
        </Text>
      </View>

      {/* Información del cliente */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: '#000000' }]}>Información del Cliente</Text>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color="#000000" />
          <Text style={[styles.infoText, { color: '#000000' }]}>
            {order.customerName || 'Cliente'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={20} color="#000000" />
          <Text style={[styles.infoText, { color: '#000000' }]}>
            {order.customerPhone || 'No disponible'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={20} color="#000000" />
          <Text style={[styles.infoText, { color: '#000000' }]}>
            {order.customerAddress || 'Dirección no disponible'}
          </Text>
        </View>
      </View>

      {/* Mapa con trayecto */}
      {(order.deliveryLatitude && order.deliveryLongitude) || currentLocation || customerCoordinates || (order.customerLatitude && order.customerLongitude) || order.customerAddress ? (
        <View style={[styles.section, { backgroundColor: colors.cardBackground, padding: 0, overflow: 'hidden' }]}>
          <Text style={[styles.sectionTitle, { color: '#000000', padding: 20, paddingBottom: 12 }]}>
            🗺️ Trayecto de Entrega
          </Text>
          <View style={styles.mapContainer}>
            {geocodingAddress && (
              <View style={styles.geocodingOverlay}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.geocodingText, { color: '#000000' }]}>
                  Buscando ubicación...
                </Text>
              </View>
            )}
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: currentLocation?.latitude || order.deliveryLatitude || customerCoordinates?.latitude || order.customerLatitude || -31.3883,
                longitude: currentLocation?.longitude || order.deliveryLongitude || customerCoordinates?.longitude || order.customerLongitude || -57.9612,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation={false}
              showsMyLocationButton={false}
              mapType="standard"
            >
              {/* Marcador del repartidor */}
              {(currentLocation || (order.deliveryLatitude && order.deliveryLongitude)) && (
                <Marker
                  coordinate={{
                    latitude: currentLocation?.latitude || order.deliveryLatitude,
                    longitude: currentLocation?.longitude || order.deliveryLongitude,
                  }}
                  title="Tu ubicación"
                  description="Repartidor"
                >
                  <View style={[styles.deliveryMarker, { backgroundColor: colors.primary }]}>
                    <Ionicons name="bicycle" size={24} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Marcador del cliente/destino */}
              {(customerCoordinates || (order.customerLatitude && order.customerLongitude)) && (
                <Marker
                  coordinate={{
                    latitude: customerCoordinates?.latitude || order.customerLatitude,
                    longitude: customerCoordinates?.longitude || order.customerLongitude,
                  }}
                  title="Destino"
                  description={order.customerAddress || 'Dirección del cliente'}
                >
                  <View style={styles.customerMarker}>
                    <Ionicons name="location" size={24} color="#fff" />
                  </View>
                </Marker>
              )}

              {/* Línea entre repartidor y cliente */}
              {(currentLocation || (order.deliveryLatitude && order.deliveryLongitude)) &&
               (customerCoordinates || (order.customerLatitude && order.customerLongitude)) && (
                <Polyline
                  coordinates={[
                    {
                      latitude: currentLocation?.latitude || order.deliveryLatitude,
                      longitude: currentLocation?.longitude || order.deliveryLongitude,
                    },
                    {
                      latitude: customerCoordinates?.latitude || order.customerLatitude,
                      longitude: customerCoordinates?.longitude || order.customerLongitude,
                    },
                  ]}
                  strokeColor={colors.primary}
                  strokeWidth={3}
                  lineDashPattern={[5, 5]}
                />
              )}
            </MapView>
          </View>
          <View style={[styles.mapLegend, { backgroundColor: colors.background }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendMarker, { backgroundColor: colors.primary }]}>
                <Ionicons name="bicycle" size={16} color="#fff" />
              </View>
              <Text style={[styles.legendText, { color: '#ffffff' }]}>Tu ubicación</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendMarker}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
              <Text style={[styles.legendText, { color: '#ffffff' }]}>Destino</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: '#000000' }]}>🗺️ Trayecto de Entrega</Text>
          <Text style={[styles.noMapText, { color: '#4b5563' }]}>
            La ubicación se mostrará cuando inicies la entrega
          </Text>
        </View>
      )}

      {/* Productos */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: '#000000' }]}>Productos</Text>
        {order.items?.map((item, index) => {
          // Usar nombres del backend (UnitPrice, Quantity, ProductName) o del frontend (price, quantity, name)
          const itemName = item.productName || item.ProductName || item.name || 'Producto';
          const unitPrice = item.unitPrice || item.UnitPrice || item.price || 0;
          const quantity = item.quantity || item.Quantity || 0;
          const subtotal = item.subtotal || item.Subtotal || (parseFloat(unitPrice) * parseInt(quantity));
          
          return (
            <View key={index} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: '#000000' }]}>{itemName}</Text>
                <Text style={[styles.itemQuantity, { color: '#4b5563' }]}>
                  Cantidad: {quantity}
                </Text>
              </View>
              <Text style={[styles.itemPrice, { color: '#000000' }]}>
                {formatPrice(subtotal)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Total */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: '#000000' }]}>Total:</Text>
          <Text style={[styles.totalAmount, { color: '#000000' }]}>
            {formatPrice(total)}
          </Text>
        </View>
      </View>

      {/* Indicador de rastreo activo */}
      {order.status === 'delivering' && backgroundLocationActive && (
        <View style={[styles.trackingIndicator, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
          <Ionicons name="location" size={16} color={colors.primary} />
          <Text style={[styles.trackingText, { color: colors.primary }]}>
            📍 Rastreo activo - Tu ubicación se actualiza automáticamente
          </Text>
        </View>
      )}

      {/* Acciones */}
      <View style={styles.actionsContainer}>
        {canUpdateStatus && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.primary },
              updatingStatus && styles.buttonDisabled,
            ]}
            onPress={handleStatusChange}
            disabled={updatingStatus}
          >
            {updatingStatus ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={order.status === 'delivering' ? 'checkmark-circle' : 'car'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>
                  {order.status === 'delivering' ? 'Marcar como Completado' : 'Iniciar Entrega'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {order.status === 'delivering' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              { borderColor: colors.primary },
              updatingLocation && styles.buttonDisabled,
            ]}
            onPress={updateLocation}
            disabled={updatingLocation}
          >
            {updatingLocation ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="location" size={20} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                  Actualizar Ubicación
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {order.status === 'completed' && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: '#f44336' },
              deletingOrder && styles.buttonDisabled,
            ]}
            onPress={handleDeleteOrder}
            disabled={deletingOrder}
          >
            {deletingOrder ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="eye-off-outline" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Ocultar Pedido</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    padding: 20,
    marginBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 14,
  },
  section: {
    padding: 20,
    marginBottom: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 14,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  trackingText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  mapContainer: {
    height: 300,
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  deliveryMarker: {
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
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendMarker: {
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noMapText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  geocodingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    gap: 8,
  },
  geocodingText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DeliveryOrderDetailScreen;


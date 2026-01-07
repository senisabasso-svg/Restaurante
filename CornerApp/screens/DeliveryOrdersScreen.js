import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getDeliveryPersonOrders } from '../services/api';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DeliveryOrdersScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingOrderId, setDeletingOrderId] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
    }, [])
  );

  useEffect(() => {
    loadOrders();
    
    // Auto-refresh cada 10 segundos
    const interval = setInterval(() => {
      loadOrders(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const ordersData = await getDeliveryPersonOrders();
      
      // El backend retorna un PagedResponse, extraer el array de data
      const ordersArray = Array.isArray(ordersData) 
        ? ordersData 
        : (ordersData?.data || ordersData?.Data || []);
      
      // Obtener lista de pedidos eliminados localmente
      const deletedOrdersJson = await AsyncStorage.getItem('@CornerApp:deletedDeliveryOrders');
      const deletedOrderIds = deletedOrdersJson ? JSON.parse(deletedOrdersJson) : [];
      
      const normalizedOrders = ordersArray
        .map(order => {
          const status = (order.status || order.Status || 'pending').toLowerCase();
          return {
            ...order,
            id: typeof order.id === 'number' ? order.id : parseInt(order.id),
            status: status,
          };
        })
        .filter(order => !deletedOrderIds.includes(order.id)); // Filtrar pedidos eliminados localmente

      normalizedOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.CreatedAt || 0);
        const dateB = new Date(b.createdAt || b.CreatedAt || 0);
        return dateB - dateA;
      });

      setOrders(normalizedOrders);
    } catch (error) {
      console.error('Error loading delivery orders:', error);
      if (error.response?.status === 401) {
        Alert.alert('Error', 'Sesión expirada. Por favor inicia sesión nuevamente.');
      }
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { name: 'Pendiente', color: '#ffd700', icon: 'time-outline' };
      case 'confirmed':
        return { name: 'Confirmado', color: '#4CAF50', icon: 'checkmark-circle-outline' };
      case 'preparing':
        return { name: 'En Preparación', color: '#2196F3', icon: 'restaurant-outline' };
      case 'delivering':
        return { name: 'En Camino', color: '#FF9800', icon: 'car-outline' };
      case 'completed':
        return { name: 'Completado', color: '#9E9E9E', icon: 'checkmark-done-circle' };
      case 'cancelled':
        return { name: 'Cancelado', color: '#f44336', icon: 'close-circle' };
      default:
        return { name: status, color: '#9E9E9E', icon: 'help-circle-outline' };
    }
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
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const handleDeleteOrder = (orderId, event) => {
    event?.stopPropagation(); // Prevenir navegación al hacer clic en eliminar
    
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
              setDeletingOrderId(orderId);
              
              // Obtener lista actual de pedidos eliminados
              const deletedOrdersJson = await AsyncStorage.getItem('@CornerApp:deletedDeliveryOrders');
              const deletedOrderIds = deletedOrdersJson ? JSON.parse(deletedOrdersJson) : [];
              
              // Agregar el nuevo ID si no está ya en la lista
              if (!deletedOrderIds.includes(orderId)) {
                deletedOrderIds.push(orderId);
                await AsyncStorage.setItem('@CornerApp:deletedDeliveryOrders', JSON.stringify(deletedOrderIds));
              }
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Recargar la lista de pedidos
              loadOrders();
            } catch (error) {
              console.error('Error hiding order:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'No se pudo ocultar el pedido');
            } finally {
              setDeletingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item }) => {
    const statusInfo = getStatusInfo(item.status);
    const total = item.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || item.total || 0;

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('DeliveryOrderDetail', { orderId: item.id });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.orderId, { color: '#000000' }]}>
              Pedido #{item.id}
            </Text>
            <Text style={[styles.orderDate, { color: '#4b5563' }]}>
              {formatDate(item.createdAt || item.CreatedAt)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.name}
            </Text>
          </View>
        </View>

        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color="#000000" />
            <Text style={[styles.detailText, { color: '#000000' }]}>
              {item.customerName || 'Cliente'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#000000" />
            <Text style={[styles.detailText, { color: '#000000' }]} numberOfLines={1}>
              {item.customerAddress || 'Dirección no disponible'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={16} color="#000000" />
            <Text style={[styles.detailText, { color: '#000000' }]}>
              {item.items?.length || 0} {item.items?.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>
        </View>

        <View style={[styles.orderFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.totalLabel, { color: '#4b5563' }]}>Total:</Text>
          <Text style={[styles.totalAmount, { color: '#000000' }]}>
            {formatPrice(total)}
          </Text>
        </View>

        {item.status === 'completed' && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: '#f44336' }]}
            onPress={(e) => handleDeleteOrder(item.id, e)}
            disabled={deletingOrderId === item.id}
          >
            {deletingOrderId === item.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="eye-off-outline" size={16} color="#fff" />
                <Text style={styles.deleteButtonText}>Ocultar</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Cargando pedidos...
        </Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="cube-outline" size={80} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          No tienes pedidos asignados
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          Los pedidos asignados aparecerán aquí
        </Text>
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: colors.primary }]}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.refreshButtonText}>Actualizar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
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
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  orderCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    marginBottom: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default DeliveryOrdersScreen;


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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { getMyOrders, deleteOrder } from '../services/api';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

const MyOrdersScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Recargar cuando la pantalla recibe foco
  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
    }, [])
  );

  useEffect(() => {
    loadOrders();
    
    // Auto-refresh cada 15 segundos
    const interval = setInterval(() => {
      loadOrders(true); // silent refresh
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      // Obtener pedidos del usuario autenticado desde el backend
      const ordersData = await getMyOrders();
      
      // El backend retorna un PagedResponse, extraer el array de data
      const ordersArray = Array.isArray(ordersData) 
        ? ordersData 
        : (ordersData?.data || ordersData?.Data || []);
      
      // Normalizar los pedidos
      const normalizedOrders = ordersArray.map(order => ({
        ...order,
        id: typeof order.id === 'number' ? order.id : parseInt(order.id),
        status: order.status || order.Status || 'pending',
      }));

      // Ordenar por fecha (más recientes primero)
      normalizedOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.CreatedAt || 0);
        const dateB = new Date(b.createdAt || b.CreatedAt || 0);
        return dateB - dateA;
      });

      setOrders(normalizedOrders);
      console.log(`📊 Total pedidos cargados: ${normalizedOrders.length}`);
    } catch (error) {
      console.error('Error loading orders:', error);
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

  const renderOrderItem = ({ item }) => {
    // Normalizar el estado (puede venir como Status o status)
    const orderStatus = item.status || item.Status || 'pending';
    const statusInfo = getStatusInfo(orderStatus);

    return (
      <TouchableOpacity
        style={[styles.orderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
        onPress={() => navigation.navigate('OrderTracking', { orderId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
            <Ionicons name="receipt-outline" size={24} color={colors.primary} />
            <Text style={[styles.orderId, { color: colors.cardText || colors.text }]}>Pedido #{item.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Ionicons name={statusInfo.icon} size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.name}
            </Text>
          </View>
        </View>

        <View style={styles.orderInfo}>
          <View style={styles.orderInfoRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.cardTextSecondary || colors.textSecondary} />
            <Text style={[styles.orderInfoText, { color: colors.cardTextSecondary || colors.textSecondary }]}>
              {item.createdAt
                ? new Date(item.createdAt).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Fecha no disponible'}
            </Text>
          </View>
          <View style={styles.orderInfoRow}>
            <Ionicons name="cube-outline" size={16} color={colors.cardTextSecondary || colors.textSecondary} />
            <Text style={[styles.orderInfoText, { color: colors.cardTextSecondary || colors.textSecondary }]}>
              {item.items?.length || 0} {item.items?.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>
        </View>

        <View style={styles.orderFooter}>
          <Text style={[styles.totalLabel, { color: colors.cardTextSecondary || colors.textSecondary }]}>Total:</Text>
          <Text style={[styles.totalAmount, { color: colors.cardText || colors.text || '#000000' }]}>
            ${item.total?.toFixed(2) || '0.00'}
          </Text>
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>

        {/* Botón de eliminar - para pedidos completados o cancelados */}
        {(orderStatus === 'completed' || orderStatus === 'cancelled') && (
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: '#f44336' }]}
            onPress={(e) => {
              e.stopPropagation(); // Evitar que se active el onPress del card
              handleDeleteOrder(item.id, item);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.deleteButtonText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const handleDeleteOrder = async (orderId, order) => {
    try {
      const normalizedOrderId = typeof orderId === 'number' ? orderId : parseInt(orderId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Archivar el pedido en el backend
      await deleteOrder(normalizedOrderId);

      // Recargar la lista
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'No se pudo eliminar el pedido. Intenta nuevamente.');
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-outline" size={64} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.text }]}>No tienes pedidos aún</Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        Realiza tu primer pedido desde el menú
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Menu')}
      >
        <Text style={styles.emptyButtonText}>Ver Menú</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Cargando pedidos...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={orders.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  orderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderInfo: {
    marginBottom: 12,
    gap: 6,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderInfoText: {
    fontSize: 14,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  arrowContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MyOrdersScreen;


import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Package,
  MapPin,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  PackageCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import { useOrdersHub } from '../hooks/useOrdersHub';
import { useNotificationSound, getTimeElapsed } from '../hooks/useNotificationSound';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { Order, OrderStatus } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  preparing: { label: 'Preparando', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Package },
  delivering: { label: 'En camino', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Truck },
  completed: { label: 'Completado', color: 'text-green-700', bgColor: 'bg-green-200', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
};

// Estados activos para repartidores: solo pedidos que están siendo preparados o en camino
const ACTIVE_STATUSES: OrderStatus[] = ['preparing', 'delivering'];

export default function DeliveryOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modals
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; order: Order } | null>(null);

  const { showToast } = useToast();
  const { playSound } = useNotificationSound();

  // SignalR handlers
  const handleOrderCreated = useCallback((order: Order) => {
    // Solo agregar si está asignado al repartidor actual y está en estado activo
    // El backend ya filtra por repartidor, pero verificamos por seguridad
    if (order.deliveryPersonId && ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (exists) {
          return prev.map(o => o.id === order.id ? order : o);
        }
        return [order, ...prev];
      });
      showToast(`🆕 Nuevo pedido #${order.id} asignado`, 'success');
      playSound();
    }
  }, [showToast, playSound]);

  const handleOrderUpdated = useCallback((order: Order) => {
    // Si está asignado y en estado activo, actualizar o agregar
    if (order.deliveryPersonId && ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
      setOrders(prev => {
        const exists = prev.some(o => o.id === order.id);
        if (exists) {
          return prev.map(o => o.id === order.id ? order : o);
        }
        return [order, ...prev];
      });
    } else {
      // Si el pedido ya no está activo o fue desasignado, removerlo
      setOrders(prev => prev.filter(o => o.id !== order.id));
    }
  }, []);

  const handleOrderStatusChanged = useCallback((event: { orderId: number; status: string }) => {
    if (ACTIVE_STATUSES.includes(event.status as OrderStatus)) {
      setOrders(prev => prev.map(o =>
        o.id === event.orderId ? { ...o, status: event.status as OrderStatus } : o
      ));
    } else {
      setOrders(prev => prev.filter(o => o.id !== event.orderId));
    }
  }, []);

  const handleOrderDeleted = useCallback((event: { orderId: number }) => {
    setOrders(prev => prev.filter(o => o.id !== event.orderId));
  }, []);

  useOrdersHub({
    onOrderCreated: handleOrderCreated,
    onOrderUpdated: handleOrderUpdated,
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderDeleted: handleOrderDeleted,
    onConnectionStatusChange: setIsConnected,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Cargar solo los pedidos asignados al repartidor autenticado
      const ordersData = await api.getDeliveryPersonOrders();
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (error: any) {
      console.error('Error al cargar pedidos:', error);
      const errorMessage = error.message || 'Error al cargar pedidos';
      setError(errorMessage);
      setOrders([]);
      try {
        showToast(errorMessage, 'error');
      } catch (toastError) {
        // Si showToast falla, al menos mostrar el error en la UI
        console.error('Error al mostrar toast:', toastError);
      }
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recargar pedidos periódicamente
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 10000); // Cada 10 segundos
    return () => clearInterval(interval);
  }, [loadData]);

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    try {
      await api.updateDeliveryOrderStatus(order.id, newStatus);
      const statusLabel = newStatus === 'cancelled' ? 'Rechazado' : statusConfig[newStatus].label;
      showToast(`Estado actualizado a ${statusLabel}`, 'success');
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al actualizar estado', 'error');
    }
  };

  const handleRejectOrder = async (order: Order) => {
    try {
      await api.updateDeliveryOrderStatus(order.id, 'cancelled');
      showToast(`Pedido #${order.id} rechazado`, 'success');
      setConfirmAction(null);
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al rechazar pedido', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-lg font-bold text-red-800 mb-2">Error al cargar pedidos</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-800">🚚 Mis Pedidos Asignados</h1>
              <p className="text-sm text-gray-500">
                {orders.length} pedido{orders.length !== 1 ? 's' : ''} asignado{orders.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Connection indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isConnected ? 'En vivo' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Lista de pedidos */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <CheckCircle size={64} className="mx-auto mb-4 text-green-400" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Todo al día!</h2>
          <p className="text-gray-500">No tienes pedidos asignados en este momento</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map(order => {
            const status = statusConfig[order.status];
            const StatusIcon = status.icon;
            const elapsed = getTimeElapsed(order.updatedAt || order.createdAt);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${
                  order.status === 'preparing' ? 'border-orange-500' :
                  order.status === 'delivering' ? 'border-purple-500' :
                  'border-gray-300'
                }`}
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary-600">#{order.id}</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                        <StatusIcon size={12} />
                        {status.label}
                      </span>
                      <span className={`text-xs ${elapsed.isUrgent ? 'text-red-600 font-bold animate-pulse' : 'text-gray-400'}`}>
                        {elapsed.isUrgent && '🔥'} {elapsed.text}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Cliente */}
                  <div>
                    <p className="font-medium text-gray-800">{order.customerName}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      {order.customerPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {order.customerPhone}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <MapPin size={12} />
                      <span className="truncate">{order.customerAddress}</span>
                    </p>
                  </div>

                  {/* Items Preview */}
                  <div className="text-sm text-gray-600">
                    {order.items?.slice(0, 2).map((item, idx) => (
                      <div key={idx}>
                        {item.quantity}x {item.productName}
                      </div>
                    ))}
                    {order.items && order.items.length > 2 && (
                      <div className="text-gray-400">+{order.items.length - 2} más...</div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-gray-600">💳 {order.paymentMethod}</span>
                    <span className="text-xl font-bold text-green-600">${order.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                  <div className="flex gap-2">
                    {order.status === 'preparing' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(order, 'delivering')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
                        >
                          <Truck size={16} />
                          En Camino
                        </button>
                        <button
                          onClick={() => {
                            setConfirmAction({ type: 'reject', order });
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          <XCircle size={16} />
                          Rechazar
                        </button>
                      </>
                    )}
                    {order.status === 'delivering' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(order, 'completed')}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                        >
                          <PackageCheck size={16} />
                          Entregado
                        </button>
                        <button
                          onClick={() => {
                            setConfirmAction({ type: 'reject', order });
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          <XCircle size={16} />
                          Rechazar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailsModalOpen(true);
                      }}
                      className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalles */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        title={`Pedido #${selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">👤 Cliente</h4>
              <p className="font-medium">{selectedOrder.customerName}</p>
              {selectedOrder.customerPhone && <p className="text-sm text-gray-600">📱 {selectedOrder.customerPhone}</p>}
              <p className="text-sm text-gray-600">📍 {selectedOrder.customerAddress}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">🛒 Productos</h4>
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="text-sm py-1">
                  <div className="flex justify-between">
                    <span>{item.quantity}x {item.productName}</span>
                    <span>${item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-green-600">${selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>
            {selectedOrder.comments && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium mb-1">💬 Comentarios</h4>
                <p className="text-sm">{selectedOrder.comments}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal de confirmación para rechazar pedido */}
      <ConfirmModal
        isOpen={confirmAction?.type === 'reject'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction?.order) {
            handleRejectOrder(confirmAction.order);
          }
        }}
        title="Rechazar Pedido"
        message={`¿Estás seguro de que deseas rechazar el pedido #${confirmAction?.order?.id}? Esta acción no se puede deshacer.`}
        confirmText="Rechazar"
        cancelText="Cancelar"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
      />
    </div>
  );
}

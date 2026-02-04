import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  Wifi,
  WifiOff,
  Play,
  UserPlus,
  LayoutGrid,
  List,
  CheckCircle2,
  Banknote,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import { useOrdersHub } from '../hooks/useOrdersHub';
import { useNotificationSound, getTimeElapsed } from '../hooks/useNotificationSound';
import Pagination from '../components/Pagination/Pagination';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { Order, OrderStatus, DeliveryPerson, Table } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  preparing: { label: 'Preparando', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: ChefHat },
  delivering: { label: 'En camino', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Truck },
  delivered: { label: 'Entregado', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  completed: { label: 'Completado', color: 'text-green-700', bgColor: 'bg-green-200', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
};

// Estados de cocina (solo preparando)
const KITCHEN_STATUSES: OrderStatus[] = ['preparing'];

// Función helper para verificar si un item es una bebida
const isBebida = (item: { categoryName?: string | null }): boolean => {
  const categoryName = item.categoryName?.toLowerCase()?.trim() || '';
  return categoryName === 'bebida' || categoryName === 'bebidas' || categoryName.includes('bebida');
};

// Función helper para verificar si un pedido tiene items para preparar (no solo bebidas)
const hasItemsToPrepare = (order: Order): boolean => {
  if (!order.items || order.items.length === 0) return false;
  const itemsToPrepare = order.items.filter(item => !isBebida(item));
  return itemsToPrepare.length > 0;
};

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [tables, setTables] = useState<Table[]>([]); // Para mapear tableId a número de mesa
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isConnected, setIsConnected] = useState(false);
  // Estado para actualizar el tiempo en tiempo real cada segundo (usar timestamp para forzar re-render)
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Mapa para obtener el número de mesa por tableId
  const getTableNumber = (tableId: number | null | undefined): string | null => {
    if (!tableId) return null;
    const table = tables.find(t => t.id === tableId);
    return table?.number || null;
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; order: Order } | null>(null);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);

  const { showToast } = useToast();
  const { playSound } = useNotificationSound();

  // SignalR handlers
  const handleOrderCreated = useCallback((order: Order) => {
    console.log('🆕 Kitchen: Nuevo pedido recibido via SignalR:', order);
    console.log('🆕 Kitchen: Status del pedido:', order?.status);
    console.log('🆕 Kitchen: ID del pedido:', order?.id);
    console.log('🆕 Kitchen: CustomerName:', order?.customerName);
    console.log('🆕 Kitchen: KITCHEN_STATUSES:', KITCHEN_STATUSES);

    // Validar que el objeto order tenga los campos necesarios
    if (!order || !order.id || !order.status) {
      console.error('❌ Kitchen: Pedido inválido recibido:', order);
      return;
    }

    const orderStatus = order.status as OrderStatus;
    console.log('🆕 Kitchen: ¿Está en KITCHEN_STATUSES?', KITCHEN_STATUSES.includes(orderStatus));
    console.log('🆕 Kitchen: ¿Tiene items para preparar?', hasItemsToPrepare(order));

    // Solo agregar si está en estados de cocina Y tiene items para preparar (no solo bebidas)
    if (KITCHEN_STATUSES.includes(orderStatus) && hasItemsToPrepare(order)) {
      // Asegurar que el objeto order tenga todos los campos necesarios
      const normalizedOrder: Order = {
        ...order,
        items: order.items || [],
        isArchived: order.isArchived || false,
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
      };

      setOrders(prev => {
        // Evitar duplicados
        const exists = prev.some(o => o.id === normalizedOrder.id);
        if (exists) {
          console.log('⚠️ Kitchen: Pedido ya existe, actualizando');
          const updated = prev.map(o => o.id === normalizedOrder.id ? normalizedOrder : o);
          console.log('🔄 Kitchen: Estado actualizado, nueva cantidad:', updated.length);
          return updated;
        }
        console.log('✅ Kitchen: Agregando nuevo pedido a la lista');
        const newOrders = [normalizedOrder, ...prev];
        console.log('🔄 Kitchen: Estado actualizado, nueva cantidad:', newOrders.length);
        console.log('🔄 Kitchen: Primer pedido en la lista:', newOrders[0]?.id);
        return newOrders;
      });
      showToast(`🆕 Nuevo pedido #${normalizedOrder.id} de ${normalizedOrder.customerName} `, 'success');
      playSound();
    } else {
      console.log('ℹ️ Kitchen: Pedido no es de cocina, ignorando. Status:', orderStatus);
    }
  }, [showToast, playSound]);

  const handleOrderUpdated = useCallback((order: Order) => {
    if (KITCHEN_STATUSES.includes(order.status) && hasItemsToPrepare(order)) {
      setOrders(prev => prev.map(o => o.id === order.id ? order : o));
    } else {
      // Si ya no es de cocina (pasó a delivering, completed, etc) o solo tiene bebidas, removerlo
      setOrders(prev => prev.filter(o => o.id !== order.id));
    }
  }, []);

  const handleOrderStatusChanged = useCallback((event: { orderId: number; status: string }) => {
    if (KITCHEN_STATUSES.includes(event.status as OrderStatus)) {
      // Actualizar el pedido y verificar si tiene items para preparar
      setOrders(prev => {
        const updated = prev.map(o =>
          o.id === event.orderId ? { ...o, status: event.status as OrderStatus } : o
        );
        // Filtrar pedidos que solo tienen bebidas después de la actualización
        return updated.filter(o => hasItemsToPrepare(o));
      });
    } else {
      // Si cambió a delivering, completed o cancelled, removerlo de la cocina
      setOrders(prev => prev.filter(o => o.id !== event.orderId));
      if (event.status === 'delivering') {
        showToast(`🚀 Pedido #${event.orderId} salió a reparto`, 'info');
      }
    }
  }, [showToast]);

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

  useEffect(() => {
    loadData();
  }, []);

  // Actualizar el tiempo cada segundo para mostrar el contador en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now()); // Usar timestamp para forzar re-render
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersResponse, deliveryData, tablesData] = await Promise.all([
        api.getActiveOrders(),
        api.getActiveDeliveryPersons(),
        api.getTables(), // Cargar mesas para obtener números
      ]);
      // El backend devuelve una respuesta paginada con propiedad 'data'
      const ordersArray = Array.isArray(ordersResponse)
        ? ordersResponse
        : (ordersResponse as any)?.data || [];
      // Filtrar solo los pedidos de cocina (solo preparing) que tienen items para preparar (no solo bebidas)
      const kitchenOrders = ordersArray.filter((o: Order) => 
        KITCHEN_STATUSES.includes(o.status) && hasItemsToPrepare(o)
      );
      
      // Debug: Log de categorías en los items y información de mesa
      kitchenOrders.forEach((order: Order) => {
        console.log(`📋 Pedido #${order.id}:`, {
          tableId: order.tableId,
          table: order.table,
          tableNumber: order.table?.number,
          hasTable: !!order.table
        });
        order.items?.forEach(item => {
          console.log('📦 Kitchen Item:', item.productName, 'Categoría:', item.categoryName, 'CategoryId:', item.categoryId);
        });
      });
      
      setOrders(kitchenOrders);
      setDeliveryPersons(Array.isArray(deliveryData) ? deliveryData : []);
      setTables(Array.isArray(tablesData) ? tablesData : []);
    } catch (error) {
      showToast('Error al cargar pedidos de cocina', 'error');
      console.error(error);
      setOrders([]);
      setDeliveryPersons([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus, deliveryPersonId?: number) => {
    try {
      await api.updateOrderStatus(order.id, newStatus, deliveryPersonId);
      showToast(`Estado actualizado a ${statusConfig[newStatus].label} `, 'success');
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar estado';
      showToast(errorMessage, 'error');
    }
  };

  const openAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDeliveryPersonId(order.deliveryPersonId || null);
    setIsAssignModalOpen(true);
  };

  const handleAssignAndDeliver = async () => {
    if (!selectedOrder || !selectedDeliveryPersonId) {
      showToast('Selecciona un repartidor', 'error');
      return;
    }
    // Para pedidos de delivery desde cocina, marcar directamente como completado
    // Esto carga el pedido automáticamente en la caja del repartidor
    await handleStatusChange(selectedOrder, 'completed', selectedDeliveryPersonId);
    setIsAssignModalOpen(false);
    setSelectedOrder(null);
    setSelectedDeliveryPersonId(null);
  };

  // Asegurar que orders siempre sea un array y filtrar pedidos que solo tienen bebidas
  const safeOrders = (Array.isArray(orders) ? orders : []).filter(o => hasItemsToPrepare(o));

  // Agrupar pedidos por estado
  const groupedOrders = KITCHEN_STATUSES.reduce((acc, status) => {
    acc[status] = safeOrders.filter(o => o.status === status);
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  // Paginación para vista de tabla
  const totalPages = Math.ceil(safeOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = safeOrders.slice(startIndex, endIndex);

  // Resetear página cuando cambian los pedidos
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [safeOrders.length, currentPage, totalPages]);

  // Debug: Log cuando cambia el estado de orders
  useEffect(() => {
    console.log('📊 Kitchen: Estado de orders actualizado. Cantidad:', safeOrders.length);
    console.log('📊 Kitchen: IDs de pedidos:', safeOrders.map(o => o.id));
    
    // Log detallado de items y categorías
    safeOrders.forEach((order: Order) => {
      console.log(`📦 Pedido #${order.id}:`);
      order.items?.forEach(item => {
        const categoryName = item.categoryName?.toLowerCase()?.trim() || '';
        const isBebida = categoryName === 'bebida' || categoryName === 'bebidas' || categoryName.includes('bebida');
        console.log(`  - ${item.productName}: categoryName="${item.categoryName}", categoryId=${item.categoryId}, isBebida=${isBebida}`);
      });
    });
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <ChefHat size={28} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">👨‍🍳 Cocina</h1>
              <p className="text-sm text-gray-500">
                {safeOrders.length} pedido{safeOrders.length !== 1 ? 's' : ''} por preparar
              </p>
            </div>
            {/* Connection indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
                }`}
            >
              {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isConnected ? 'En vivo' : 'Offline'}
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'cards'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <LayoutGrid size={16} />
              Tarjetas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              <List size={16} />
              Tabla
            </button>
          </div>
        </div>
      </div>

      {safeOrders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <CheckCircle size={64} className="mx-auto mb-4 text-green-400" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Cocina al día!</h2>
          <p className="text-gray-500">No hay pedidos pendientes de preparar</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="space-y-6">
          {KITCHEN_STATUSES.map(status => {
            const statusOrders = groupedOrders[status];
            if (statusOrders.length === 0) return null;

            const config = statusConfig[status];
            const StatusIcon = config.icon;

            return (
              <div key={status}>
                {/* Status Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <StatusIcon size={18} className={config.color} />
                  </div>
                  <h2 className={`font-bold ${config.color}`}>
                    {config.label} ({statusOrders.length})
                  </h2>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {statusOrders.map(order => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onStatusChange={handleStatusChange}
                      onAssign={() => openAssignModal(order)}
                      onCancel={() => setConfirmAction({ type: 'cancel', order })}
                      getTableNumber={getTableNumber}
                      currentTime={currentTime}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View - Vista simplificada para cocina */
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Pedido</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Tiempo</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Productos</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Notas</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                  {paginatedOrders.map(order => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  // Calcular tiempo desde que se creó el pedido (createdAt) - contador que empieza en 0
                  // Si está entregado, el contador se detiene en el momento de entrega
                  // Pasar currentTime para actualización en tiempo real
                  const elapsed = getTimeElapsed(
                    order.createdAt, 
                    order.status, 
                    order.status === 'delivered' ? order.updatedAt : null,
                    currentTime
                  );

                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-primary-600">#{order.id}</span>
                          {/* Indicador de Salón/Delivery */}
                          {order.tableId != null ? (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                              Mesa {order.table?.number || getTableNumber(order.tableId) || order.tableId} - Salón
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                              Delivery
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${elapsed.isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          {elapsed.isUrgent && '🔥 '}
                          {elapsed.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {order.items
                            ?.filter(item => !isBebida(item))
                            .map((item, idx) => (
                            <div key={idx} className="text-sm font-medium text-gray-800">
                              <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-bold mr-1">
                                {item.quantity}x
                              </span>
                              {item.productName}
                              {item.subProducts && item.subProducts.length > 0 && (
                                <div className="ml-4 mt-1 text-xs text-gray-600">
                                  {item.subProducts.map((sub, subIdx) => (
                                    <div key={subIdx} className="flex items-center gap-1">
                                      <span className="text-orange-600">+</span>
                                      <span>{sub.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {order.comments ? (
                          <span className="text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            ⚠️ {order.comments}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <KitchenTableActions
                            order={order}
                            onStatusChange={handleStatusChange}
                            onAssign={() => openAssignModal(order)}
                            onCancel={() => setConfirmAction({ type: 'cancel', order })}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {viewMode === 'table' && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={safeOrders.length}
              itemsPerPage={itemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}

      {/* Assign Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedOrder(null);
          setSelectedDeliveryPersonId(null);
        }}
        title="Asignar Repartidor"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Selecciona un repartidor para el pedido <strong>#{selectedOrder?.id}</strong>
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {deliveryPersons.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No hay repartidores activos</p>
            ) : (
              deliveryPersons.map((dp) => (
                <label
                  key={dp.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${selectedDeliveryPersonId === dp.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="deliveryPerson"
                    value={dp.id}
                    checked={selectedDeliveryPersonId === dp.id}
                    onChange={() => setSelectedDeliveryPersonId(dp.id)}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{dp.name}</p>
                    {dp.phone && <p className="text-sm text-gray-500">{dp.phone}</p>}
                  </div>
                  <Truck size={20} className="text-gray-400" />
                </label>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsAssignModalOpen(false);
                setSelectedOrder(null);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssignAndDeliver}
              disabled={!selectedDeliveryPersonId}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Truck size={18} />
              Listo para Enviar
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={confirmAction?.type === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction?.order) {
            handleStatusChange(confirmAction.order, 'cancelled');
            setConfirmAction(null);
          }
        }}
        title="Cancelar Pedido"
        message={`¿Cancelar el pedido #${confirmAction?.order?.id}?`}
        confirmText="Sí, cancelar"
        type="danger"
      />
    </div>
  );
}

// Kitchen Order Card Component - Vista simplificada para cocina
function KitchenOrderCard({
  order,
  onStatusChange,
  onAssign,
  onCancel,
  getTableNumber,
  currentTime
}: {
  order: Order;
  onStatusChange: (order: Order, status: OrderStatus, deliveryPersonId?: number) => void;
  onAssign: () => void;
  onCancel: () => void;
  getTableNumber: (tableId: number | null | undefined) => string | null;
  currentTime: number;
}) {
  const status = statusConfig[order.status];
  const StatusIcon = status.icon;
  // Calcular tiempo desde que se creó el pedido (createdAt) - contador que empieza en 0
  // Si está entregado, el contador se detiene en el momento de entrega
  // Pasar currentTime para actualización en tiempo real
  const elapsed = getTimeElapsed(
    order.createdAt, 
    order.status, 
    order.status === 'delivered' ? order.updatedAt : null,
    currentTime
  );

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${order.status === 'pending' ? 'border-yellow-500' :
      order.status === 'preparing' ? 'border-orange-500' :
        'border-gray-300'
      }`}>
      {/* Header - Solo número, estado y tiempo */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary-600">#{order.id}</span>
            {/* Indicador de Salón/Delivery */}
            {order.tableId != null ? (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                Mesa {order.table?.number || getTableNumber(order.tableId) || order.tableId} - Salón
              </span>
            ) : (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                Delivery
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
              <StatusIcon size={14} />
              {status.label}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className={`text-sm ${elapsed.isUrgent ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
            {elapsed.isUrgent && '🔥 '}{elapsed.text}
          </div>
          {/* Indicador de Pago */}
          <div className="flex items-center gap-1.5">
            {order.paymentMethod?.toLowerCase().includes('transferencia') ? (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${order.isReceiptVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                {order.isReceiptVerified ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {order.isReceiptVerified ? 'PAGADO' : 'VERIFICAR PAGO'}
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold">
                <Banknote size={10} />
                {order.paymentMethod?.toUpperCase() || 'EFECTIVO'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Body - Solo productos */}
      <div className="p-4 space-y-3">
        {/* Items - Prominentes para la cocina (excluyendo bebidas) */}
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <h4 className="text-sm font-bold text-orange-700 mb-3">🍳 PREPARAR:</h4>
          <div className="space-y-2">
            {order.items
              ?.filter(item => !isBebida(item))
              .map((item, idx) => (
              <div key={idx} className="text-base font-semibold text-orange-900">
                <div className="flex items-center gap-2">
                  <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded text-sm font-bold">
                    {item.quantity}x
                  </span>
                  <span>{item.productName}</span>
                </div>
                {item.subProducts && item.subProducts.length > 0 && (
                  <div className="ml-8 mt-1 text-sm text-orange-700 font-normal">
                    {item.subProducts.map((sub, subIdx) => (
                      <div key={subIdx} className="flex items-center gap-1">
                        <span className="text-orange-600 font-bold">+</span>
                        <span>{sub.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Comments if any - Muy visible */}
        {order.comments && (
          <div className="bg-yellow-100 rounded-lg p-3 border-2 border-yellow-400">
            <h4 className="text-sm font-bold text-yellow-800 mb-1">⚠️ NOTA:</h4>
            <p className="text-sm font-medium text-yellow-900">{order.comments}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        <div className="flex gap-2">
          {order.status === 'pending' && (
            <>
              <button
                onClick={() => onStatusChange(order, 'preparing')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-base font-bold"
                title="Comenzar a preparar"
              >
                <Play size={20} />
                Preparar
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                title="Cancelar pedido"
              >
                <XCircle size={20} />
              </button>
            </>
          )}
          {order.status === 'preparing' && (
            <>
              {order.tableId != null ? (
                // Pedido de salón: marcar como entregado a la mesa (listo para cobrar)
                <button
                  onClick={() => onStatusChange(order, 'delivered')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 text-base font-bold"
                  title="Entregado a la mesa (listo para cobrar)"
                >
                  <CheckCircle size={20} />
                  Entregado a Mesa
                </button>
              ) : (
                // Pedido de delivery: abrir modal para asignar repartidor
                <button
                  onClick={onAssign}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-base font-bold"
                  title="Listo - Asignar repartidor"
                >
                  <CheckCircle size={20} />
                  ¡Listo!
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-4 py-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                title="Cancelar pedido"
              >
                <XCircle size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Kitchen Table Actions Component
function KitchenTableActions({
  order,
  onStatusChange,
  onAssign,
  onCancel
}: {
  order: Order;
  onStatusChange: (order: Order, status: OrderStatus, deliveryPersonId?: number) => void;
  onAssign: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      {order.status === 'pending' && (
        <>
          <button onClick={() => onStatusChange(order, 'preparing')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Comenzar a preparar">
            <Play size={16} />
          </button>
          <button onClick={onCancel} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Cancelar pedido">
            <XCircle size={16} />
          </button>
        </>
      )}
      {order.status === 'preparing' && (
        <>
          {order.tableId != null ? (
            // Pedido de salón: marcar como entregado a la mesa (listo para cobrar)
            <button 
              onClick={() => onStatusChange(order, 'delivered')} 
              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" 
              title="Entregado a la mesa (listo para cobrar)"
            >
              <CheckCircle2 size={16} />
            </button>
          ) : (
            // Pedido de delivery: abrir modal para asignar repartidor
            <button onClick={onAssign} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200" title="Listo - Asignar repartidor">
              <UserPlus size={16} />
            </button>
          )}
          <button onClick={onCancel} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Cancelar pedido">
            <XCircle size={16} />
          </button>
        </>
      )}
    </>
  );
}


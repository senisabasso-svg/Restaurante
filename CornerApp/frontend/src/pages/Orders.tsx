import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  ChefHat,
  Archive,
  RotateCcw,
  Trash2,
  Wifi,
  WifiOff,
  Play,
  UserPlus,
  PackageCheck,
  Eye,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react';

type DateFilter = 'today' | 'week' | 'month' | 'all' | 'custom';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import { useOrdersHub } from '../hooks/useOrdersHub';
import { useNotificationSound, getTimeElapsed } from '../hooks/useNotificationSound';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { Order, OrderStatus, DeliveryPerson, PaymentMethod, Product, OrderStatusHistoryItem, CreateOrderRequest } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  preparing: { label: 'Preparando', color: 'bg-orange-500', icon: ChefHat },
  delivering: { label: 'En camino', color: 'bg-purple-500', icon: Truck },
  completed: { label: 'Completado', color: 'bg-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'bg-red-500', icon: XCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; order: Order } | null>(null);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderStatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Estado para crear pedido
  const [newOrder, setNewOrder] = useState<CreateOrderRequest>({
    customerName: '',
    customerAddress: '',
    customerPhone: '',
    paymentMethod: 'cash',
    comments: '',
    items: [],
  });
  
  // Estado temporal para items con productId (para facilitar la UI)
  const [orderItemsWithProductId, setOrderItemsWithProductId] = useState<Array<{ productId: number; quantity: number }>>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  
  const { showToast } = useToast();
  const { playSound } = useNotificationSound();

  // SignalR: Manejar nuevo pedido
  const handleOrderCreated = useCallback((order: Order) => {
    console.log('🆕 Nuevo pedido recibido via SignalR:', order);
    setOrders(prev => {
      // Evitar duplicados verificando si el pedido ya existe
      const exists = prev.some(o => o.id === order.id);
      if (exists) {
        console.log('⚠️ Pedido ya existe en la lista, actualizando en lugar de agregar');
        return prev.map(o => o.id === order.id ? order : o);
      }
      // Si showArchived está desactivado y el pedido está archivado, no agregarlo
      if (!showArchived && order.isArchived) {
        console.log('ℹ️ Pedido archivado no se agregará porque showArchived está desactivado');
        return prev;
      }
      // Agregar al inicio de la lista
      return [order, ...prev];
    });
    showToast(`🆕 Nuevo pedido #${order.id} de ${order.customerName}`, 'success');
    // 🔔 Reproducir sonido de notificación
    playSound();
  }, [showToast, playSound, showArchived]);

  // SignalR: Manejar pedido actualizado
  const handleOrderUpdated = useCallback(async (order: Order) => {
    console.log('🔄 Pedido actualizado via SignalR:', order);
    setOrders(prev => {
      const exists = prev.some(o => o.id === order.id);
      if (exists) {
        // Actualizar pedido existente
        return prev.map(o => o.id === order.id ? order : o);
      } else {
        // Si no existe y no está archivado (o showArchived está activo), agregarlo
        if (!showArchived && order.isArchived) {
          return prev; // No agregar pedidos archivados si no se muestran
        }
        return [order, ...prev];
      }
    });
    
    // Si el modal de detalles está abierto para este pedido, recargar el historial
    if (isDetailsModalOpen && selectedOrder?.id === order.id) {
      try {
        setLoadingHistory(true);
        const history = await api.getOrderStatusHistory(order.id);
        setOrderHistory(history);
        console.log('📝 Historial recargado para pedido:', order.id);
      } catch (error) {
        console.error('Error recargando historial:', error);
      } finally {
        setLoadingHistory(false);
      }
    }
  }, [showArchived, isDetailsModalOpen, selectedOrder]);

  // SignalR: Manejar cambio de estado
  const handleOrderStatusChanged = useCallback(async (event: { orderId: number; status: string }) => {
    setOrders(prev => prev.map(o => 
      o.id === event.orderId ? { ...o, status: event.status as OrderStatus } : o
    ));
    
    // Si el modal de detalles está abierto para este pedido, recargar el historial
    if (isDetailsModalOpen && selectedOrder?.id === event.orderId) {
      try {
        setLoadingHistory(true);
        const history = await api.getOrderStatusHistory(event.orderId);
        setOrderHistory(history);
        console.log('📝 Historial recargado después de cambio de estado para pedido:', event.orderId);
      } catch (error) {
        console.error('Error recargando historial:', error);
      } finally {
        setLoadingHistory(false);
      }
    }
  }, [isDetailsModalOpen, selectedOrder]);

  // SignalR: Manejar pedido eliminado
  const handleOrderDeleted = useCallback((event: { orderId: number }) => {
    setOrders(prev => prev.filter(o => o.id !== event.orderId));
  }, []);

  // Conectar al hub de SignalR
  useOrdersHub({
    onOrderCreated: handleOrderCreated,
    onOrderUpdated: handleOrderUpdated,
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderDeleted: handleOrderDeleted,
    onConnectionStatusChange: setIsConnected,
  });

  useEffect(() => {
    loadData();
  }, [showArchived]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersResponse, productsData, deliveryData, paymentData] = await Promise.all([
        api.getOrders({ showArchived }),
        api.getProducts(),
        api.getActiveDeliveryPersons(), // Solo repartidores activos para asignar
        api.getPaymentMethods(),
      ]);
      
      // Asegurar que los pedidos estén ordenados por fecha de creación (más recientes primero)
      const ordersList = ordersResponse.data || [];
      // Ordenar adicionalmente por createdAt para asegurar el orden correcto
      ordersList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Más recientes primero
      });
      setOrders(ordersList);
      setProducts(productsData);
      setDeliveryPersons(deliveryData);
      setPaymentMethods(paymentData);
    } catch (error) {
      showToast('Error al cargar datos', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (order: Order, newStatus: OrderStatus, deliveryPersonId?: number) => {
    try {
      await api.updateOrderStatus(order.id, newStatus, deliveryPersonId);
      showToast(`Estado actualizado a ${statusConfig[newStatus].label}`, 'success');
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar estado';
      showToast(errorMessage, 'error');
    }
  };

  // Abrir modal para asignar repartidor
  const openAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDeliveryPersonId(order.deliveryPersonId || null);
    setIsAssignModalOpen(true);
  };

  // Confirmar asignación de repartidor y cambiar a "en camino"
  const handleAssignAndDeliver = async () => {
    if (!selectedOrder || !selectedDeliveryPersonId) {
      showToast('Selecciona un repartidor', 'error');
      return;
    }
    await handleStatusChange(selectedOrder, 'delivering', selectedDeliveryPersonId);
    setIsAssignModalOpen(false);
    setSelectedOrder(null);
    setSelectedDeliveryPersonId(null);
  };

  const handleVerifyReceipt = async (orderId: number, isVerified: boolean) => {
    try {
      await api.verifyReceipt(orderId, isVerified);
      showToast(
        isVerified ? 'Comprobante verificado' : 'Verificación removida',
        'success'
      );
      loadData();
      // Actualizar el pedido seleccionado si es el mismo
      if (selectedOrder?.id === orderId) {
        const updatedOrder = await api.getOrder(orderId);
        setSelectedOrder(updatedOrder);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al verificar comprobante';
      showToast(errorMessage, 'error');
    }
  };

  // Abrir modal de detalles con historial
  const openDetailsModal = async (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
    setLoadingHistory(true);
    try {
      const history = await api.getOrderStatusHistory(order.id);
      setOrderHistory(history);
    } catch (error) {
      console.error('Error loading history:', error);
      setOrderHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Función para obtener las acciones disponibles según el estado
  const getOrderActions = (order: Order) => {
    const actions: { label: string; icon: typeof Play; color: string; onClick: () => void }[] = [];
    
    switch (order.status) {
      case 'pending':
        actions.push({
          label: 'Aceptar',
          icon: Play,
          color: 'bg-green-500 hover:bg-green-600 text-white',
          onClick: () => handleStatusChange(order, 'preparing'),
        });
        actions.push({
          label: 'Cancelar',
          icon: XCircle,
          color: 'bg-red-100 hover:bg-red-200 text-red-600',
          onClick: () => setConfirmAction({ type: 'cancel', order }),
        });
        break;
      case 'preparing':
        actions.push({
          label: 'Asignar y Enviar',
          icon: UserPlus,
          color: 'bg-purple-500 hover:bg-purple-600 text-white',
          onClick: () => openAssignModal(order),
        });
        actions.push({
          label: 'Cancelar',
          icon: XCircle,
          color: 'bg-red-100 hover:bg-red-200 text-red-600',
          onClick: () => setConfirmAction({ type: 'cancel', order }),
        });
        break;
      case 'delivering':
        actions.push({
          label: 'Entregado',
          icon: PackageCheck,
          color: 'bg-green-500 hover:bg-green-600 text-white',
          onClick: () => handleStatusChange(order, 'completed'),
        });
        actions.push({
          label: 'Problema',
          icon: XCircle,
          color: 'bg-orange-100 hover:bg-orange-200 text-orange-600',
          onClick: () => setConfirmAction({ type: 'cancel', order }),
        });
        break;
      case 'completed':
        // Solo archivar
        break;
      case 'cancelled':
        // Solo archivar o eliminar
        break;
    }
    
    return actions;
  };

  const handleArchive = async (order: Order) => {
    try {
      await api.archiveOrder(order.id);
      showToast('Pedido archivado');
      loadData();
    } catch (error) {
      showToast('Error al archivar pedido', 'error');
    }
  };

  const handleRestore = async (order: Order) => {
    try {
      await api.restoreOrder(order.id);
      showToast('Pedido restaurado');
      loadData();
    } catch (error) {
      showToast('Error al restaurar pedido', 'error');
    }
  };

  const handleDelete = async (order: Order) => {
    try {
      await api.deleteOrder(order.id);
      showToast('Pedido eliminado');
      loadData();
    } catch (error) {
      showToast('Error al eliminar pedido', 'error');
    }
  };

  // Función para filtrar por fecha
  const isWithinDateFilter = (orderDate: string) => {
    const now = new Date();
    const orderDateTime = new Date(orderDate);
    
    // Normalizar fechas a medianoche en la zona horaria local para comparación correcta
    const normalizeDate = (date: Date) => {
      const normalized = new Date(date);
      normalized.setHours(0, 0, 0, 0);
      return normalized;
    };
    
    switch (dateFilter) {
      case 'today': {
        const today = normalizeDate(now);
        const orderDateNormalized = normalizeDate(orderDateTime);
        // Comparar solo las fechas (año, mes, día) sin considerar la hora
        return orderDateNormalized.getTime() === today.getTime();
      }
      case 'week': {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        weekAgo.setHours(0, 0, 0, 0);
        const orderDateNormalized = normalizeDate(orderDateTime);
        return orderDateNormalized >= weekAgo;
      }
      case 'month': {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        monthAgo.setHours(0, 0, 0, 0);
        const orderDateNormalized = normalizeDate(orderDateTime);
        return orderDateNormalized >= monthAgo;
      }
      case 'custom': {
        if (!customDateFrom || !customDateTo) {
          return true; // Si no hay fechas seleccionadas, mostrar todos
        }
        const fromDate = normalizeDate(new Date(customDateFrom));
        const toDate = normalizeDate(new Date(customDateTo));
        toDate.setHours(23, 59, 59, 999); // Incluir todo el día final
        const orderDateNormalized = normalizeDate(orderDateTime);
        return orderDateNormalized >= fromDate && orderDateNormalized <= toDate;
      }
      case 'all':
      default:
        return true;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customerAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.id.toString().includes(searchTerm);
    const matchesStatus = !statusFilter || order.status === statusFilter;
    const matchesArchived = showArchived ? order.isArchived : !order.isArchived;
    // Para el filtro de fecha, SIEMPRE usar createdAt (fecha de creación), no updatedAt (fecha de entrega)
    // Esto asegura que los pedidos aparezcan según cuándo se crearon, no cuándo se entregaron
    const matchesDate = isWithinDateFilter(order.createdAt);
    return matchesSearch && matchesStatus && matchesArchived && matchesDate;
  });

  // Paginación
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Resetear a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateFilter, customDateFrom, customDateTo, showArchived]);

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
            <div>
              <h1 className="text-xl font-bold text-gray-800">🛒 Gestión de Pedidos</h1>
              <p className="text-sm text-gray-500">Administra todos los pedidos del sistema</p>
            </div>
            {/* Indicador de conexión en tiempo real */}
            <div 
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}
              title={isConnected ? 'Conectado - Recibiendo actualizaciones en tiempo real' : 'Desconectado - Recargue para ver nuevos pedidos'}
            >
              {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
              {isConnected ? 'En vivo' : 'Offline'}
            </div>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            Nuevo Pedido
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col gap-4">
          {/* Date Filter - Prominent */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-600 mr-2">Período:</span>
              <div className="flex bg-gray-100 rounded-lg p-1 flex-wrap">
                {[
                  { key: 'today', label: 'Hoy' },
                  { key: 'week', label: 'Semana' },
                  { key: 'month', label: 'Mes' },
                  { key: 'custom', label: 'Rango' },
                  { key: 'all', label: 'Todo' },
                ].map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setDateFilter(option.key as DateFilter);
                      // Si se cambia a otro filtro, limpiar fechas personalizadas
                      if (option.key !== 'custom') {
                        setCustomDateFrom('');
                        setCustomDateTo('');
                      }
                    }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                      dateFilter === option.key
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-400 ml-2">
                ({filteredOrders.length} pedidos)
              </span>
            </div>
            
            {/* Rango de fechas personalizado */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Desde:</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    max={customDateTo || new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Hasta:</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    min={customDateFrom}
                    max={new Date().toISOString().split('T')[0]}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {(customDateFrom || customDateTo) && (
                  <button
                    onClick={() => {
                      setCustomDateFrom('');
                      setCustomDateTo('');
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Other filters row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                id="searchOrders"
                name="searchOrders"
                placeholder="Buscar por nombre, dirección o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                id="statusFilter"
                name="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">Todos los estados</option>
                {Object.entries(statusConfig).map(([key, value]) => (
                  <option key={key} value={key}>{value.label}</option>
                ))}
              </select>
            </div>

            {/* Show Archived - Less prominent */}
            <label htmlFor="showArchived" className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 cursor-pointer transition-colors" title="Ver pedidos archivados">
              <input
                type="checkbox"
                id="showArchived"
                name="showArchived"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4 accent-primary-500"
              />
              <Archive size={16} />
              <span className="text-sm hidden sm:inline">Archivados</span>
            </label>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Dirección</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Repartidor</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Fecha</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No hay pedidos para mostrar
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
                  const status = statusConfig[order.status];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-primary-600">#{order.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{order.customerName}</div>
                        {order.customerPhone && (
                          <div className="text-sm text-gray-500">{order.customerPhone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {order.customerAddress}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-green-600">${order.total.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white ${status.color}`}>
                            <StatusIcon size={12} />
                            {status.label}
                          </span>
                          {/* ⏱️ Indicador de tiempo */}
                          {order.status !== 'completed' && order.status !== 'cancelled' && (() => {
                            const elapsed = getTimeElapsed(order.updatedAt || order.createdAt);
                            return (
                              <span className={`inline-flex items-center gap-1 text-xs ${
                                elapsed.isUrgent 
                                  ? 'text-red-600 font-medium animate-pulse' 
                                  : 'text-gray-500'
                              }`}>
                                {elapsed.isUrgent && <AlertTriangle size={10} />}
                                <Clock size={10} />
                                {elapsed.text}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {order.deliveryPerson?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {order.isArchived ? (
                            <>
                              <button
                                onClick={() => handleRestore(order)}
                                className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                title="Restaurar"
                              >
                                <RotateCcw size={16} />
                              </button>
                              <button
                                onClick={() => setConfirmAction({ type: 'delete', order })}
                                className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                                title="Eliminar permanentemente"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Botones de acción según estado */}
                              {getOrderActions(order).map((action, idx) => {
                                const ActionIcon = action.icon;
                                return (
                                  <button
                                    key={idx}
                                    onClick={action.onClick}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${action.color}`}
                                    title={action.label}
                                  >
                                    <ActionIcon size={14} />
                                    <span className="hidden lg:inline">{action.label}</span>
                                  </button>
                                );
                              })}
                              
                              {/* Ver detalles */}
                              <button
                                onClick={() => openDetailsModal(order)}
                                className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                                title="Ver detalles"
                              >
                                <Eye size={16} />
                              </button>
                              
                              {/* Archivar (solo si completado o cancelado) */}
                              {(order.status === 'completed' || order.status === 'cancelled') && (
                                <button
                                  onClick={() => handleArchive(order)}
                                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                                  title="Archivar"
                                >
                                  <Archive size={16} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Paginación sutil al final */}
        {filteredOrders.length > itemsPerPage && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredOrders.length)} de {filteredOrders.length} pedidos
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 py-1 text-sm rounded-md transition-colors min-w-[32px] ${
                        currentPage === pageNum
                          ? 'bg-primary-500 text-white'
                          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmAction?.type === 'delete'}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.order && handleDelete(confirmAction.order)}
        title="Eliminar Pedido"
        message={`¿Estás seguro de eliminar permanentemente el pedido #${confirmAction?.order?.id}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />

      {/* Confirm Cancel Modal */}
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
        message={`¿Estás seguro de cancelar el pedido #${confirmAction?.order?.id}?`}
        confirmText="Sí, cancelar"
        type="danger"
      />

      {/* Assign Delivery Person Modal */}
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
          
          <div className="space-y-2">
            {deliveryPersons.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                No hay repartidores activos disponibles
              </p>
            ) : (
              deliveryPersons.map((dp) => (
                <label
                  key={dp.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDeliveryPersonId === dp.id
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
                setSelectedDeliveryPersonId(null);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAssignAndDeliver}
              disabled={!selectedDeliveryPersonId}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Truck size={18} />
              Asignar y Enviar
            </button>
          </div>
        </div>
      </Modal>

      {/* Order Details Modal */}
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
            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">👤 Cliente</h4>
              <p className="text-gray-700">{selectedOrder.customerName}</p>
              {selectedOrder.customerPhone && (
                <p className="text-gray-600 text-sm">{selectedOrder.customerPhone}</p>
              )}
              <p className="text-gray-600 text-sm mt-1">📍 {selectedOrder.customerAddress}</p>
            </div>

            {/* Order Items */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">🛒 Productos</h4>
              <div className="space-y-2">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.quantity}x {item.productName}
                    </span>
                    <span className="text-gray-600">${item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t mt-3 pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-green-600">${selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment & Delivery */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-1">💳 Pago</h4>
                <p className="text-gray-600 text-sm">{selectedOrder.paymentMethod}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-1">🚚 Repartidor</h4>
                <p className="text-gray-600 text-sm">
                  {selectedOrder.deliveryPerson?.name || 'Sin asignar'}
                </p>
              </div>
            </div>

            {/* Comments */}
            {selectedOrder.comments && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-1">💬 Comentarios</h4>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedOrder.comments}</p>
              </div>
            )}

            {/* Comprobante de transferencia */}
            {selectedOrder.paymentMethod?.toLowerCase().includes('transferencia') && selectedOrder.transferReceiptImage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-800">🏦 Comprobante de Transferencia</h4>
                  {selectedOrder.isReceiptVerified ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle2 size={14} />
                        Verificado
                      </span>
                      <button
                        onClick={() => handleVerifyReceipt(selectedOrder.id, false)}
                        className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Desverificar comprobante"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleVerifyReceipt(selectedOrder.id, true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <CheckCircle2 size={16} />
                      Verificar Comprobante
                    </button>
                  )}
                </div>
                {selectedOrder.receiptVerifiedAt && selectedOrder.isReceiptVerified && (
                  <p className="text-xs text-gray-600 mb-2">
                    Verificado el {new Date(selectedOrder.receiptVerifiedAt).toLocaleString('es-ES')}
                    {selectedOrder.receiptVerifiedBy && ` por ${selectedOrder.receiptVerifiedBy}`}
                  </p>
                )}
                <div className="mt-2">
                  <img
                    src={selectedOrder.transferReceiptImage.startsWith('data:') 
                      ? selectedOrder.transferReceiptImage 
                      : `data:image/jpeg;base64,${selectedOrder.transferReceiptImage}`}
                    alt="Comprobante de transferencia"
                    className="w-full rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => {
                      // Abrir imagen en nueva ventana para verla en tamaño completo
                      const imageUrl = selectedOrder.transferReceiptImage.startsWith('data:') 
                        ? selectedOrder.transferReceiptImage 
                        : `data:image/jpeg;base64,${selectedOrder.transferReceiptImage}`;
                      const newWindow = window.open();
                      if (newWindow) {
                        newWindow.document.write(`
                          <html>
                            <head><title>Comprobante de Transferencia - Pedido #${selectedOrder.id}</title></head>
                            <body style="margin:0;padding:20px;background:#f3f4f6;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                              <img src="${imageUrl}" 
                                   style="max-width:100%;max-height:100vh;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" 
                                   alt="Comprobante de transferencia" />
                            </body>
                          </html>
                        `);
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">Haz clic en la imagen para verla en tamaño completo</p>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
              <span className="font-medium text-gray-800">Estado actual:</span>
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-white ${statusConfig[selectedOrder.status].color}`}>
                {statusConfig[selectedOrder.status].label}
              </span>
            </div>

            {/* Status History */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-3">📝 Historial de Estados</h4>
              {loadingHistory ? (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : orderHistory.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-2">Sin cambios registrados</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orderHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm border-l-2 border-primary-300 pl-3 py-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${statusConfig[entry.fromStatus as OrderStatus]?.color || 'bg-gray-400'} text-white`}>
                            {statusConfig[entry.fromStatus as OrderStatus]?.label || entry.fromStatus}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${statusConfig[entry.toStatus as OrderStatus]?.color || 'bg-gray-400'} text-white`}>
                            {statusConfig[entry.toStatus as OrderStatus]?.label || entry.toStatus}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-gray-500 text-xs mt-1">💬 {entry.note}</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 text-right whitespace-nowrap">
                        <div>{new Date(entry.changedAt).toLocaleDateString('es-ES')}</div>
                        <div>{new Date(entry.changedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="text-xs text-gray-500 text-center">
              Creado: {new Date(selectedOrder.createdAt).toLocaleString('es-ES')}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setNewOrder({
            customerName: '',
            customerAddress: '',
            customerPhone: '',
            paymentMethod: 'cash',
            comments: '',
            items: [],
          });
          setSelectedProductId(null);
          setProductQuantity(1);
        }}
        title="Crear Nuevo Pedido"
      >
        <div className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nombre del Cliente *
            </label>
            <input
              type="text"
              value={newOrder.customerName}
              onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Dirección *
            </label>
            <input
              type="text"
              value={newOrder.customerAddress}
              onChange={(e) => setNewOrder({ ...newOrder, customerAddress: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ej: Calle 123, Barrio Centro"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Teléfono
            </label>
            <input
              type="text"
              value={newOrder.customerPhone}
              onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ej: 099123456"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Método de Pago *
            </label>
            <select
              value={newOrder.paymentMethod}
              onChange={(e) => setNewOrder({ ...newOrder, paymentMethod: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Agregar Producto
            </label>
            <div className="flex gap-2">
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Selecciona un producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - ${product.price.toFixed(2)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={productQuantity}
                onChange={(e) => setProductQuantity(Number(e.target.value) || 1)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Cant."
              />
              <button
                onClick={() => {
                  if (selectedProductId) {
                    const product = products.find(p => p.id === selectedProductId);
                    if (product) {
                      setOrderItemsWithProductId([
                        ...orderItemsWithProductId,
                        { productId: selectedProductId, quantity: productQuantity }
                      ]);
                      setSelectedProductId(null);
                      setProductQuantity(1);
                    }
                  }
                }}
                disabled={!selectedProductId}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Lista de productos agregados */}
          {orderItemsWithProductId.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Productos Agregados
              </label>
              <div className="border border-gray-200 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {orderItemsWithProductId.map((item, index) => {
                  const product = products.find(p => p.id === item.productId);
                  return product ? (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-800">
                        {product.name} x{item.quantity}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          ${(product.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => {
                            setNewOrder({
                              ...newOrder,
                              items: newOrder.items.filter((_, i) => i !== index),
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="text-right font-bold text-lg text-primary-600">
                Total: ${newOrder.items.reduce((total, item) => {
                  const product = products.find(p => p.id === item.productId);
                  return total + (product ? product.price * item.quantity : 0);
                }, 0).toFixed(2)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Comentarios
            </label>
            <textarea
              value={newOrder.comments}
              onChange={(e) => setNewOrder({ ...newOrder, comments: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="Notas adicionales del pedido..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setNewOrder({
                  customerName: '',
                  customerAddress: '',
                  customerPhone: '',
                  paymentMethod: 'cash',
                  comments: '',
                  items: [],
                });
                setSelectedProductId(null);
                setProductQuantity(1);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={async () => {
                if (!newOrder.customerName || !newOrder.customerAddress || newOrder.items.length === 0) {
                  showToast('Completa todos los campos requeridos y agrega al menos un producto', 'error');
                  return;
                }
                try {
                  setIsCreating(true);
                  // Transformar items para que coincidan con el formato del backend
                  const transformedOrder = {
                    customerName: newOrder.customerName,
                    customerAddress: newOrder.customerAddress,
                    customerPhone: newOrder.customerPhone || undefined,
                    paymentMethod: newOrder.paymentMethod,
                    comments: newOrder.comments || undefined,
                    items: orderItemsWithProductId.map(item => {
                      const product = products.find(p => p.id === item.productId);
                      if (!product) {
                        throw new Error(`Producto con ID ${item.productId} no encontrado`);
                      }
                      return {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: item.quantity
                      };
                    })
                  };
                  await api.createOrder(transformedOrder);
                  showToast('Pedido creado exitosamente', 'success');
                  setIsCreateModalOpen(false);
                  setNewOrder({
                    customerName: '',
                    customerAddress: '',
                    customerPhone: '',
                    paymentMethod: 'cash',
                    comments: '',
                    items: [],
                  });
                  setOrderItemsWithProductId([]);
                  setSelectedProductId(null);
                  setProductQuantity(1);
                  loadData();
                } catch (error: unknown) {
                  const errorMessage = error instanceof Error ? error.message : 'Error al crear pedido';
                  showToast(errorMessage, 'error');
                } finally {
                  setIsCreating(false);
                }
              }}
              disabled={isCreating || !newOrder.customerName || !newOrder.customerAddress || newOrder.items.length === 0}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Crear Pedido
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


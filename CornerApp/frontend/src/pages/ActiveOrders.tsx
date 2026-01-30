import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
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
  PackageCheck,
  LayoutGrid,
  List,
  Phone,
  MapPin,
  AlertTriangle,
  Eye,
  CheckCircle2,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import { useOrdersHub } from '../hooks/useOrdersHub';
import { useNotificationSound } from '../hooks/useNotificationSound';
import Modal from '../components/Modal/Modal';
import Pagination from '../components/Pagination/Pagination';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { Order, OrderStatus, DeliveryPerson } from '../types';

const statusConfig: Record<OrderStatus, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: { label: 'Pendiente', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Clock },
  preparing: { label: 'Preparando', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: ChefHat },
  delivering: { label: 'En camino', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Truck },
  delivered: { label: 'Entregado', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  completed: { label: 'Completado', color: 'text-green-700', bgColor: 'bg-green-200', icon: CheckCircle },
  cancelled: { label: 'Cancelado', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
};

// Estados activos (no completados ni cancelados)
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'preparing', 'delivering'];

export default function ActiveOrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const ordersRef = useRef<Order[]>([]); // Ref para acceder al estado actual sin re-render
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isConnected, setIsConnected] = useState(false);
  // Estado para actualizar el tiempo en tiempo real
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Mantener el ref sincronizado con el estado
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Actualizar el tiempo actual cada segundo para mostrar demora en tiempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Actualizar cada segundo
    
    return () => clearInterval(interval);
  }, []);

  const [searchParams] = useSearchParams();

  // Detectar si el usuario es repartidor
  // Solo es repartidor si tiene delivery_token PERO NO tiene admin_token (admin/employee)
  const hasDeliveryToken = !!localStorage.getItem('delivery_token');
  const hasAdminToken = !!localStorage.getItem('admin_token');
  const isDeliveryPerson = hasDeliveryToken && !hasAdminToken;

  // Determinar el tipo de filtro según la ruta
  // Si es repartidor, solo puede ver delivery (nunca salon)
  const orderType = isDeliveryPerson ? 'delivery' :
                    location.pathname.includes('/salon') ? 'salon' : 
                    location.pathname.includes('/delivery') ? 'delivery' : 
                    'all';

  // Inicializar filtros desde la URL
  useEffect(() => {
    // Si necesitas lógica de filtros en URL para otras cosas, déjala aquí
    // Por ahora removemos lo de receipts
  }, [searchParams]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; order: Order } | null>(null);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);

  const { showToast } = useToast();
  const { playSound } = useNotificationSound();

  // SignalR handlers
  const handleOrderCreated = useCallback((order: any) => {
    console.log('🆕 ActiveOrders: Nuevo pedido recibido via SignalR:', order);
    console.log('🆕 ActiveOrders: Status del pedido:', order?.status);
    console.log('🆕 ActiveOrders: ID del pedido:', order?.id);
    console.log('🆕 ActiveOrders: CustomerName:', order?.customerName);
    console.log('🆕 ActiveOrders: TableId (raw):', order?.tableId, order?.TableId);
    console.log('🆕 ActiveOrders: Table (raw):', order?.table, order?.Table);
    console.log('🆕 ActiveOrders: orderType actual:', orderType);
    console.log('🆕 ActiveOrders: ACTIVE_STATUSES:', ACTIVE_STATUSES);

    // Validar que el objeto order tenga los campos necesarios
    if (!order || !order.id || !order.status) {
      console.error('❌ ActiveOrders: Pedido inválido recibido:', order);
      return;
    }

    const orderStatus = order.status as OrderStatus;
    console.log('🆕 ActiveOrders: ¿Está en ACTIVE_STATUSES?', ACTIVE_STATUSES.includes(orderStatus));

    if (ACTIVE_STATUSES.includes(orderStatus)) {
      // Normalizar el objeto order, manejando tanto camelCase como PascalCase
      const normalizedOrder: Order = {
        ...order,
        id: order.id || order.Id,
        status: (order.status || order.Status) as OrderStatus,
        customerName: order.customerName || order.CustomerName || '',
        tableId: order.tableId ?? order.TableId ?? null, // Manejar ambos casos
        table: order.table || order.Table || undefined,
        items: order.items || order.Items || [],
        isArchived: order.isArchived ?? order.IsArchived ?? false,
        createdAt: order.createdAt || order.CreatedAt || new Date().toISOString(),
        updatedAt: order.updatedAt || order.UpdatedAt || new Date().toISOString(),
      };

      console.log('🆕 ActiveOrders: Pedido normalizado:', {
        id: normalizedOrder.id,
        status: normalizedOrder.status,
        tableId: normalizedOrder.tableId,
        tableNumber: normalizedOrder.table?.number,
        orderType: orderType
      });

      // Filtrar según el tipo de pedido
      // Si es repartidor, solo incluir pedidos asignados a él (sin tableId y con deliveryPersonId)
      let shouldInclude: boolean;
      if (isDeliveryPerson) {
        shouldInclude = normalizedOrder.tableId == null && normalizedOrder.deliveryPersonId != null;
      } else if (orderType === 'all') {
        // En "Activos" mostrar TODOS los pedidos (tanto de salón como de delivery)
        shouldInclude = true;
      } else if (orderType === 'salon') {
        // Solo pedidos de salón (con tableId)
        shouldInclude = normalizedOrder.tableId != null;
      } else if (orderType === 'delivery') {
        // Solo pedidos de delivery (sin tableId)
        shouldInclude = normalizedOrder.tableId == null;
      } else {
        shouldInclude = false;
      }

      console.log('🆕 ActiveOrders: ¿Debe incluirse?', shouldInclude, {
        isDeliveryPerson,
        orderType,
        tableId: normalizedOrder.tableId,
        isSalon: normalizedOrder.tableId != null,
        isDelivery: normalizedOrder.tableId == null
      });

      if (!shouldInclude) {
        console.log('⚠️ ActiveOrders: Pedido filtrado, no corresponde al tipo actual');
        return; // No agregar este pedido si no corresponde al tipo actual
      }

      setOrders(prev => {
        // Evitar duplicados
        const exists = prev.some(o => o.id === normalizedOrder.id);
        if (exists) {
          console.log('⚠️ ActiveOrders: Pedido ya existe, actualizando');
          const updated = prev.map(o => o.id === normalizedOrder.id ? normalizedOrder : o);
          console.log('🔄 ActiveOrders: Estado actualizado, nueva cantidad:', updated.length);
          return updated;
        }
        console.log('✅ ActiveOrders: Agregando nuevo pedido a la lista');
        const newOrders = [normalizedOrder, ...prev];
        console.log('🔄 ActiveOrders: Estado actualizado, nueva cantidad:', newOrders.length);
        console.log('🔄 ActiveOrders: Primer pedido en la lista:', newOrders[0]?.id);
        return newOrders;
      });
      showToast(`🆕 Nuevo pedido #${normalizedOrder.id} de ${normalizedOrder.customerName} `, 'success');
      playSound();
    } else {
      console.log('ℹ️ ActiveOrders: Pedido no es activo, ignorando. Status:', orderStatus);
    }
  }, [showToast, playSound, orderType, isDeliveryPerson]);

  // Función helper para filtrar pedidos según el tipo
  const filterOrdersByType = useCallback((ordersArray: Order[]): Order[] => {
    // Si es repartidor, solo mostrar sus pedidos asignados (ya filtrados por el backend)
    if (isDeliveryPerson) {
      return ordersArray.filter((o: Order) => o.tableId == null && o.deliveryPersonId != null);
    }
    
    if (orderType === 'salon') {
      // Solo pedidos de salón (con TableId)
      return ordersArray.filter((o: Order) => o.tableId != null);
    } else if (orderType === 'delivery') {
      // Solo pedidos de delivery (sin TableId)
      return ordersArray.filter((o: Order) => o.tableId == null);
    }
    // Todos los pedidos
    return ordersArray;
  }, [orderType, isDeliveryPerson]);

  const loadData = useCallback(async () => {
    try {
      console.log('📥 ActiveOrders: Iniciando carga de datos...', {
        orderType,
        isDeliveryPerson,
        hasDeliveryToken,
        hasAdminToken,
        pathname: location.pathname
      });
      setLoading(true);
      
      // Si es repartidor, cargar solo sus pedidos asignados
      let ordersResponse: Order[];
      if (isDeliveryPerson) {
        ordersResponse = await api.getDeliveryPersonOrders();
      } else {
        ordersResponse = await api.getActiveOrders();
      }
      
      const [deliveryData] = await Promise.all([
        isDeliveryPerson ? Promise.resolve([]) : api.getActiveDeliveryPersons(),
      ]);
      // El backend devuelve una respuesta paginada con propiedad 'data'
      const ordersArray = Array.isArray(ordersResponse)
        ? ordersResponse
        : (ordersResponse as any)?.data || [];
      
      console.log('📥 ActiveOrders: Datos recibidos del servidor:', {
        totalPedidos: ordersArray.length,
        pedidos: ordersArray.map((o: Order) => ({
          id: o.id,
          tableId: o.tableId,
          tableNumber: o.table?.number,
          status: o.status
        }))
      });
      
      // Buscar el pedido 1040 específicamente para debugging
      const order1040 = ordersArray.find((o: Order) => o.id === 1040);
      if (order1040) {
        console.log('🔍 ActiveOrders: Pedido 1040 encontrado en datos del servidor:', {
          id: order1040.id,
          tableId: order1040.tableId,
          tableNumber: order1040.table?.number,
          table: order1040.table,
          status: order1040.status
        });
      }
      
      // Filtrar según el tipo de pedido
      const filteredOrders = filterOrdersByType(ordersArray);
      console.log('📥 ActiveOrders: Pedidos filtrados:', {
        orderType: orderType,
        totalFiltrados: filteredOrders.length,
        pedidos: filteredOrders.map((o: Order) => ({
          id: o.id,
          tableId: o.tableId,
          tableNumber: o.table?.number,
          status: o.status
        }))
      });
      
      // Buscar el pedido 1040 en los filtrados
      const order1040Filtered = filteredOrders.find((o: Order) => o.id === 1040);
      if (order1040Filtered) {
        console.log('🔍 ActiveOrders: Pedido 1040 en pedidos filtrados:', {
          id: order1040Filtered.id,
          tableId: order1040Filtered.tableId,
          tableNumber: order1040Filtered.table?.number,
          table: order1040Filtered.table,
          status: order1040Filtered.status
        });
      }
      
      setOrders(filteredOrders);
      setDeliveryPersons(Array.isArray(deliveryData) ? deliveryData : []);
      
      // Verificar el estado después de actualizarlo
      setTimeout(() => {
        const order1040InState = ordersRef.current.find((o: Order) => o.id === 1040);
        if (order1040InState) {
          console.log('✅ ActiveOrders: Pedido 1040 en el estado después de setOrders:', {
            id: order1040InState.id,
            tableId: order1040InState.tableId,
            tableNumber: order1040InState.table?.number,
            table: order1040InState.table,
            status: order1040InState.status
          });
        } else {
          console.log('⚠️ ActiveOrders: Pedido 1040 NO encontrado en el estado después de setOrders');
        }
      }, 50);
      
      console.log('✅ ActiveOrders: Datos actualizados en el estado');
    } catch (error) {
      console.error('❌ ActiveOrders: Error al cargar pedidos activos:', error);
      showToast('Error al cargar pedidos activos', 'error');
      setOrders([]);
      setDeliveryPersons([]);
    } finally {
      setLoading(false);
    }
  }, [filterOrdersByType, showToast, orderType, isDeliveryPerson, location.pathname]);

  const handleOrderUpdated = useCallback((order: Order) => {
    console.log('🔄 ActiveOrders: handleOrderUpdated llamado con:', {
      id: order?.id,
      tableId: order?.tableId,
      table: order?.table,
      tableNumber: order?.table?.number,
      status: order?.status,
      orderType: orderType,
      orderCompleto: order
    });
    
    if (!order || !order.id) {
      console.warn('⚠️ ActiveOrders: handleOrderUpdated recibió un pedido inválido:', order);
      return;
    }
    
    // Verificar si el pedido cambió de mesa usando el ref para acceder al estado actual
    const existingOrder = ordersRef.current.find(o => o.id === order.id);
    console.log('🔍 ActiveOrders: Verificando cambio de mesa:', {
      orderId: order.id,
      existingOrder: existingOrder ? {
        id: existingOrder.id,
        tableId: existingOrder.tableId,
        tableNumber: existingOrder.table?.number
      } : null,
      newOrder: {
        id: order.id,
        tableId: order.tableId,
        tableNumber: order.table?.number
      },
      ordersRefLength: ordersRef.current.length,
      ordersRefIds: ordersRef.current.map(o => ({ id: o.id, tableId: o.tableId }))
    });
    
    const tableIdChanged = existingOrder && existingOrder.tableId !== order.tableId;
    
    // ESTRATEGIA PRINCIPAL: Si estamos en vista de salón y recibimos una notificación de OrderUpdated
    // para un pedido con tableId, SIEMPRE forzar recarga para asegurar que la vista esté actualizada
    // Esto es especialmente importante cuando se transfieren pedidos entre mesas
    // (El pedido puede ya tener el nuevo tableId en el estado si se actualizó antes de que llegara la notificación)
    // Si es repartidor, no procesar pedidos de salón
    if (!isDeliveryPerson && orderType === 'salon' && order.tableId != null && ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
      console.log('🔄 ActiveOrders: ⚠️ Notificación de OrderUpdated recibida para pedido de salón. Forzando recarga para asegurar consistencia...', {
        orderId: order.id,
        tableId: order.tableId,
        tableNumber: order.table?.number,
        existingOrder: existingOrder ? {
          id: existingOrder.id,
          tableId: existingOrder.tableId,
          tableNumber: existingOrder.table?.number
        } : 'no existe',
        tableIdChanged: tableIdChanged
      });
      // Forzar recarga inmediatamente (sin setTimeout para que sea más rápido)
      console.log('🔄 ActiveOrders: Ejecutando recarga completa INMEDIATA después de notificación OrderUpdated...');
      loadData();
      return; // Salir temprano, la recarga actualizará todo
    }
    
    // Si el pedido cambió de mesa, forzar recarga
    if (tableIdChanged) {
      console.log('🔄 ActiveOrders: ⚠️⚠️⚠️ CAMBIO DE MESA DETECTADO! Forzando recarga completa...', {
        orderId: order.id,
        oldTableId: existingOrder.tableId,
        oldTableNumber: existingOrder.table?.number,
        newTableId: order.tableId,
        newTableNumber: order.table?.number
      });
      // Forzar recarga completa cuando cambia la mesa para asegurar consistencia
      setTimeout(() => {
        console.log('🔄 ActiveOrders: Ejecutando recarga completa después de cambio de mesa...');
        loadData();
      }, 100);
      return; // Salir temprano, la recarga actualizará todo
    } 
    
    // Si el pedido NO existe en el estado actual pero tiene tableId y es activo,
    // puede ser que se transfirió desde otra mesa y ahora debe aparecer en esta vista
    // FORZAR RECARGA para asegurar que la vista se actualice correctamente
    if (!existingOrder && order.tableId != null && ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
      // Verificar si el pedido debería estar en esta vista
      const shouldBeInView = isDeliveryPerson 
        ? (order.tableId == null && order.deliveryPersonId != null)
        : (orderType === 'all' || 
           (orderType === 'salon' && order.tableId != null) ||
           (orderType === 'delivery' && order.tableId == null));
      
      if (shouldBeInView) {
        console.log('🔄 ActiveOrders: Pedido transferido detectado (no estaba en estado pero debería estar). Forzando recarga...', {
          orderId: order.id,
          tableId: order.tableId,
          tableNumber: order.table?.number,
          orderType: orderType,
          shouldBeInView: shouldBeInView
        });
        setTimeout(() => {
          loadData();
        }, 100);
        return;
      }
    }
    
    if (existingOrder) {
      console.log('ℹ️ ActiveOrders: Pedido existe pero NO cambió de mesa:', {
        orderId: order.id,
        tableId: order.tableId,
        existingTableId: existingOrder.tableId
      });
    } else {
      console.log('ℹ️ ActiveOrders: Pedido no existe en el estado actual y no debería estar en esta vista:', {
        orderId: order.id,
        tableId: order.tableId,
        totalOrdersInState: ordersRef.current.length,
        orderType: orderType
      });
    }
    
    // Si no cambió de mesa, continuar con la lógica normal de actualización
    if (ACTIVE_STATUSES.includes(order.status as OrderStatus)) {
      // Verificar si el pedido corresponde al tipo actual
      let shouldInclude: boolean;
      if (isDeliveryPerson) {
        shouldInclude = order.tableId == null && order.deliveryPersonId != null;
      } else if (orderType === 'all') {
        // En "Activos" mostrar TODOS los pedidos (tanto de salón como de delivery)
        shouldInclude = true;
      } else if (orderType === 'salon') {
        // Solo pedidos de salón (con tableId)
        shouldInclude = order.tableId != null;
      } else if (orderType === 'delivery') {
        // Solo pedidos de delivery (sin tableId)
        shouldInclude = order.tableId == null;
      } else {
        shouldInclude = false;
      }
      
      console.log('🔍 ActiveOrders: Verificando si incluir pedido:', {
        orderId: order.id,
        shouldInclude,
        orderType,
        orderTableId: order.tableId,
        isSalon: orderType === 'salon' && order.tableId != null,
        isDelivery: orderType === 'delivery' && order.tableId == null
      });
      
      if (shouldInclude) {
        // Actualizar el pedido completamente, asegurando que tableId y table se actualicen
        setOrders(prev => {
          const existingOrder = prev.find(o => o.id === order.id);
          console.log('📝 ActiveOrders: Pedido existente antes de actualizar:', {
            id: existingOrder?.id,
            tableId: existingOrder?.tableId,
            tableNumber: existingOrder?.table?.number
          });
          
          const updated = prev.map(o => {
            if (o.id === order.id) {
              const newOrder = {
                ...order,
                tableId: order.tableId,
                table: order.table
              };
              console.log('✅ ActiveOrders: Actualizando pedido', order.id, {
                oldTableId: o.tableId,
                newTableId: newOrder.tableId,
                oldTableNumber: o.table?.number,
                newTableNumber: newOrder.table?.number
              });
              return newOrder;
            }
            return o;
          });
          
          console.log('📊 ActiveOrders: Estado después de actualizar:', {
            cantidad: updated.length,
            pedidoActualizado: updated.find(o => o.id === order.id)
          });
          
          return updated;
        });
      } else {
        // Si el pedido cambió de tipo (ej: de salón a delivery), removerlo
        console.log('⚠️ ActiveOrders: Pedido', order.id, 'cambió de tipo, removiendo de la lista');
        setOrders(prev => prev.filter(o => o.id !== order.id));
      }
    } else {
      // Si ya no es activo, removerlo
      console.log('❌ ActiveOrders: Pedido', order.id, 'ya no es activo, removiendo');
      setOrders(prev => prev.filter(o => o.id !== order.id));
    }
  }, [orderType, loadData, isDeliveryPerson]);

  const handleOrderStatusChanged = useCallback((event: { orderId: number; status: string }) => {
    if (ACTIVE_STATUSES.includes(event.status as OrderStatus)) {
      setOrders(prev => {
        const order = prev.find(o => o.id === event.orderId);
        if (!order) return prev;
        
        // Verificar si el pedido actualizado corresponde al tipo actual
        let shouldInclude: boolean;
        if (isDeliveryPerson) {
          shouldInclude = order.tableId == null && order.deliveryPersonId != null;
        } else if (orderType === 'all') {
          // En "Activos" mostrar TODOS los pedidos (tanto de salón como de delivery)
          shouldInclude = true;
        } else if (orderType === 'salon') {
          // Solo pedidos de salón (con tableId)
          shouldInclude = order.tableId != null;
        } else if (orderType === 'delivery') {
          // Solo pedidos de delivery (sin tableId)
          shouldInclude = order.tableId == null;
        } else {
          shouldInclude = false;
        }
        
        if (shouldInclude) {
          return prev.map(o =>
            o.id === event.orderId ? { ...o, status: event.status as OrderStatus } : o
          );
        } else {
          // Si el pedido no corresponde al tipo actual, removerlo
          return prev.filter(o => o.id !== event.orderId);
        }
      });
    } else {
      // Si cambió a completado o cancelado, removerlo
      setOrders(prev => prev.filter(o => o.id !== event.orderId));
      showToast(`Pedido #${event.orderId} ${event.status === 'completed' ? 'completado' : 'actualizado'} `, 'info');
    }
  }, [showToast, orderType, isDeliveryPerson]);

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
  }, [orderType]); // Recargar cuando cambie el tipo de pedido

  // Polling periódico como respaldo de SignalR (cada 10 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      // Solo hacer polling si SignalR no está conectado o como respaldo
      if (!isConnected) {
        console.log('🔄 SignalR desconectado, haciendo polling de respaldo...');
        loadData();
      } else {
        // Aún así, verificar periódicamente por si hay pedidos que no se notificaron
        // Solo actualizar si hay cambios (comparar IDs)
        const checkForNewOrders = async () => {
          try {
            const ordersResponse = await api.getActiveOrders();
            const ordersArray = Array.isArray(ordersResponse)
              ? ordersResponse
              : (ordersResponse as any)?.data || [];
            
            // Filtrar según el tipo de pedido
            let filteredOrders: Order[];
            if (orderType === 'salon') {
              // Solo pedidos de salón (con tableId)
              filteredOrders = ordersArray.filter((o: Order) => o.tableId != null);
            } else if (orderType === 'delivery') {
              // Solo pedidos de delivery (sin tableId)
              filteredOrders = ordersArray.filter((o: Order) => o.tableId == null);
            } else {
              // orderType === 'all' - Mostrar TODOS los pedidos (tanto de salón como de delivery)
              filteredOrders = ordersArray;
            }
            
            setOrders(prev => {
              const currentIds = new Set(prev.map(o => o.id));
              const newIds = new Set(filteredOrders.map((o: Order) => o.id));
              
              // Verificar si hay pedidos nuevos
              const newOrders = filteredOrders.filter((o: Order) => !currentIds.has(o.id));
              if (newOrders.length > 0) {
                console.log('🆕 Polling detectó nuevos pedidos:', newOrders.map((o: Order) => o.id));
                // Agregar nuevos pedidos al inicio
                return [...newOrders, ...prev];
              }
              
              // Verificar si hay pedidos que desaparecieron (completados/cancelados o cambiaron de tipo)
              const removedIds = prev.filter(o => !newIds.has(o.id)).map(o => o.id);
              if (removedIds.length > 0) {
                console.log('🗑️ Polling detectó pedidos removidos:', removedIds);
                return prev.filter(o => newIds.has(o.id));
              }
              
              // Actualizar pedidos existentes si hay cambios
              const updated = prev.map(prevOrder => {
                const updatedOrder = filteredOrders.find((o: Order) => o.id === prevOrder.id);
                return updatedOrder || prevOrder;
              });
              
              return updated;
            });
          } catch (error) {
            console.error('Error en polling de respaldo:', error);
          }
        };
        
        checkForNewOrders();
      }
    }, 10000); // Cada 10 segundos

    return () => clearInterval(interval);
  }, [isConnected, orderType]); // Incluir orderType en las dependencias


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

  // Asegurar que orders siempre sea un array
  const safeOrders = Array.isArray(orders) ? orders : [];

  // Agrupar pedidos por estado (sin filtros de pago aqui)
  const groupedOrders = ACTIVE_STATUSES.reduce((acc, status) => {
    let statusOrders = safeOrders.filter(o => o.status === status);
    acc[status] = statusOrders;
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
    console.log('📊 ActiveOrders: Estado de orders actualizado. Cantidad:', safeOrders.length);
    console.log('📊 ActiveOrders: IDs de pedidos:', safeOrders.map(o => o.id));
    console.log('📊 ActiveOrders: Orders completo:', orders);
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
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {isDeliveryPerson ? '🚚 Mis Pedidos Asignados' : '📋 Pedidos Activos'}
              </h1>
              <p className="text-sm text-gray-500">
                {safeOrders.length} pedido{safeOrders.length !== 1 ? 's' : ''} en proceso
              </p>
            </div>
            {/* Connection indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isConnected
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
                } `}
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
                } `}
            >
              <LayoutGrid size={16} />
              Tarjetas
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === 'table'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
                } `}
            >
              <List size={16} />
              Tabla
            </button>
          </div>
        </div>
      </div>

      {
        safeOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <CheckCircle size={64} className="mx-auto mb-4 text-green-400" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">¡Todo al día!</h2>
            <p className="text-gray-500">
              {isDeliveryPerson 
                ? 'No tienes pedidos asignados en este momento' 
                : 'No hay pedidos activos en este momento'}
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          /* Cards View */
          <div className="space-y-6">
            {ACTIVE_STATUSES.map(status => {
              const statusOrders = groupedOrders[status];
              if (statusOrders.length === 0) return null;

              const config = statusConfig[status];
              const StatusIcon = config.icon;

              return (
                <div key={status}>
                  {/* Status Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-2 rounded-lg ${config.bgColor} `}>
                      <StatusIcon size={18} className={config.color} />
                    </div>
                    <h2 className={`font-bold ${config.color} `}>
                      {config.label} ({statusOrders.length})
                    </h2>
                  </div>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {statusOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        onAssign={() => openAssignModal(order)}
                        onCancel={() => setConfirmAction({ type: 'cancel', order })}
                        onViewDetails={() => {
                          setSelectedOrder(order);
                          setIsDetailsModalOpen(true);
                        }}
                        currentTime={currentTime}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Tiempo</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedOrders.map(order => {
                    const status = statusConfig[order.status];
                    const StatusIcon = status.icon;
                    // Calcular tiempo desde que se creó el pedido, actualizado en tiempo real
                    const orderCreatedTime = new Date(order.createdAt).getTime();
                    const delayMs = currentTime - orderCreatedTime;
                    const delayMins = Math.floor(delayMs / 60000);
                    const delayHours = Math.floor(delayMins / 60);
                    let delayText: string;
                    if (delayHours > 0) {
                      delayText = `${delayHours}h ${delayMins % 60}min`;
                    } else {
                      delayText = `${delayMins}min`;
                    }
                    const elapsed = { text: delayText, isUrgent: delayMins > 20, minutes: delayMins };

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-bold text-primary-600">#{order.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-sm text-gray-500">{order.customerPhone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-green-600">${order.total.toFixed(2)}</div>
                          {isTransferPayment(order.paymentMethod) && order.transferReceiptImage && (
                            <div className="mt-1">
                              {order.isReceiptVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  <CheckCircle2 size={10} />
                                  Verificado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium animate-pulse">
                                  <AlertTriangle size={10} />
                                  Pendiente
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color} `}>
                            <StatusIcon size={12} />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm ${elapsed.isUrgent ? 'text-red-600 font-medium' : 'text-gray-500'} `}>
                            {elapsed.isUrgent && <AlertTriangle size={12} className="inline mr-1" />}
                            {elapsed.text}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <TableActions
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
        )
      }

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
                    } `}
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
              Asignar y Enviar
            </button>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
        }}
        title={`Pedido #${selectedOrder?.id} `}
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
                  {item.subProducts && item.subProducts.length > 0 && (
                    <div className="ml-4 mt-1 text-xs text-gray-600">
                      {item.subProducts.map((sub, subIdx) => (
                        <div key={subIdx} className="flex items-center gap-1">
                          <span className="text-gray-500">+</span>
                          <span>{sub.name} (+${sub.price.toFixed(2)})</span>
                        </div>
                      ))}
                    </div>
                  )}
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

            {/* Comprobante de transferencia */}
            {isTransferPayment(selectedOrder.paymentMethod) && selectedOrder.transferReceiptImage && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">🏦 Comprobante de Transferencia</h4>
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
                    {selectedOrder.receiptVerifiedBy && ` por ${selectedOrder.receiptVerifiedBy} `}
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
                      if (!selectedOrder.transferReceiptImage) return;
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
                          </html >
  `);
                      }
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-2">Haz clic en la imagen para verla en tamaño completo</p>
                </div>
              </div>
            )}
          </div>
        )}
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
    </div >
  );
}

// Helper function para detectar si es transferencia
function isTransferPayment(paymentMethod: string | undefined | null): boolean {
  if (!paymentMethod) return false;
  const method = paymentMethod.toLowerCase();
  return method.includes('transfer') || method.includes('transferencia');
}

// Order Card Component
function OrderCard({
  order,
  onStatusChange,
  onAssign,
  onCancel,
  onViewDetails,
  currentTime
}: {
  order: Order;
  onStatusChange: (order: Order, status: OrderStatus) => void;
  onAssign: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
  currentTime: number;
}) {
  const status = statusConfig[order.status];
  const StatusIcon = status.icon;
  // Calcular tiempo desde que se creó el pedido, actualizado en tiempo real
  const orderCreatedTime = new Date(order.createdAt).getTime();
  const delayMs = currentTime - orderCreatedTime;
  const delayMins = Math.floor(delayMs / 60000);
  const delayHours = Math.floor(delayMins / 60);
  let delayText: string;
  if (delayHours > 0) {
    delayText = `${delayHours}h ${delayMins % 60}min`;
  } else {
    delayText = `${delayMins}min`;
  }
  const elapsed = { text: delayText, isUrgent: delayMins > 20, minutes: delayMins };
  const isTransfer = isTransferPayment(order.paymentMethod);
  const needsVerification = isTransfer && !order.isReceiptVerified;
  
  // Código de debugging específico comentado para optimización
  // TODO: Eliminar después de verificar que no se necesita
  // if (order.id === 1040) {
  //   console.log('🔍 OrderCard: Pedido 1040 renderizado:', {
  //     id: order.id,
  //     tableId: order.tableId,
  //     tableNumber: order.table?.number,
  //     table: order.table,
  //     customerName: order.customerName,
  //     customerAddress: order.customerAddress,
  //     fullOrder: order
  //   });
  // }
  // 
  // if (order.id === 1035) {
  //   console.log('Pedido 1035 en OrderCard:', {
  //     id: order.id,
  //     paymentMethod: order.paymentMethod,
  //     isTransfer,
  //     hasReceipt: !!order.transferReceiptImage,
  //     isVerified: order.isReceiptVerified,
  //     needsVerification
  //   });
  // }

  return (
    <div className={`bg-white rounded-xl shadow-md overflow-hidden border-l-4 ${order.status === 'pending' ? 'border-yellow-500' :
      order.status === 'preparing' ? 'border-orange-500' :
        order.status === 'delivering' ? 'border-purple-500' :
          'border-gray-300'
      } `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg font-bold text-primary-600">#{order.id}</span>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color} `}>
              <StatusIcon size={12} />
              {status.label}
            </span>
            <span className={`text-xs ${elapsed.isUrgent ? 'text-red-600 font-bold animate-pulse' : 'text-gray-400'} `}>
              {elapsed.isUrgent && '🔥'} {elapsed.text}
            </span>
          </div>
        </div>
        {/* Información de origen del pedido */}
        <div className="flex items-center gap-2">
          {order.tableId && order.table ? (
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-medium">
              🪑 Mesa {order.table.number}
            </span>
          ) : order.deliveryPersonId && order.deliveryPerson ? (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
              🚚 Repartidor: {order.deliveryPerson.name}
            </span>
          ) : order.deliveryPersonId ? (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium">
              🚚 Delivery
            </span>
          ) : null}
        </div>
      </div>

      {/* Aviso de comprobante sin verificar */}
      {needsVerification && (
        <div className="px-4 py-2 bg-red-50 border-l-4 border-red-500">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-800">
              ⚠️ Comprobante sin verificar
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Customer */}
        <div>
          <p className="font-medium text-gray-800">
            {/* Limpiar "Mesa X" del customerName - puede estar en diferentes formatos */}
            {(() => {
              if (!order.customerName) return '';
              let cleaned = order.customerName;
              // Remover "Mesa X" en cualquier formato (case insensitive)
              cleaned = cleaned.replace(/Mesa\s*\d+/gi, '').trim();
              // Remover guiones o separadores que queden al inicio o final
              cleaned = cleaned.replace(/^[-–—\s]+|[-–—\s]+$/g, '').trim();
              // Si el customerName es solo "Mesa X" o quedó vacío después de limpiar, usar un nombre genérico
              if (!cleaned || cleaned.length === 0) {
                return order.tableId && order.table 
                  ? `Mesa ${order.table.number}` 
                  : 'Cliente';
              }
              return cleaned;
            })()}
          </p>
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
            <span className="truncate">
              {/* Limpiar "Mesa X" del customerAddress */}
              {(() => {
                if (!order.customerAddress) return '';
                let cleaned = order.customerAddress;
                cleaned = cleaned.replace(/Mesa\s*\d+/gi, '').trim();
                cleaned = cleaned.replace(/^[-–—]\s*|\s*[-–—]$/g, '').trim();
                return cleaned || order.customerAddress;
              })()}
            </span>
          </p>
        </div>

        {/* Items Preview */}
        <div className="text-sm text-gray-600">
          {order.items?.slice(0, 2).map((item, idx) => (
            <div key={idx}>
              {item.quantity}x {item.productName}
              {item.subProducts && item.subProducts.length > 0 && (
                <div className="ml-4 text-xs text-gray-500">
                  {item.subProducts.map((sub, subIdx) => (
                    <div key={subIdx}>+ {sub.name}</div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {order.items && order.items.length > 2 && (
            <div className="text-gray-400">+{order.items.length - 2} más...</div>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">💳 {order.paymentMethod}</span>
            {isTransferPayment(order.paymentMethod) && order.transferReceiptImage && (
              <>
                {order.isReceiptVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    <CheckCircle2 size={12} />
                    Verificado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium animate-pulse">
                    <AlertTriangle size={12} />
                    Pendiente
                  </span>
                )}
              </>
            )}
          </div>
          <span className="text-xl font-bold text-green-600">${order.total.toFixed(2)}</span>
        </div>

        {/* Delivery Person */}
        {order.deliveryPerson && (
          <div className="flex items-center gap-2 text-sm bg-purple-50 text-purple-700 p-2 rounded-lg">
            <Truck size={14} />
            <span>{order.deliveryPerson.name}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-100">
        {/* Aviso de verificación pendiente */}
        {needsVerification && order.status === 'pending' && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800">
                ⚠️ Comprobante de transferencia pendiente de verificación
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Se recomienda verificar el comprobante antes de aceptar el pedido. Puedes verificar desde el modal de detalles.
              </p>
            </div>
          </div>
        )}
        
        <div className="flex gap-2">
          {order.status === 'pending' && (
            <>
              <button
                onClick={() => onStatusChange(order, 'preparing')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-green-500 text-white hover:bg-green-600"
                title="Aceptar pedido y pasar a preparación"
              >
                <Play size={16} />
                Aceptar
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                title="Cancelar pedido - El cliente será notificado"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
          {order.status === 'preparing' && (
            <>
              {/* Si es pedido de mesa, permitir marcar como entregado directamente sin repartidor */}
              {order.tableId ? (
                <button
                  onClick={() => onStatusChange(order, 'delivered')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                  title="Entregado a la mesa (listo para cobrar)"
                >
                  <PackageCheck size={16} />
                  Entregado
                </button>
              ) : order.deliveryPersonId ? (
                /* Si ya tiene repartidor asignado, permitir enviar directamente */
                <button
                  onClick={() => onStatusChange(order, 'delivering', order.deliveryPersonId)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
                  title="Enviar pedido al repartidor asignado"
                >
                  <Truck size={16} />
                  Enviar
                </button>
              ) : (
                <button
                  onClick={onAssign}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm font-medium"
                  title="Asignar repartidor y enviar"
                >
                  <UserPlus size={16} />
                  Asignar
                </button>
              )}
              <button
                onClick={onCancel}
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                title="Cancelar pedido - El cliente será notificado"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
          {order.status === 'delivering' && (
            <>
              <button
                onClick={() => onStatusChange(order, 'completed')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                title="Marcar como entregado exitosamente"
              >
                <PackageCheck size={16} />
                Entregado
              </button>
              <button
                onClick={onCancel}
                className="px-3 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200"
                title="Reportar problema con la entrega - Cancelar pedido"
              >
                <AlertTriangle size={16} />
              </button>
            </>
          )}
          <button
            onClick={onViewDetails}
            className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
            title="Ver detalles del pedido"
          >
            <Eye size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Table Actions Component
// Table Actions Component
function TableActions({
  order,
  onStatusChange,
  onAssign,
  onCancel
}: {
  order: Order;
  onStatusChange: (order: Order, status: OrderStatus) => void;
  onAssign: () => void;
  onCancel: () => void;
}) {
  // Buscar tanto "transfer" (nombre interno) como "transferencia" (nombre para mostrar)
  const method = order.paymentMethod?.toLowerCase() || '';
  const isTransfer = method.includes('transfer') || method.includes('transferencia');
  const needsVerification = isTransfer && !order.isReceiptVerified;

  return (
    <>
      {order.status === 'pending' && (
        <>
          <div className="flex items-center gap-2">
            {needsVerification && (
              <div className="relative group">
                <AlertTriangle size={16} className="text-yellow-600" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg text-xs text-yellow-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  ⚠️ Comprobante pendiente de verificación
                </div>
              </div>
            )}
            <button
              onClick={() => onStatusChange(order, 'preparing')}
              className={`p-2 rounded-lg transition-colors ${needsVerification
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
                : 'bg-green-100 text-green-600 hover:bg-green-200'
                }`}
              title={needsVerification ? "⚠️ Comprobante pendiente de verificación - Se recomienda verificar antes de aceptar" : "Aceptar pedido y pasar a preparación"}
            >
              <Play size={16} />
            </button>
          </div>
          <button onClick={onCancel} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Cancelar pedido - El cliente será notificado">
            <XCircle size={16} />
          </button>
        </>
      )}
      {order.status === 'preparing' && (
        <>
          {/* Si es pedido de mesa, permitir marcar como entregado directamente sin repartidor */}
          {order.tableId ? (
            <button onClick={() => onStatusChange(order, 'delivered')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Entregado a la mesa (listo para cobrar)">
              <PackageCheck size={16} />
            </button>
          ) : order.deliveryPersonId ? (
            /* Si ya tiene repartidor asignado, permitir enviar directamente */
            <button onClick={() => onStatusChange(order, 'delivering', order.deliveryPersonId)} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200" title="Enviar pedido al repartidor asignado">
              <Truck size={16} />
            </button>
          ) : (
            <button onClick={onAssign} className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200" title="Asignar repartidor y enviar">
              <UserPlus size={16} />
            </button>
          )}
          <button onClick={onCancel} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Cancelar pedido - El cliente será notificado">
            <XCircle size={16} />
          </button>
        </>
      )}
      {order.status === 'delivering' && (
        <>
          <button onClick={() => onStatusChange(order, 'completed')} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Marcar como entregado exitosamente">
            <PackageCheck size={16} />
          </button>
          <button onClick={onCancel} className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200" title="Reportar problema con la entrega - Cancelar pedido">
            <AlertTriangle size={16} />
          </button>
        </>
      )}
    </>
  );
}


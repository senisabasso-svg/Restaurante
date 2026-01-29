import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, Table as TableIcon, Users, MapPin, Grid, List, Clock, ShoppingCart, CreditCard, X, Printer, Edit, ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal/Modal';
import type { Table, TableStatus, Space, Product, PaymentMethod, Order, Category, SubProduct } from '../types';

const TABLE_STATUSES: { value: TableStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'Available', label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'Occupied', label: 'Ocupada', color: 'text-red-700', bgColor: 'bg-red-100' },
  { value: 'Reserved', label: 'Reservada', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'Cleaning', label: 'Limpieza', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'OrderPlaced', label: 'Pedido Realizado', color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

export default function TablesViewPage() {
  const { user } = useAuth();
  
  // Verificar que el usuario tenga rol Admin o Employee
  if (!user || (user.role !== 'Admin' && user.role !== 'Employee')) {
    return <Navigate to="/admin" replace />;
  }
  
  const [tables, setTables] = useState<Table[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableStatus | ''>('');
  const [spaceFilter, setSpaceFilter] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  
  // Table consumption modal state
  const [isTableConsumptionModalOpen, setIsTableConsumptionModalOpen] = useState(false);
  const [tableForConsumption, setTableForConsumption] = useState<Table | null>(null);
  const [tableConsumptionOrders, setTableConsumptionOrders] = useState<Order[]>([]);
  const [loadingConsumption, setLoadingConsumption] = useState(false);
  
  // Table transfer modal state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  
  // Order creation state
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [tableForOrder, setTableForOrder] = useState<Table | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [orderItems, setOrderItems] = useState<Array<{ id: number; name: string; price: number; quantity: number; subProducts?: Array<{ id: number; name: string; price: number }> }>>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productSubProducts, setProductSubProducts] = useState<SubProduct[]>([]);
  const [selectedSubProducts, setSelectedSubProducts] = useState<number[]>([]);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<string>('cash');
  const [orderComments, setOrderComments] = useState<string>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  // Payment state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tableForPayment, setTableForPayment] = useState<Table | null>(null);
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentProcessed, setPaymentProcessed] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    loadSpaces();
    loadProducts();
    loadPaymentMethods();
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadProducts = async () => {
    try {
      const productsData = await api.getProducts();
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await api.getCategories();
      const validCategories = Array.isArray(categoriesData) 
        ? categoriesData
            .filter(cat => cat && typeof cat === 'object' && 'id' in cat && 'name' in cat)
            .map(cat => ({
              id: Number(cat.id),
              name: String(cat.name || '').trim(),
              description: cat.description ? String(cat.description).trim() : undefined,
              icon: cat.icon ? String(cat.icon).trim() : undefined,
              displayOrder: Number(cat.displayOrder || 0),
              isActive: Boolean(cat.isActive !== false),
              createdAt: cat.createdAt ? String(cat.createdAt) : new Date().toISOString(),
            }))
            .filter(cat => cat.isActive && cat.name)
        : [];
      setCategories(validCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const methods = await api.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const status = statusFilter || undefined;
      const tablesData = await api.getTables(status);
      setTables(tablesData);
    } catch (error) {
      showToast('Error al cargar mesas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaces = async () => {
    try {
      const spacesData = await api.getSpaces();
      setSpaces(spacesData);
    } catch (error) {
      console.error('Error al cargar espacios:', error);
    }
  };

  const getTimeElapsed = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  const filteredTables = tables.filter(table => {
    const matchesSearch = table.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (table.location?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesSpace = !spaceFilter || table.spaceId === spaceFilter;
    return matchesSearch && matchesSpace;
  });

  const getStatusInfo = (status: TableStatus) => {
    return TABLE_STATUSES.find(s => s.value === status) || TABLE_STATUSES[0];
  };

  const openTableConsumptionModal = async (table: Table) => {
    try {
      setLoadingConsumption(true);
      setTableForConsumption(table);
      
      // Sincronizar estado de la mesa primero (si el endpoint está disponible)
      try {
        await api.syncTableStatus(table.id);
        // Recargar la mesa para obtener el estado actualizado
        const updatedTable = await api.getTable(table.id);
        if (updatedTable) {
          setTableForConsumption(updatedTable);
        }
      } catch (error: any) {
        // Si el endpoint no existe (404), simplemente continuar
        // El endpoint puede no estar disponible si el backend no se ha reiniciado
        if (error?.response?.status !== 404) {
          console.error('Error al sincronizar estado de mesa:', error);
        }
      }
      
      // Obtener todos los pedidos primero para debug
      const allOrdersResponse = await api.getOrders({ showArchived: false });
      console.log('Todos los pedidos (respuesta completa):', allOrdersResponse);
      
      // Verificar estructura de la respuesta
      const ordersData = allOrdersResponse?.data || allOrdersResponse || [];
      console.log('Datos de pedidos extraídos:', ordersData);
      console.log('Tipo de datos:', Array.isArray(ordersData) ? 'Array' : typeof ordersData);
      
      // Filtrar manualmente para debug
      const tableIdNum = Number(table.id);
      const matchingOrders = Array.isArray(ordersData) ? ordersData.filter((o: any) => {
        const orderTableId = o.tableId ? Number(o.tableId) : null;
        const matches = orderTableId === tableIdNum;
        // Incluir pedidos activos Y completados (para cobrar), excluir cancelados y archivados
        const shouldInclude = o.status !== 'cancelled' && !o.isArchived;
        if (matches || orderTableId) {
          console.log(`Pedido #${o.id} - tableId: ${orderTableId}, status: ${o.status}, archivado: ${o.isArchived}, matches: ${matches}, incluido: ${shouldInclude}`);
        }
        return matches && shouldInclude;
      }) : [];
      
      console.log('Pedidos que coinciden con mesa', table.id, ':', matchingOrders);
      
      const orders = await api.getOrdersByTable(table.id);
      console.log('Pedidos desde getOrdersByTable:', orders);
      
      // Si getOrdersByTable no devuelve resultados pero encontramos pedidos manualmente, usar esos
      const finalOrders = orders.length > 0 ? orders : matchingOrders;
      console.log('Pedidos finales a mostrar:', finalOrders.length);
      
      setTableConsumptionOrders(finalOrders);
      setIsTableConsumptionModalOpen(true);
    } catch (error: any) {
      console.error('Error al cargar consumo:', error);
      showToast(error.message || 'Error al cargar consumo de la mesa', 'error');
    } finally {
      setLoadingConsumption(false);
    }
  };

  const handleTableClick = async (table: Table) => {
    // Si la mesa está disponible, abrir modal de crear pedido
    if (table.status === 'Available') {
      await openCreateOrderModal(table);
    } else {
      // Si está ocupada o tiene pedidos, abrir modal de consumo
      await openTableConsumptionModal(table);
    }
  };

  const openCreateOrderModal = async (table: Table) => {
    setTableForOrder(table);
    setOrderItems([]);
    setSelectedProductId(null);
    setSelectedCategoryId(null);
    setProductQuantity(1);
    setProductSubProducts([]);
    setSelectedSubProducts([]);
    setOrderPaymentMethod('cash');
    setOrderComments('');
    await loadCategories();
    setIsCreateOrderModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!tableForOrder || orderItems.length === 0) {
      showToast('Debes agregar al menos un producto', 'error');
      return;
    }

    try {
      const cashRegisterStatus = await api.getCashRegisterStatus();
      if (!cashRegisterStatus.isOpen) {
        showToast('Debe abrir la caja antes de crear pedidos desde mesas', 'error');
        return;
      }

      setIsCreatingOrder(true);
      // El método de pago se seleccionará al momento de cobrar, usar 'cash' por defecto
      const response = await api.createOrderFromTable(tableForOrder.id, {
        items: orderItems,
        paymentMethod: 'cash', // Método por defecto, se cambiará al cobrar
        comments: orderComments || undefined,
      });
      
      showToast(`Pedido #${response.id} creado exitosamente desde ${tableForOrder.number}`, 'success');
      setIsCreateOrderModalOpen(false);
      const createdTable = tableForOrder;
      setTableForOrder(null);
      
      // Si la respuesta incluye la mesa actualizada, actualizar el estado local inmediatamente
      if (response.table) {
        setTables(prevTables => 
          prevTables.map(t => t.id === response.table.id ? response.table : t)
        );
      }
      
      // Esperar un momento para que el backend actualice el estado completamente
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Recargar datos de mesas para asegurar que todo esté sincronizado
      await loadData();
      
      // Si había un modal de consumo abierto para esta mesa, recargarlo
      if (isTableConsumptionModalOpen && tableForConsumption?.id === createdTable.id) {
        try {
          const orders = await api.getOrdersByTable(createdTable.id);
          setTableConsumptionOrders(orders);
        } catch (error) {
          console.error('Error al recargar consumo:', error);
        }
      }
    } catch (error: any) {
      showToast(error.message || 'Error al crear el pedido', 'error');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const openPaymentModal = async (table: Table) => {
    try {
      setTableForPayment(table);
      setPaymentProcessed(false); // Resetear estado de pago procesado
      const orders = await api.getOrdersByTable(table.id);
      setTableOrders(orders);
      
      if (orders.length === 0) {
        showToast('No hay pedidos activos para esta mesa', 'error');
        return;
      }
      
      const total = orders.reduce((sum, order) => sum + order.total, 0);
      setTotalAmount(total);
      setSelectedPaymentMethod('cash');
      setIsPaymentModalOpen(true);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar pedidos de la mesa', 'error');
    }
  };

  const handleReimprimirFactura = () => {
    // TODO: Implementar lógica de reimpresión de factura
    showToast('Funcionalidad de reimpresión de factura en desarrollo', 'info');
  };

  const handleIngresarMetodoPago = () => {
    // Volver al formulario de pago para cambiar el método
    setPaymentProcessed(false);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setTableForPayment(null);
    setTableOrders([]);
    setPaymentProcessed(false);
    // Cerrar también el modal de consumo si estaba abierto
    setIsTableConsumptionModalOpen(false);
    setTableForConsumption(null);
    setTableConsumptionOrders([]);
  };

  const enviarTransaccionPOS = async (amount: number) => {
    try {
      const urlString = "https://poslink.hm.opos.com.uy/itdServer/processFinancialPurchase";
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      const transactionDateTime = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
      const amountInCents = Math.round(amount * 100).toString();
      
      const json = {
        "PosID": "1",
        "SystemId": "1",
        "Branch": "1",
        "ClientAppId": "1",
        "UserId": "1",
        "TransactionDateTimeyyyyMMddHHmmssSSS": transactionDateTime,
        "Amount": amountInCents,
        "Quotas": "5",
        "Plan": "0",
        "Currency": "858",
        "TaxRefund": "1",
        "TaxableAmount": "1194400",
        "InvoiceAmount": "1420000"
      };

      const response = await fetch(urlString, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(json),
      });

      if (!response.ok) {
        throw new Error(`Error en respuesta del POS: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error al enviar transacción al POS:', error);
      throw new Error(`Error al comunicarse con el POS: ${error.message}`);
    }
  };

  const handleProcessPayment = async () => {
    if (!tableForPayment || tableOrders.length === 0) {
      return;
    }

    try {
      setIsProcessingPayment(true);
      
      if (selectedPaymentMethod.toLowerCase() === 'pos') {
        try {
          await enviarTransaccionPOS(totalAmount);
          showToast('Transacción POS enviada exitosamente', 'success');
        } catch (error: any) {
          showToast(`Error al enviar transacción POS: ${error.message}`, 'error');
          return;
        }
      }
      
      // Procesar el pago de todos los pedidos
      for (const order of tableOrders) {
        await api.processTablePayment(order.id, selectedPaymentMethod);
        // Archivar el pedido después de procesar el pago para que no siga apareciendo en la mesa
        try {
          await api.archiveOrder(order.id);
        } catch (error: any) {
          console.warn(`No se pudo archivar el pedido ${order.id}:`, error);
          // Continuar aunque falle el archivado
        }
      }
      
      await api.updateTableStatus(tableForPayment.id, 'Available');
      
      showToast(`Pago procesado exitosamente. Total: $${totalAmount.toFixed(2)}`, 'success');
      
      // Marcar que el pago fue procesado para mostrar los botones de acción
      setPaymentProcessed(true);
      
      // Cerrar el modal de consumo si está abierto
      if (isTableConsumptionModalOpen) {
        setIsTableConsumptionModalOpen(false);
        setTableForConsumption(null);
        setTableConsumptionOrders([]);
      }
      
      // Recargar datos de mesas para actualizar el estado visual
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al procesar el pago', 'error');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TableIcon className="text-primary-500" size={32} />
            Mesas
          </h1>
          <p className="text-gray-600 mt-1">Ver mesas y tomar pedidos</p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-md">
          <button
            onClick={() => setViewMode('floor')}
            className={`px-3 py-2 rounded-md transition-colors ${
              viewMode === 'floor' 
                ? 'bg-primary-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Vista de Plano"
          >
            <Grid size={20} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 rounded-md transition-colors ${
              viewMode === 'grid' 
                ? 'bg-primary-500 text-white' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Vista de Lista"
          >
            <List size={20} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            value={spaceFilter}
            onChange={(e) => setSpaceFilter(e.target.value ? parseInt(e.target.value) : '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todos los espacios</option>
            {spaces.map(space => (
              <option key={space.id} value={space.id}>{space.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TableStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todos los estados</option>
            {TABLE_STATUSES.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Floor Plan View */}
      {viewMode === 'floor' ? (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Plano del Salón</h2>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              Click en una mesa para tomar pedido
            </p>
          </div>
          <div
            className="relative w-full h-[700px] rounded-lg border-4 border-green-700 overflow-hidden"
            style={{
              background: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(34, 197, 94, 0.1) 2px,
                  rgba(34, 197, 94, 0.1) 4px
                ),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 2px,
                  rgba(22, 163, 74, 0.1) 2px,
                  rgba(22, 163, 74, 0.1) 4px
                ),
                radial-gradient(
                  circle at 20% 30%,
                  rgba(74, 222, 128, 0.3) 0%,
                  transparent 50%
                ),
                radial-gradient(
                  circle at 80% 70%,
                  rgba(34, 197, 94, 0.3) 0%,
                  transparent 50%
                ),
                linear-gradient(135deg, #4ade80 0%, #22c55e 30%, #16a34a 60%, #15803d 100%)
              `,
              backgroundSize: '4px 4px, 4px 4px, 200px 200px, 200px 200px, 100% 100%',
            }}
          >
            {/* Paredes y áreas del salón */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-0 top-0 w-20 h-full bg-gray-400 border-r-4 border-gray-600 opacity-70"></div>
              <div className="absolute left-20 top-0 right-0 h-24 bg-gray-400 border-b-4 border-gray-600 opacity-70"></div>
              <div className="absolute left-20 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-1/3 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-2/3 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-20 top-24 right-0 h-2 bg-green-300/40"></div>
            </div>

            {filteredTables.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center bg-white/90 p-8 rounded-xl shadow-lg">
                  <TableIcon size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No hay mesas para mostrar</p>
                </div>
              </div>
            ) : (
              filteredTables.map((table) => {
                const statusInfo = getStatusInfo(table.status);
                const getFixedPosition = (id: number, axis: 'x' | 'y') => {
                  const seed = id * (axis === 'x' ? 7919 : 7907);
                  const random = (seed % 1000) / 1000;
                  return axis === 'x' 
                    ? 100 + random * 600
                    : 150 + random * 500;
                };
                const x = table.positionX ?? getFixedPosition(table.id, 'x');
                const y = table.positionY ?? getFixedPosition(table.id, 'y');
                
                const tableSize = Math.max(50, Math.min(80, table.capacity * 10));
                const chairSize = 18;
                const chairOffset = tableSize / 2 + 8;
                
                return (
                  <div
                    key={table.id}
                    className="absolute cursor-pointer z-10 hover:z-20 transition-all"
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onClick={() => handleTableClick(table)}
                  >
                    <div className="relative">
                      {/* Sillas alrededor de la mesa */}
                      {[0, 1, 2, 3].map((pos) => {
                        const positions = [
                          { top: `-${chairOffset}px`, left: '50%', transform: 'translateX(-50%)' },
                          { top: `${chairOffset}px`, left: '50%', transform: 'translateX(-50%)' },
                          { left: `-${chairOffset}px`, top: '50%', transform: 'translateY(-50%)' },
                          { left: `${chairOffset}px`, top: '50%', transform: 'translateY(-50%)' },
                        ];
                        const posStyle = positions[pos];
                        return (
                          <div
                            key={pos}
                            className="absolute rounded-full shadow-lg border-2"
                            style={{
                              ...posStyle,
                              width: `${chairSize}px`,
                              height: `${chairSize}px`,
                              background: statusInfo.value === 'Occupied' 
                                ? 'radial-gradient(circle at 30% 30%, #ef4444, #dc2626 60%, #991b1b 100%)'
                                : statusInfo.value === 'Reserved'
                                ? 'radial-gradient(circle at 30% 30%, #fbbf24, #eab308 60%, #ca8a04 100%)'
                                : statusInfo.value === 'Cleaning'
                                ? 'radial-gradient(circle at 30% 30%, #60a5fa, #3b82f6 60%, #2563eb 100%)'
                                : 'radial-gradient(circle at 30% 30%, #4ade80, #22c55e 60%, #16a34a 100%)',
                              borderColor: statusInfo.value === 'Occupied' 
                                ? '#991b1b'
                                : statusInfo.value === 'Reserved'
                                ? '#ca8a04'
                                : statusInfo.value === 'Cleaning'
                                ? '#2563eb'
                                : '#16a34a',
                            }}
                          >
                            <div
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full shadow-md"
                              style={{
                                width: '8px',
                                height: '8px',
                                bottom: '-4px',
                                background: 'radial-gradient(circle at 30% 30%, #e5e7eb, #9ca3af 60%, #6b7280 100%)',
                                border: '1px solid #4b5563',
                              }}
                            ></div>
                          </div>
                        );
                      })}
                      
                      {/* Mesa cuadrada marrón */}
                      <div
                        className="rounded-lg shadow-2xl transition-all border-2 relative"
                        style={{
                          width: `${tableSize}px`,
                          height: `${tableSize}px`,
                          background: (table.status === 'Occupied' || table.status === 'OrderPlaced')
                            ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)'
                            : 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
                          borderColor: (table.status === 'Occupied' || table.status === 'OrderPlaced')
                            ? '#dc2626'
                            : '#451a03',
                          boxShadow: (table.status === 'Occupied' || table.status === 'OrderPlaced')
                            ? '0 10px 25px rgba(220, 38, 38, 0.5), inset 0 2px 5px rgba(255,255,255,0.1), 0 0 20px rgba(220, 38, 38, 0.3)'
                            : '0 10px 25px rgba(0,0,0,0.3), inset 0 2px 5px rgba(255,255,255,0.1)',
                        }}
                      >
                        {/* Badge de "ABIERTA" cuando está ocupada */}
                        {(table.status === 'Occupied' || table.status === 'OrderPlaced') && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg z-10 animate-pulse">
                            ABIERTA
                          </div>
                        )}
                        <div
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-gray-300 border-2 border-gray-400 shadow-lg"
                          style={{
                            width: '12px',
                            height: '12px',
                            bottom: '-6px',
                          }}
                        ></div>
                        
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-white text-center drop-shadow-lg">
                            <div className="text-sm font-bold">{table.number}</div>
                            <div className="text-[10px] opacity-90">{table.capacity}p</div>
                            {(table.status === 'OrderPlaced' || table.status === 'Occupied') && table.orderPlacedAt && (
                              <div className="text-[9px] mt-1 opacity-90 flex items-center justify-center gap-1">
                                <Clock size={8} />
                                {getTimeElapsed(table.orderPlacedAt)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTableClick(table);
                            }}
                            className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-1 transition-colors z-50"
                            title={table.status === 'Available' ? 'Crear pedido' : 'Ver consumo'}
                          >
                            <ShoppingCart size={12} />
                            {table.status === 'Available' ? 'Pedido' : 'Ver'}
                          </button>
                        </div>
                        
                        <div 
                          className="absolute rounded-lg bg-black/30 blur-md"
                          style={{
                            width: `${tableSize * 1.2}px`,
                            height: `${tableSize * 0.3}px`,
                            bottom: `-${tableSize * 0.15}px`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Leyenda de áreas */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs border-2 border-green-200">
              <div className="font-semibold mb-2 text-gray-800">Áreas del Salón</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-400 rounded border border-gray-600"></div>
                  <span>Baños / Cocina</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-400 rounded border-2 border-green-600"></div>
                  <span>Área Verde (Comedor)</span>
                </div>
              </div>
            </div>
            
            {/* Leyenda de estados */}
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-lg text-xs border-2 border-green-200">
              <div className="font-semibold mb-2 text-gray-800">Estados</div>
              <div className="space-y-1">
                {TABLE_STATUSES.map(status => (
                  <div key={status.value} className="flex items-center gap-2">
                    <div className={`w-4 h-4 ${status.bgColor} rounded-full border-2 ${status.color} border-current`}></div>
                    <span>{status.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTables.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-md p-12 text-center">
              <TableIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No hay mesas para mostrar</p>
            </div>
          ) : (
            filteredTables.map((table) => {
              const statusInfo = getStatusInfo(table.status);
              return (
                <div
                  key={table.id}
                  className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 cursor-pointer relative ${
                    (table.status === 'Occupied' || table.status === 'OrderPlaced')
                      ? 'border-red-400 hover:border-red-500 bg-red-50/30'
                      : 'border-transparent hover:border-primary-200'
                  }`}
                  onClick={() => handleTableClick(table)}
                >
                  {/* Badge de "ABIERTA" cuando está ocupada */}
                  {(table.status === 'Occupied' || table.status === 'OrderPlaced') && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg z-10 animate-pulse">
                      ABIERTA
                    </div>
                  )}
                  
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <TableIcon size={24} className={
                          (table.status === 'Occupied' || table.status === 'OrderPlaced')
                            ? 'text-red-500'
                            : 'text-primary-500'
                        } />
                        {table.number}
                      </h3>
                      <p className="text-sm text-gray-500">ID: #{table.id}</p>
                      {(table.status === 'OrderPlaced' || table.status === 'Occupied') && table.orderPlacedAt && (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-semibold">
                          <Clock size={12} />
                          Pedido hace {getTimeElapsed(table.orderPlacedAt)}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users size={16} />
                      <span className="text-sm">Capacidad: {table.capacity} personas</span>
                    </div>
                    {table.location && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin size={16} />
                        <span className="text-sm">{table.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTableClick(table);
                      }}
                      className="w-full px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={16} />
                      {table.status === 'Available' ? 'Crear Pedido' : 'Ver Consumo'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create Order Modal - Reutilizar el mismo modal del componente Tables.tsx */}
      <Modal
        isOpen={isCreateOrderModalOpen}
        onClose={() => {
          setIsCreateOrderModalOpen(false);
          setTableForOrder(null);
          setOrderItems([]);
          setSelectedCategoryId(null);
          setSelectedProductId(null);
          setProductSubProducts([]);
          setSelectedSubProducts([]);
        }}
        title={`Crear Pedido - ${tableForOrder?.number}`}
        size="4xl"
      >
        <div className="space-y-4">
          {/* Selección de Categoría */}
          {!selectedCategoryId ? (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Selecciona una Categoría
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {categories
                  .filter(cat => cat && typeof cat === 'object' && 'id' in cat && 'name' in cat)
                  .map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
                    >
                      {category.icon && category.icon.startsWith('/') ? (
                        <img 
                          src={category.icon} 
                          alt={category.name}
                          className="w-12 h-12 object-contain mb-2"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = document.createElement('span');
                            fallback.className = 'text-3xl mb-2';
                            fallback.textContent = '📦';
                            target.parentNode?.replaceChild(fallback, target);
                          }}
                        />
                      ) : (
                        <span className="text-3xl mb-2">{category.icon || '📦'}</span>
                      )}
                      <span className="text-sm font-medium text-gray-700 text-center">
                        {String(category.name || '').trim() || 'Sin nombre'}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedCategoryId(null);
                  setSelectedProductId(null);
                }}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ← Volver a Categorías
              </button>

              <div className="flex items-center gap-2 pb-2 border-b">
                {(() => {
                  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
                  const icon = selectedCategory?.icon;
                  return icon && icon.startsWith('/') ? (
                    <img 
                      src={icon} 
                      alt={selectedCategory?.name || 'Categoría'}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = document.createElement('span');
                        fallback.className = 'text-2xl';
                        fallback.textContent = '📦';
                        target.parentNode?.replaceChild(fallback, target);
                      }}
                    />
                  ) : (
                    <span className="text-2xl">{icon || '📦'}</span>
                  );
                })()}
                <span className="text-lg font-semibold text-gray-800">
                  {categories.find(c => c.id === selectedCategoryId)?.name}
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Selecciona un Producto
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  {products
                    .filter(p => p.categoryId === selectedCategoryId && p.isAvailable)
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={async () => {
                          setSelectedProductId(product.id);
                          setProductQuantity(1);
                          setSelectedSubProducts([]);
                          try {
                            const subProducts = await api.getSubProductsByProduct(product.id);
                            setProductSubProducts(subProducts.filter(sp => sp.isAvailable));
                          } catch (error) {
                            console.error('Error loading subproducts:', error);
                            setProductSubProducts([]);
                          }
                        }}
                        className={`p-3 border-2 rounded-lg text-left transition-all ${
                          selectedProductId === product.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-gray-800">{product.name}</div>
                        {product.description && (
                          <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {product.description}
                          </div>
                        )}
                        <div className="text-sm font-bold text-primary-600 mt-2">
                          ${product.price.toFixed(2)}
                        </div>
                      </button>
                    ))}
                </div>

                {products.filter(p => p.categoryId === selectedCategoryId && p.isAvailable).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos disponibles en esta categoría
                  </div>
                )}
              </div>

              {selectedProductId && productSubProducts.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="block text-sm font-medium text-gray-700">
                    Guarniciones (opcional)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {productSubProducts.map((subProduct) => (
                      <label
                        key={subProduct.id}
                        className="flex items-center gap-2 p-2 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubProducts.includes(subProduct.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubProducts([...selectedSubProducts, subProduct.id]);
                            } else {
                              setSelectedSubProducts(selectedSubProducts.filter(id => id !== subProduct.id));
                            }
                          }}
                          className="w-4 h-4 text-primary-500 rounded focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-800">{subProduct.name}</div>
                          <div className="text-xs text-primary-600">+${subProduct.price.toFixed(2)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedProductId && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-medium text-gray-700">Cantidad:</label>
                    <input
                      type="number"
                      min="1"
                      value={productQuantity}
                      onChange={(e) => setProductQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (selectedProductId) {
                        const product = products.find(p => p.id === selectedProductId);
                        if (product) {
                          const selectedSubs = productSubProducts.filter(sp => selectedSubProducts.includes(sp.id));
                          const subProductsTotal = selectedSubs.reduce((sum, sp) => sum + sp.price, 0);
                          
                          setOrderItems([...orderItems, {
                            id: product.id,
                            name: product.name,
                            price: product.price + subProductsTotal,
                            quantity: productQuantity,
                            subProducts: selectedSubs.map(sp => ({
                              id: sp.id,
                              name: sp.name,
                              price: sp.price
                            }))
                          }]);
                          setSelectedProductId(null);
                          setProductQuantity(1);
                          setSelectedSubProducts([]);
                          setProductSubProducts([]);
                        }
                      }
                    }}
                    className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={18} />
                    Agregar al Pedido
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lista de Productos */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Productos del Pedido
              </label>
              <div className="border border-gray-200 rounded-lg divide-y">
                {orderItems.map((item, index) => (
                  <div key={index} className="p-3 flex items-center justify-between border-b last:border-b-0">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      {item.subProducts && item.subProducts.length > 0 && (
                        <div className="text-xs text-gray-600 mt-1 ml-2">
                          + {item.subProducts.map(sp => sp.name).join(', ')}
                        </div>
                      )}
                      <div className="text-sm text-gray-500">
                        {item.quantity}x ${item.price.toFixed(2)} = ${(item.quantity * item.price).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-right font-bold text-lg">
                Total: ${orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}
              </div>
            </div>
          )}

          {/* Comentarios */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Comentarios (opcional)
            </label>
            <textarea
              value={orderComments}
              onChange={(e) => setOrderComments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Notas especiales para el pedido..."
            />
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsCreateOrderModalOpen(false);
                setTableForOrder(null);
                setOrderItems([]);
                setSelectedCategoryId(null);
                setSelectedProductId(null);
                setProductSubProducts([]);
                setSelectedSubProducts([]);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateOrder}
              disabled={isCreatingOrder || orderItems.length === 0}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isCreatingOrder ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  Crear Pedido
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Table Consumption Modal */}
      <Modal
        isOpen={isTableConsumptionModalOpen}
        onClose={() => {
          setIsTableConsumptionModalOpen(false);
          setTableForConsumption(null);
          setTableConsumptionOrders([]);
        }}
        title={tableForConsumption ? `🪑 Mesa #${tableForConsumption.number} - ${getStatusInfo(tableForConsumption.status).label}` : 'Consumo de Mesa'}
        size="4xl"
      >
        {loadingConsumption ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando consumo...</p>
            </div>
          </div>
        ) : tableForConsumption ? (
          <div className="space-y-6">
            {/* Información de la Mesa */}
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                📊 Información de la Mesa
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500">Número</label>
                  <p className="text-sm font-semibold text-gray-800">#{tableForConsumption.number}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Capacidad</label>
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                    <Users size={14} />
                    {tableForConsumption.capacity} personas
                  </p>
                </div>
                {tableForConsumption.location && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Ubicación</label>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                      <MapPin size={14} />
                      {tableForConsumption.location}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-500">Estado</label>
                  <p className={`text-sm font-semibold px-2 py-1 rounded-full inline-block ${getStatusInfo(tableForConsumption.status).bgColor} ${getStatusInfo(tableForConsumption.status).color}`}>
                    {getStatusInfo(tableForConsumption.status).label}
                  </p>
                </div>
              </div>
              {tableForConsumption.orderPlacedAt && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Clock size={12} />
                    Tiempo ocupada: {getTimeElapsed(tableForConsumption.orderPlacedAt)}
                  </p>
                </div>
              )}
            </div>

            {/* Consumo Actual */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                📋 Consumo Actual
              </h3>
              {!tableConsumptionOrders || tableConsumptionOrders.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center border-2 border-dashed border-gray-300">
                  <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium">No hay pedidos activos en esta mesa</p>
                  <p className="text-sm text-gray-400 mt-2">Puedes crear un nuevo pedido</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-4 border-2 border-gray-200 shadow-sm max-h-96 overflow-y-auto">
                  <div className="space-y-4">
                    {(tableConsumptionOrders || []).map((order) => {
                      const isCompleted = order.status === 'completed';
                      const isPreparing = order.status === 'preparing';
                      const isPending = order.status === 'pending';
                      
                      return (
                        <div 
                          key={order.id} 
                          className={`border rounded-lg p-3 ${isCompleted ? 'bg-green-50 border-green-200' : isPreparing ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}
                        >
                          {/* Header del pedido con estado */}
                          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">Pedido #{order.id}</span>
                              {isCompleted && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  ✅ Listo
                                </span>
                              )}
                              {isPreparing && (
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                  🔥 Preparando
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                  ⏳ Pendiente
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              ${order.total.toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Items del pedido */}
                          <div className="space-y-1">
                            {order.items && Array.isArray(order.items) && order.items.map((item, idx) => {
                              if (!item || !item.productName) return null;
                              
                              const itemId = item.id ?? (item as any).Id ?? null;
                              
                              const handleDeleteItem = async () => {
                                if (!itemId || itemId === 0) {
                                  showToast('No se puede eliminar: el item no tiene un ID válido', 'error');
                                  return;
                                }
                                
                                if (!confirm(`¿Estás seguro de eliminar "${item.productName}" del pedido?`)) {
                                  return;
                                }
                                
                                try {
                                  await api.deleteOrderItem(order.id, itemId);
                                  showToast(`"${item.productName}" eliminado correctamente`, 'success');
                                  
                                  // Recargar consumo
                                  const orders = await api.getOrdersByTable(tableForConsumption!.id);
                                  setTableConsumptionOrders(orders);
                                  
                                  // Recargar datos de mesas para actualizar estado si es necesario
                                  await loadData();
                                } catch (error: any) {
                                  showToast(error.message || 'Error al eliminar el item', 'error');
                                }
                              };
                              
                              return (
                                <div key={`${order.id}-${itemId}-${idx}`} className="flex items-start justify-between text-sm py-1">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-800">
                                      • {item.productName}
                                      {item.quantity > 1 && (
                                        <span className="text-gray-500 ml-1">x{item.quantity}</span>
                                      )}
                                    </div>
                                    {item.subProducts && Array.isArray(item.subProducts) && item.subProducts.length > 0 && (
                                      <div className="text-xs text-gray-600 mt-1 ml-4">
                                        └─ Guarniciones: {item.subProducts
                                          .filter(sp => sp && sp.name)
                                          .map(sp => sp.name)
                                          .join(', ')}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 ml-4">
                                    <div className="text-right">
                                      <div className="font-medium text-gray-700">
                                        ${(item.unitPrice * item.quantity).toFixed(2)}
                                      </div>
                                    </div>
                                    {!isCompleted && itemId && itemId > 0 && (
                                      <button
                                        onClick={handleDeleteItem}
                                        className="p-1 text-red-600 hover:bg-red-50 active:bg-red-100 rounded transition-colors flex-shrink-0"
                                        title="Eliminar item"
                                      >
                                        <X size={16} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Resumen */}
            {tableConsumptionOrders.length > 0 && (
              <div className="bg-primary-50 rounded-lg p-4 border-2 border-primary-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  💰 Resumen
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total de Pedidos:</span>
                    <span className="font-semibold text-gray-800">{tableConsumptionOrders.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total de Items:</span>
                    <span className="font-semibold text-gray-800">
                      {(tableConsumptionOrders || []).reduce((sum, order) => sum + (order?.items && Array.isArray(order.items) ? order.items.length : 0), 0)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-primary-200 flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-700">💵 TOTAL A COBRAR:</span>
                    <span className="text-2xl font-bold text-primary-600">
                      ${(tableConsumptionOrders || []).reduce((sum, order) => sum + (order?.total || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                ⚙️ Acciones
              </h3>
              <div className="flex flex-col gap-3">
                {/* Si no hay pedidos activos y la mesa está ocupada, mostrar opciones para liberar */}
                {(!tableConsumptionOrders || tableConsumptionOrders.length === 0) && 
                 (tableForConsumption?.status === 'Occupied' || tableForConsumption?.status === 'OrderPlaced') && (
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        if (!tableForConsumption) return;
                        try {
                          await api.syncTableStatus(tableForConsumption.id);
                          showToast('Estado de mesa sincronizado', 'success');
                          // Recargar la mesa
                          const updatedTable = await api.getTable(tableForConsumption.id);
                          if (updatedTable) {
                            setTableForConsumption(updatedTable);
                          }
                          await loadData();
                        } catch (error: any) {
                          // Si el endpoint no existe, intentar usar freeTable directamente
                          if (error?.response?.status === 404) {
                            try {
                              await api.freeTable(tableForConsumption.id);
                              showToast('Mesa liberada exitosamente', 'success');
                              const updatedTable = await api.getTable(tableForConsumption.id);
                              if (updatedTable) {
                                setTableForConsumption(updatedTable);
                              }
                              await loadData();
                            } catch (freeError: any) {
                              showToast(freeError.message || 'Error al liberar la mesa', 'error');
                            }
                          } else {
                            showToast(error.message || 'Error al sincronizar', 'error');
                          }
                        }
                      }}
                      className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Clock size={20} />
                      Sincronizar Estado
                    </button>
                    <button
                      onClick={async () => {
                        if (!tableForConsumption) return;
                        try {
                          // Intentar sincronizar primero (si está disponible)
                          try {
                            await api.syncTableStatus(tableForConsumption.id);
                          } catch (syncError: any) {
                            // Si falla, continuar con freeTable
                            if (syncError?.response?.status !== 404) {
                              console.error('Error al sincronizar:', syncError);
                            }
                          }
                          // Luego liberar
                          await api.freeTable(tableForConsumption.id);
                          showToast('Mesa liberada exitosamente', 'success');
                          setIsTableConsumptionModalOpen(false);
                          await loadData();
                        } catch (error: any) {
                          showToast(error.message || 'Error al liberar la mesa', 'error');
                        }
                      }}
                      className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <X size={20} />
                      Liberar Mesa
                    </button>
                  </div>
                )}
                {/* Botón de transferencia si hay pedidos activos */}
                {tableConsumptionOrders && tableConsumptionOrders.length > 0 && (
                  <button
                    onClick={() => {
                      setIsTransferModalOpen(true);
                    }}
                    className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <ArrowRight size={20} />
                    Transferir a Otra Mesa
                  </button>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setIsTableConsumptionModalOpen(false);
                      if (tableForConsumption) {
                        openCreateOrderModal(tableForConsumption);
                      }
                    }}
                    className="flex-1 px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    Agregar Productos
                  </button>
                  {tableConsumptionOrders && tableConsumptionOrders.length > 0 && (
                    <button
                      onClick={() => {
                        setIsTableConsumptionModalOpen(false);
                        if (tableForConsumption) {
                          openPaymentModal(tableForConsumption);
                        }
                      }}
                      className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <CreditCard size={20} />
                      Cobrar ${(tableConsumptionOrders || []).reduce((sum, order) => sum + (order?.total || 0), 0).toFixed(2)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Transfer Table Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title={`Transferir Pedidos - Mesa ${tableForConsumption?.number}`}
        size="md"
      >
        {tableForConsumption && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Mesa Origen:</strong> Mesa {tableForConsumption.number}
              </p>
              <p className="text-sm text-gray-700">
                <strong>Pedidos a transferir:</strong> {tableConsumptionOrders.length} pedido(s) activo(s)
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Total: ${(tableConsumptionOrders || []).reduce((sum, order) => sum + (order?.total || 0), 0).toFixed(2)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecciona la Mesa Destino (debe estar disponible):
              </label>
              <div className="max-h-64 overflow-y-auto border-2 border-gray-200 rounded-lg">
                {tables
                  .filter(t => t.id !== tableForConsumption.id && t.status === 'Available' && t.isActive)
                  .length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <TableIcon size={48} className="mx-auto mb-2 text-gray-300" />
                    <p>No hay mesas disponibles para transferir</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {tables
                      .filter(t => t.id !== tableForConsumption.id && t.status === 'Available' && t.isActive)
                      .map(table => (
                        <button
                          key={table.id}
                          onClick={async () => {
                            if (!tableForConsumption) return;
                            
                            if (!confirm(`¿Transferir ${tableConsumptionOrders.length} pedido(s) de la Mesa ${tableForConsumption.number} a la Mesa ${table.number}?`)) {
                              return;
                            }

                            try {
                              setIsTransferring(true);
                              const result = await api.transferTableOrders(tableForConsumption.id, table.id);
                              showToast(result.message, 'success');
                              setIsTransferModalOpen(false);
                              setIsTableConsumptionModalOpen(false);
                              await loadData();
                              // Forzar recarga de pedidos activos si la página está abierta
                              // SignalR debería actualizar automáticamente, pero esto es un respaldo
                              if (window.location.pathname.includes('/admin/active-orders')) {
                                window.location.reload();
                              }
                            } catch (error: any) {
                              showToast(error.message || 'Error al transferir los pedidos', 'error');
                            } finally {
                              setIsTransferring(false);
                            }
                          }}
                          disabled={isTransferring}
                          className="p-4 border-2 border-green-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <TableIcon size={20} className="text-green-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800">Mesa {table.number}</p>
                              <p className="text-xs text-gray-500">Capacidad: {table.capacity} personas</p>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {isTransferring && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Transfiriendo pedidos...</p>
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                disabled={isTransferring}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={handleClosePaymentModal}
        title={paymentProcessed ? `Pago Procesado - Mesa ${tableForPayment?.number}` : `Cobrar - Mesa ${tableForPayment?.number}`}
        size="md"
      >
        {paymentProcessed ? (
          // Vista después de procesar el pago
          <div className="space-y-4">
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CreditCard size={24} className="text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-green-800 mb-1">¡Pago Procesado Exitosamente!</p>
                <p className="text-2xl font-bold text-green-600">
                  ${totalAmount.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Método: {paymentMethods.find(m => m.name === selectedPaymentMethod)?.displayName || selectedPaymentMethod}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <button
                onClick={handleReimprimirFactura}
                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Reimprimir Factura
              </button>
              <button
                onClick={handleIngresarMetodoPago}
                className="w-full px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Edit size={20} />
                Ingresar Método de Pago
              </button>
              <button
                onClick={handleClosePaymentModal}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          // Vista del formulario de pago
          <div className="space-y-4">
            {tableOrders.length > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Pedidos de la Mesa
                </label>
                <div className="border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                  {tableOrders.map((order) => (
                    <div key={order.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Pedido #{order.id}</div>
                          <div className="text-xs text-gray-500">
                            {order.items?.length || 0} items
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            ${order.total.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-700">Total a Cobrar:</span>
                <span className="text-2xl font-bold text-green-600">
                  ${totalAmount.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Método de Pago *
              </label>
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.name}>
                    {method.displayName || method.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={handleClosePaymentModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={isProcessingPayment || tableOrders.length === 0}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingPayment ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Cobrar ${totalAmount.toFixed(2)}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

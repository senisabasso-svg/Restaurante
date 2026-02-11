import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, Table as TableIcon, Users, MapPin, Grid, List, Move, Building2, X, Clock, ShoppingCart, CreditCard, DollarSign } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import OpenCashRegisterModal from '../components/Modal/OpenCashRegisterModal';
import CloseCashRegisterModal from '../components/Modal/CloseCashRegisterModal';
import HelpIcon from '../components/HelpIcon/HelpIcon';
import type { Table, CreateTableRequest, UpdateTableRequest, TableStatus, Space, CreateSpaceRequest, Product, PaymentMethod, Order, Category, SubProduct, CashRegisterStatus } from '../types';

const TABLE_STATUSES: { value: TableStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'Available', label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'Occupied', label: 'Ocupada', color: 'text-red-700', bgColor: 'bg-red-100' },
  { value: 'Reserved', label: 'Reservada', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'Cleaning', label: 'Limpieza', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'OrderPlaced', label: 'Pedido Realizado', color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableStatus | ''>('');
  const [spaceFilter, setSpaceFilter] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [draggedTable, setDraggedTable] = useState<Table | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState(false); // Modo para mover mesas
  const floorPlanRef = useRef<HTMLDivElement>(null);
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [deleteTable, setDeleteTable] = useState<Table | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [deleteSpace, setDeleteSpace] = useState<Space | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateTableRequest>({
    number: '',
    capacity: 4,
    location: '',
    status: 'Available',
    notes: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  
  // Space form state
  const [spaceFormData, setSpaceFormData] = useState<CreateSpaceRequest>({
    name: '',
    description: '',
  });
  const [spaceFormLoading, setSpaceFormLoading] = useState(false);

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
  
  // POS waiting modal state
  const [isPOSWaitingModalOpen, setIsPOSWaitingModalOpen] = useState(false);
  const [posStatusMessage, setPosStatusMessage] = useState<string>('Esperando respuesta del POS...');
  const [posPollingAttempt, setPosPollingAttempt] = useState<number>(0);

  // Cash Register state
  const [cashRegisterStatus, setCashRegisterStatus] = useState<CashRegisterStatus | null>(null);
  const [isOpenCashRegisterModalOpen, setIsOpenCashRegisterModalOpen] = useState(false);
  const [isCloseCashRegisterModalOpen, setIsCloseCashRegisterModalOpen] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    loadSpaces();
    loadProducts();
    loadPaymentMethods();
    loadCashRegisterStatus();
  }, []);

  const loadCashRegisterStatus = async () => {
    try {
      const status = await api.getCashRegisterStatus();
      setCashRegisterStatus(status);
    } catch (error) {
      console.error('Error al cargar estado de caja:', error);
    }
  };

  const handleOpenCashRegister = async (initialAmount: number) => {
    try {
      await api.openCashRegister(initialAmount);
      showToast('Caja abierta exitosamente', 'success');
      await loadCashRegisterStatus();
    } catch (error: any) {
      showToast(error.message || 'Error al abrir la caja', 'error');
      throw error;
    }
  };

  const handleCloseCashRegister = async (notes?: string) => {
    try {
      await api.closeCashRegister(notes);
      showToast('Caja cerrada exitosamente', 'success');
      await loadCashRegisterStatus();
    } catch (error: any) {
      showToast(error.message || 'Error al cerrar la caja', 'error');
      throw error;
    }
  };

  // Función para calcular tiempo transcurrido
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
      console.log('Categories data received:', categoriesData);
      
      // Validar y limpiar los datos
      const validCategories = Array.isArray(categoriesData) 
        ? categoriesData
            .filter(cat => {
              // Asegurarse de que es un objeto válido con las propiedades necesarias
              if (!cat || typeof cat !== 'object') return false;
              if (!('id' in cat) || !('name' in cat)) return false;
              return true;
            })
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
      
      console.log('Valid categories:', validCategories);
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

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const status = statusFilter || undefined;
      // Forzar sincronización llamando sin filtro primero para que se sincronicen todas
      if (!status) {
        // Si no hay filtro, llamar sin parámetros para que sincronice todas las mesas
        const tablesData = await api.getTables();
        setTables(tablesData);
      } else {
        // Si hay filtro, primero sincronizar todas y luego filtrar
        const allTables = await api.getTables();
        const filtered = status ? allTables.filter(t => t.status === status) : allTables;
        setTables(filtered);
      }
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
      showToast('Error al cargar espacios', 'error');
    }
  };

  const openCreateModal = () => {
    setEditingTable(null);
    setFormData({
      number: '',
      capacity: 4,
      location: '',
      status: 'Available',
      notes: '',
      spaceId: spaceFilter ? (typeof spaceFilter === 'number' ? spaceFilter : parseInt(spaceFilter)) : undefined,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (table: Table) => {
    setEditingTable(table);
    setFormData({
      number: table.number,
      capacity: table.capacity,
      location: table.location || '',
      status: table.status,
      notes: table.notes || '',
      spaceId: table.spaceId || undefined,
    });
    setIsFormModalOpen(true);
  };

  const openCreateSpaceModal = () => {
    setSpaceFormData({
      name: '',
      description: '',
    });
    setIsSpaceModalOpen(true);
  };

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!spaceFormData.name.trim()) {
      showToast('El nombre del espacio es requerido', 'error');
      return;
    }

    try {
      setSpaceFormLoading(true);
      await api.createSpace(spaceFormData);
      showToast('Espacio creado exitosamente', 'success');
      setIsSpaceModalOpen(false);
      setSpaceFormData({ name: '', description: '' });
      loadSpaces();
    } catch (error: any) {
      console.error('Error al crear espacio:', error);
      const errorMessage = error?.message || error?.error || 'Error al crear el espacio';
      showToast(errorMessage, 'error');
    } finally {
      setSpaceFormLoading(false);
    }
  };

  const handleDeleteSpace = async () => {
    if (!deleteSpace) return;

    try {
      await api.deleteSpace(deleteSpace.id);
      showToast('Espacio eliminado exitosamente', 'success');
      setDeleteSpace(null);
      loadSpaces();
      loadData(); // Recargar mesas por si se eliminaron algunas
    } catch (error: any) {
      showToast(error.message || 'Error al eliminar el espacio', 'error');
    }
  };

  const [tableHasActiveOrders, setTableHasActiveOrders] = useState(false);
  const [isCheckingOrders, setIsCheckingOrders] = useState(false);
  const [isFreeingTable, setIsFreeingTable] = useState(false);

  const openDetailsModal = async (table: Table) => {
    setSelectedTable(table);
    setIsDetailsModalOpen(true);
    
    // Sincronizar estado de la mesa primero
    try {
      await api.syncTableStatus(table.id);
    } catch (error) {
      console.error('Error al sincronizar estado de mesa:', error);
    }
    
    // Verificar si la mesa tiene pedidos activos
    try {
      setIsCheckingOrders(true);
      const orders = await api.getOrdersByTable(table.id);
      setTableHasActiveOrders(orders.length > 0);
      
      // Recargar la mesa para obtener el estado actualizado
      const updatedTable = await api.getTable(table.id);
      if (updatedTable) {
        setSelectedTable(updatedTable);
      }
    } catch (error) {
      console.error('Error al verificar pedidos:', error);
      setTableHasActiveOrders(false);
    } finally {
      setIsCheckingOrders(false);
    }
  };

  const handleFreeTable = async () => {
    if (!selectedTable) return;

    try {
      setIsFreeingTable(true);
      // Sincronizar primero
      await api.syncTableStatus(selectedTable.id);
      // Luego liberar
      await api.freeTable(selectedTable.id);
      showToast('Mesa liberada exitosamente', 'success');
      setIsDetailsModalOpen(false);
      loadData(); // Recargar mesas para actualizar estado
    } catch (error: any) {
      showToast(error.message || 'Error al liberar la mesa', 'error');
    } finally {
      setIsFreeingTable(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.number.trim()) {
      showToast('El número de mesa es requerido', 'error');
      return;
    }
    if (formData.capacity <= 0) {
      showToast('La capacidad debe ser mayor a 0', 'error');
      return;
    }

    try {
      setFormLoading(true);
      if (editingTable) {
        const updateData: UpdateTableRequest = {
          number: formData.number,
          capacity: formData.capacity,
          location: formData.location || undefined,
          status: formData.status,
          notes: formData.notes || undefined,
          spaceId: formData.spaceId !== undefined ? formData.spaceId : undefined,
        };
        await api.updateTable(editingTable.id, updateData);
        showToast('Mesa actualizada exitosamente', 'success');
      } else {
        await api.createTable(formData);
        showToast('Mesa creada exitosamente', 'success');
      }
      setIsFormModalOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error al guardar mesa:', error);
      const errorMessage = error?.message || error?.error || 'Error al guardar la mesa';
      showToast(errorMessage, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTable) return;

    try {
      await api.deleteTable(deleteTable.id);
      showToast('Mesa eliminada exitosamente', 'success');
      setDeleteTable(null);
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al eliminar la mesa', 'error');
    }
  };

  const handleStatusChange = async (table: Table, newStatus: TableStatus) => {
    try {
      await api.updateTableStatus(table.id, newStatus);
      showToast(`Estado de mesa actualizado a ${TABLE_STATUSES.find(s => s.value === newStatus)?.label}`, 'success');
      loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al actualizar el estado', 'error');
    }
  };

  // Drag and Drop handlers
  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!editMode) return; // Solo permitir mover en modo edición
    e.preventDefault();
    setDraggedTable(table);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedTable || !floorPlanRef.current) return;

    const rect = floorPlanRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Actualizar posición visualmente
    setTables(prev => prev.map(t => 
      t.id === draggedTable.id 
        ? { ...t, positionX: x, positionY: y }
        : t
    ));
  };

  const handleMouseUp = async () => {
    if (!isDragging || !draggedTable) return;

    const table = tables.find(t => t.id === draggedTable.id);
    if (table && (table.positionX !== draggedTable.positionX || table.positionY !== draggedTable.positionY)) {
      try {
        await api.updateTable(table.id, {
          positionX: table.positionX,
          positionY: table.positionY,
        });
        showToast('Posición de mesa guardada', 'success');
      } catch (error: any) {
        showToast('Error al guardar la posición', 'error');
        loadData(); // Revertir cambios
      }
    }

    setIsDragging(false);
    setDraggedTable(null);
  };

  // Filter tables
  const filteredTables = tables.filter(table => {
    const matchesSearch = table.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (table.location?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesSpace = !spaceFilter || table.spaceId === spaceFilter;
    return matchesSearch && matchesSpace;
  });

  const getStatusInfo = (status: TableStatus) => {
    return TABLE_STATUSES.find(s => s.value === status) || TABLE_STATUSES[0];
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
    // Cargar categorías cuando se abre el modal
    await loadCategories();
    setIsCreateOrderModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!tableForOrder || orderItems.length === 0) {
      showToast('Debes agregar al menos un producto', 'error');
      return;
    }

    try {
      // Verificar que la caja esté abierta
      const cashRegisterStatus = await api.getCashRegisterStatus();
      if (!cashRegisterStatus.isOpen) {
        showToast('Debe abrir la caja antes de crear pedidos desde mesas', 'error');
        return;
      }

      setIsCreatingOrder(true);
      const response = await api.createOrderFromTable(tableForOrder.id, {
        items: orderItems,
        paymentMethod: orderPaymentMethod,
        comments: orderComments || undefined,
      });
      
      showToast(`Pedido #${response.id} creado exitosamente desde ${tableForOrder.number}`, 'success');
      setIsCreateOrderModalOpen(false);
      setTableForOrder(null);
      loadData(); // Recargar mesas para actualizar estado
    } catch (error: any) {
      showToast(error.message || 'Error al crear el pedido', 'error');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const openPaymentModal = async (table: Table) => {
    try {
      setTableForPayment(table);
      // Obtener pedidos activos de la mesa
      const orders = await api.getOrdersByTable(table.id);
      setTableOrders(orders);
      
      if (orders.length === 0) {
        showToast('No hay pedidos activos para esta mesa', 'error');
        return;
      }
      
      // Calcular el total de todos los pedidos
      const total = orders.reduce((sum, order) => sum + order.total, 0);
      setTotalAmount(total);
      setSelectedPaymentMethod('cash');
      setIsPaymentModalOpen(true);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar pedidos de la mesa', 'error');
    }
  };

  const enviarTransaccionPOS = async (amount: number): Promise<{ success: boolean; message: string }> => {
    // IMPORTANTE: Abrir modal de espera del POS ANTES de cualquier llamada
    // Esto asegura que siempre se muestre el popup
    // Usar setTimeout para asegurar que React renderice el cambio de estado
    setIsPOSWaitingModalOpen(true);
    setPosStatusMessage('Esperando respuesta del POS...');
    setPosPollingAttempt(0);
    
    // Pequeño delay para asegurar que el modal se renderice antes de la llamada
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      console.log('🚀 [Tables] Iniciando envío de transacción POS:', { amount });
      
      // Llamar al endpoint del backend que maneja la transacción POS
      const response = await api.sendPOSTransaction(amount);
      
      console.log('📋 [Tables] Respuesta recibida del POST al POS:', {
        response,
        transactionId: response.transactionId,
        sTransactionId: response.sTransactionId,
        transactionDateTime: response.transactionDateTime
      });
      
      if (!response.transactionId && !response.sTransactionId) {
        console.error('❌ [Tables] No se recibió TransactionId de la transacción POS');
        setIsPOSWaitingModalOpen(false);
        showToast('No se recibió TransactionId de la transacción POS', 'error');
        throw new Error('No se recibió TransactionId de la transacción POS');
      }

      if (!response.transactionDateTime) {
        console.error('❌ [Tables] No se recibió TransactionDateTime de la transacción POS');
        setIsPOSWaitingModalOpen(false);
        showToast('No se recibió TransactionDateTime de la transacción POS', 'error');
        throw new Error('No se recibió TransactionDateTime de la transacción POS');
      }

      const transactionId = response.transactionId || response.sTransactionId!;
      const transactionDateTime = response.transactionDateTime;

      console.log('🔄 [Tables] Iniciando polling para transacción:', {
        transactionId,
        transactionDateTime
      });

      // Función auxiliar para obtener mensaje del código POS
      const getPOSCodeMessage = (statusCode: number): string => {
        const codigos: Record<string, string> = {
          "0": "Resultado OK",
          "100": "Resultado OK",
          "101": "Número de pinpad inválido",
          "102": "Número de sucursal inválido",
          "103": "Número de caja inválido",
          "104": "Fecha de la transacción inválida",
          "105": "Monto no válido",
          "106": "Cantidad de cuotas inválidas",
          "107": "Número de plan inválido",
          "108": "Número de factura inválido",
          "109": "Moneda ingresada no válida",
          "110": "Número de ticket inválido",
          "111": "No existe transacción",
          "112": "Transacción finalizada",
          "113": "Identificador de sistema inválido",
          "10": "Se debe consultar por la transacción",
          "11": "Aguardando por operación en el pinpad",
          "12": "Tiempo de transacción excedido, envíe datos nuevamente",
          "999": "Error no determinado",
          "-100": "Error no determinado"
        };
        return codigos[statusCode.toString()] || `Código desconocido: ${statusCode}`;
      };

      // Iniciar polling para consultar el estado de la transacción cada 2 segundos
      return new Promise((resolve, reject) => {
        const maxAttempts = 60; // Máximo 2 minutos (60 intentos * 2 segundos)
        let attempts = 0;
        let code12Attempts = 0; // Contador específico para código 12
        const maxCode12Attempts = 5; // Máximo 5 consultas adicionales cuando recibe código 12
        
        const pollInterval = setInterval(async () => {
          attempts++;
          setPosPollingAttempt(attempts);
          console.log(`🔄 [Tables] Polling intento ${attempts}/${maxAttempts} para transacción ${transactionId}`);
          
          try {
            const queryResponse = await api.queryPOSTransaction(transactionId, transactionDateTime);
            
            console.log(`📊 [Tables] Estado del polling (intento ${attempts}):`, {
              isCompleted: queryResponse.isCompleted,
              isPending: queryResponse.isPending,
              isError: queryResponse.isError,
              statusMessage: queryResponse.statusMessage,
              statusCode: queryResponse.statusCode
            });
            
            // Obtener mensaje del código
            const codeMessage = getPOSCodeMessage(queryResponse.statusCode);
            const fullMessage = `${codeMessage} (Código: ${queryResponse.statusCode})`;
            
            // IMPORTANTE: Manejar código 12 (tiempo excedido) ANTES de verificar isError
            // Cuando se recibe código 12, continuar haciendo polling hasta que remainingExpirationTime llegue a 0
            if (queryResponse.statusCode === 12) {
              code12Attempts++; // Incrementar contador de código 12 (solo para logging)
              const remainingTime = queryResponse.remainingExpirationTime ?? null;
              
              // Verificar si RemainingExpirationTime <= 0 (condición para hacer reverso)
              // Si remainingExpirationTime > 0 (ej: 221), continuar polling sin enviar reverso
              if (remainingTime !== null && remainingTime <= 0) {
                console.warn(`🔄 [Tables] Código 12 con RemainingExpirationTime = 0 detectado. Enviando reverso automáticamente...`);
                setPosStatusMessage(`⚠️ ${fullMessage} - Tiempo agotado. Enviando reverso...`);
                
                try {
                  // Enviar reverso automáticamente cuando código 12 Y remainingExpirationTime <= 0
                  const reverseResult = await api.sendPOSReverse(transactionId, transactionDateTime, undefined, amount);
                  
                  if (reverseResult.success) {
                    console.log('✅ [Tables] Reverso enviado exitosamente');
                    clearInterval(pollInterval);
                    setIsPOSWaitingModalOpen(false);
                    showToast('Tiempo de transacción excedido. Reverso enviado automáticamente para anular la transacción.', 'warning');
                    reject(new Error(`Tiempo de transacción excedido. Reverso enviado: ${fullMessage}`));
                    return;
                  } else {
                    console.error('❌ [Tables] Error al enviar reverso:', reverseResult.message);
                    setPosStatusMessage(`⚠️ ${fullMessage} - Error al enviar reverso: ${reverseResult.message}`);
                    clearInterval(pollInterval);
                    setIsPOSWaitingModalOpen(false);
                    showToast(`Error al enviar reverso: ${reverseResult.message}`, 'error');
                    reject(new Error(`Error al enviar reverso: ${reverseResult.message}`));
                    return;
                  }
                } catch (reverseError: any) {
                  console.error('❌ [Tables] Excepción al enviar reverso:', reverseError);
                  setPosStatusMessage(`⚠️ ${fullMessage} - Error al enviar reverso`);
                  clearInterval(pollInterval);
                  setIsPOSWaitingModalOpen(false);
                  showToast('Error al enviar reverso automático', 'error');
                  reject(new Error(`Error al enviar reverso: ${reverseError.message || 'Error desconocido'}`));
                  return;
                }
              } else {
                // Continuar haciendo polling mientras remainingExpirationTime > 0 (ej: 221, 200, 100, etc.)
                const timeDisplay = remainingTime !== null ? ` (Tiempo restante: ${remainingTime}s)` : '';
                console.warn(`⚠️ [Tables] Código 12 detectado - Continuando polling${timeDisplay} (consulta ${code12Attempts})...`);
                setPosStatusMessage(`⚠️ ${fullMessage}${timeDisplay} - Esperando tiempo de expiración...`);
                // Continuar consultando hasta que remainingExpirationTime llegue a 0
                return;
              }
            } else {
              // Si recibimos un código diferente a 12, reiniciar el contador
              if (code12Attempts > 0) {
                console.log(`✅ [Tables] Código cambió de 12 a ${queryResponse.statusCode}, reiniciando contador de código 12`);
                code12Attempts = 0;
              }
            }
            
            // Ahora verificar el estado de la transacción
            if (queryResponse.isCompleted) {
              console.log('✅ [Tables] Transacción POS completada exitosamente');
              clearInterval(pollInterval);
              setIsPOSWaitingModalOpen(false);
              showToast(`Transacción POS completada: ${fullMessage}`, 'success');
              resolve({ 
                success: true, 
                message: `Transacción POS completada: ${fullMessage}` 
              });
            } else if (queryResponse.isError && queryResponse.statusCode !== 12) {
              // Solo tratar como error si NO es código 12 (ya lo manejamos arriba)
              console.error('❌ [Tables] Transacción POS rechazada:', queryResponse.statusMessage);
              clearInterval(pollInterval);
              setIsPOSWaitingModalOpen(false);
              showToast(`Transacción POS rechazada: ${fullMessage}`, 'error');
              reject(new Error(`Transacción POS rechazada: ${fullMessage}`));
            } else if (queryResponse.isPending || queryResponse.statusCode === 10 || queryResponse.statusCode === 11) {
              // Códigos 10 o 11 indican que debe continuar consultando
              setPosStatusMessage(`Esperando respuesta del POS... (${fullMessage})`);
              
              // Verificar si RemainingExpirationTime = 0 (condición para hacer reverso en transacciones con promociones)
              const remainingTime = queryResponse.remainingExpirationTime ?? null;
              if (remainingTime !== null && remainingTime <= 0 && queryResponse.statusCode === 10) {
                console.warn(`🔄 [Tables] ResponseCode 10 con RemainingExpirationTime = 0 detectado. Enviando reverso automáticamente...`);
                setPosStatusMessage(`⚠️ ${fullMessage} - Tiempo agotado. Enviando reverso...`);
                
                try {
                  const reverseResult = await api.sendPOSReverse(transactionId, transactionDateTime, undefined, amount);
                  
                  if (reverseResult.success) {
                    console.log('✅ [Tables] Reverso enviado exitosamente');
                    clearInterval(pollInterval);
                    setIsPOSWaitingModalOpen(false);
                    showToast('Transacción sin respuesta. Reverso enviado automáticamente para anular la transacción.', 'warning');
                    reject(new Error(`Transacción sin respuesta. Reverso enviado: ${fullMessage}`));
                    return;
                  } else {
                    console.error('❌ [Tables] Error al enviar reverso:', reverseResult.message);
                    setPosStatusMessage(`⚠️ ${fullMessage} - Error al enviar reverso: ${reverseResult.message}`);
                  }
                } catch (reverseError: any) {
                  console.error('❌ [Tables] Excepción al enviar reverso:', reverseError);
                  setPosStatusMessage(`⚠️ ${fullMessage} - Error al enviar reverso`);
                }
              }
              
              // Continuar consultando
              if (attempts >= maxAttempts) {
                console.error('⏱️ [Tables] Tiempo de espera excedido para la transacción POS. Enviando reverso...');
                clearInterval(pollInterval);
                setIsPOSWaitingModalOpen(false);
                
                // Enviar reverso cuando se alcanza el máximo de intentos sin respuesta
                try {
                  setPosStatusMessage('Tiempo agotado. Enviando reverso...');
                  const reverseResult = await api.sendPOSReverse(transactionId, transactionDateTime, undefined, amount);
                  
                  if (reverseResult.success) {
                    showToast('Transacción sin respuesta después de múltiples intentos. Reverso enviado automáticamente.', 'warning');
                    reject(new Error('Transacción sin respuesta. Reverso enviado automáticamente.'));
                  } else {
                    showToast(`Tiempo de espera excedido. Error al enviar reverso: ${reverseResult.message}`, 'error');
                    reject(new Error('Tiempo de espera excedido para la transacción POS'));
                  }
                } catch (reverseError: any) {
                  console.error('❌ [Tables] Error al enviar reverso después de timeout:', reverseError);
                  showToast('Tiempo de espera excedido. Error al enviar reverso.', 'error');
                  reject(new Error('Tiempo de espera excedido para la transacción POS'));
                }
                return;
              }
            } else {
              // Estado desconocido, continuar consultando
              if (attempts >= maxAttempts) {
                console.error('⏱️ [Tables] Tiempo de espera excedido para la transacción POS (estado desconocido). Enviando reverso...');
                clearInterval(pollInterval);
                setIsPOSWaitingModalOpen(false);
                
                // Enviar reverso cuando se alcanza el máximo de intentos sin respuesta
                try {
                  setPosStatusMessage('Tiempo agotado. Enviando reverso...');
                  const reverseResult = await api.sendPOSReverse(transactionId, transactionDateTime, undefined, amount);
                  
                  if (reverseResult.success) {
                    showToast('Transacción sin respuesta después de múltiples intentos. Reverso enviado automáticamente.', 'warning');
                    reject(new Error(`Transacción sin respuesta. Reverso enviado: ${fullMessage}`));
                  } else {
                    showToast(`Tiempo de espera excedido. Error al enviar reverso: ${reverseResult.message}`, 'error');
                    reject(new Error('Tiempo de espera excedido para la transacción POS'));
                  }
                } catch (reverseError: any) {
                  console.error('❌ [Tables] Error al enviar reverso después de timeout:', reverseError);
                  showToast('Tiempo de espera excedido. Error al enviar reverso.', 'error');
                  reject(new Error(`Tiempo de espera excedido para la transacción POS: ${fullMessage}`));
                }
                return;
              }
            }
          } catch (error: any) {
            console.error('❌ [Tables] Error al consultar estado de transacción POS:', error);
            
            // Si es un error de conexión/timeout y ya hicimos varios intentos, enviar reverso
            if (attempts >= 10) { // Después de 10 intentos fallidos, considerar que no hay respuesta
              console.warn('🔄 [Tables] Múltiples errores de conexión detectados. Enviando reverso...');
              clearInterval(pollInterval);
              setIsPOSWaitingModalOpen(false);
              
              try {
                setPosStatusMessage('Error de conexión. Enviando reverso...');
                const reverseResult = await api.sendPOSReverse(transactionId, transactionDateTime, undefined, amount);
                
                if (reverseResult.success) {
                  showToast('Error de conexión con el POS. Reverso enviado automáticamente para anular la transacción.', 'warning');
                  reject(new Error(`Error de conexión. Reverso enviado: ${error.message}`));
                } else {
                  showToast(`Error de conexión. Error al enviar reverso: ${reverseResult.message}`, 'error');
                  reject(new Error('Error al consultar estado de transacción POS'));
                }
              } catch (reverseError: any) {
                console.error('❌ [Tables] Error al enviar reverso después de error de conexión:', reverseError);
                showToast(`Error al consultar estado: ${error.message}`, 'error');
                reject(new Error('Error al consultar estado de transacción POS'));
              }
              return;
            }
            
            // Si no es un error repetido, continuar intentando
            setPosStatusMessage(`Error de conexión. Reintentando... (${attempts}/${maxAttempts})`);
          }
        }, 2000); // Consultar cada 2 segundos
      });
    } catch (error: any) {
      console.error('❌ [Tables] Error al enviar transacción POS:', error);
      setIsPOSWaitingModalOpen(false);
      showToast(`Error al enviar transacción POS: ${error.message}`, 'error');
      throw new Error(`Error al enviar transacción POS: ${error.message}`);
    }
  };

  const handleProcessPayment = async () => {
    if (!tableForPayment || tableOrders.length === 0) {
      return;
    }

    try {
      setIsProcessingPayment(true);
      
      // Si el método de pago es POS, enviar transacción al POS primero
      if (selectedPaymentMethod.toLowerCase() === 'pos') {
        try {
          // El toast y modal se manejan dentro de enviarTransaccionPOS
          await enviarTransaccionPOS(totalAmount);
          // El toast ya se muestra dentro de enviarTransaccionPOS
        } catch (error: any) {
          // El modal y toast ya se manejan dentro de enviarTransaccionPOS
          setIsPOSWaitingModalOpen(false);
          return; // No continuar con el procesamiento del pago si falla el POS
        }
      }
      
      // Procesar el pago de todos los pedidos de la mesa
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
      
      // Actualizar el estado de la mesa a Available
      await api.updateTableStatus(tableForPayment.id, 'Available');
      
      showToast(`Pago procesado exitosamente. Total: $${totalAmount.toFixed(2)}`, 'success');
      setIsPaymentModalOpen(false);
      setTableForPayment(null);
      setTableOrders([]);
      loadData(); // Recargar mesas para actualizar estado
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
            Gestión de Mesas
            <HelpIcon
              title="Manual de Gestión de Mesas"
              content={
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">📋 Gestión de Mesas</h3>
                    <p className="mb-2">En esta sección puedes administrar las mesas de tu restaurante, crear pedidos y procesar pagos.</p>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">🏗️ Espacios y Mesas</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Crear Espacio:</strong> Los espacios son áreas del restaurante (ej: "Salón Principal", "Terraza"). Crea espacios para organizar mejor tus mesas.</li>
                      <li><strong>Crear Mesa:</strong> Agrega mesas asignándolas a un espacio. Define número, capacidad, ubicación y estado inicial.</li>
                      <li><strong>Mover Mesas:</strong> Activa el "Modo Mover" para arrastrar y reposicionar mesas en el plano del salón.</li>
                      <li><strong>Editar/Eliminar:</strong> Puedes editar o eliminar mesas desde el menú de acciones de cada mesa.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">📊 Estados de Mesa</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Disponible:</strong> Mesa libre y lista para recibir clientes.</li>
                      <li><strong>Ocupada:</strong> Mesa con clientes sentados.</li>
                      <li><strong>Reservada:</strong> Mesa reservada para un cliente.</li>
                      <li><strong>Limpieza:</strong> Mesa siendo limpiada después de uso.</li>
                      <li><strong>Pedido Realizado:</strong> Mesa con pedido confirmado pero aún no pagado.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">🛒 Crear Pedido desde Mesa</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li><strong>Abrir Caja:</strong> Primero debes abrir la caja del restaurante (botón en la esquina superior derecha).</li>
                      <li>Haz clic en una mesa disponible u ocupada.</li>
                      <li>Selecciona "Crear Pedido" desde el menú de la mesa.</li>
                      <li>Elige productos de las categorías disponibles.</li>
                      <li>Agrega subproductos si el producto los tiene (ej: tamaño, extras).</li>
                      <li>Confirma el pedido. La mesa cambiará a estado "Pedido Realizado".</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">💳 Procesar Pago</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Haz clic en una mesa con pedido realizado.</li>
                      <li>Selecciona "Procesar Pago".</li>
                      <li>Elige el método de pago:
                        <ul className="list-disc list-inside ml-4 mt-1">
                          <li><strong>Efectivo:</strong> Pago inmediato en efectivo.</li>
                          <li><strong>Tarjeta:</strong> Pago con tarjeta de débito/crédito.</li>
                          <li><strong>POS:</strong> Pago con terminal POS. El sistema esperará la confirmación del POS automáticamente.</li>
                        </ul>
                      </li>
                      <li>Confirma el pago. La mesa volverá a estado "Disponible".</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">👁️ Vista de Plano vs Lista</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Vista Plano:</strong> Visualiza las mesas en un plano del salón. Ideal para ver la distribución física.</li>
                      <li><strong>Vista Lista:</strong> Lista todas las mesas con sus detalles. Útil para búsquedas rápidas.</li>
                      <li>Puedes cambiar entre vistas con los botones en la parte superior.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">🔍 Filtros y Búsqueda</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Filtrar por Estado:</strong> Muestra solo mesas con un estado específico.</li>
                      <li><strong>Filtrar por Espacio:</strong> Muestra solo mesas de un espacio determinado.</li>
                      <li><strong>Buscar:</strong> Busca mesas por número o ubicación.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">💰 Caja del Restaurante</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li><strong>Abrir Caja:</strong> Debes abrir la caja antes de crear pedidos o procesar pagos.</li>
                      <li><strong>Cerrar Caja:</strong> Al finalizar el día, cierra la caja. El sistema mostrará un resumen de movimientos.</li>
                      <li>El estado de la caja se muestra en la esquina superior derecha.</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Tip:</strong> Cuando uses POS, espera a que aparezca el mensaje de confirmación. El sistema consulta automáticamente el estado de la transacción.
                    </p>
                  </div>
                </div>
              }
            />
          </h1>
          <p className="text-gray-600 mt-1">Administra las mesas del restaurante</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Cash Register Button */}
          {cashRegisterStatus?.isOpen ? (
            <button
              onClick={() => setIsCloseCashRegisterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md"
              title="Cerrar Caja"
            >
              <DollarSign size={20} />
              <span>Cerrar Caja</span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpenCashRegisterModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-md"
              title="Abrir Caja"
            >
              <DollarSign size={20} />
              <span>Abrir Caja</span>
            </button>
          )}
          {viewMode === 'floor' && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-md ${
                editMode
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={editMode ? 'Desactivar modo mover' : 'Activar modo mover mesas'}
            >
              <Move size={20} />
              {editMode ? 'Moviendo...' : 'Mover Mesas'}
            </button>
          )}
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
          <button
            onClick={openCreateSpaceModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors shadow-md"
          >
            <Building2 size={20} />
            Nuevo Espacio
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors shadow-md"
          >
            <Plus size={20} />
            Nueva Mesa
          </button>
        </div>
      </div>

      {/* Spaces List */}
      {spaces.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Building2 size={20} className="text-purple-500" />
              Espacios ({spaces.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {spaces.map(space => {
              const spaceTables = tables.filter(t => t.spaceId === space.id);
              const availableTables = spaceTables.filter(t => t.status === 'Available');
              return (
                <div
                  key={space.id}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg"
                >
                  <Building2 size={16} className="text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">{space.name}</span>
                  <span className="text-xs text-gray-500">
                    ({spaceTables.length} mesas, {availableTables.length} disponibles)
                  </span>
                  <button
                    onClick={() => setDeleteSpace(space)}
                    className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar espacio"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-4">
              {editMode && (
                <p className="text-sm text-green-600 font-medium flex items-center gap-2">
                  <Move size={16} />
                  Modo mover activado - Arrastra las mesas
                </p>
              )}
              {!editMode && (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  Click en una mesa para ver detalles
                </p>
              )}
            </div>
          </div>
          <div
            ref={floorPlanRef}
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
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Paredes y áreas del salón */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Pared izquierda (baños) */}
              <div className="absolute left-0 top-0 w-20 h-full bg-gray-400 border-r-4 border-gray-600 opacity-70"></div>
              
              {/* Pared superior (cocina) */}
              <div className="absolute left-20 top-0 right-0 h-24 bg-gray-400 border-b-4 border-gray-600 opacity-70"></div>
              
              {/* Líneas de guía para pasillos (senderos) */}
              <div className="absolute left-20 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-1/3 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-2/3 top-24 w-2 h-full bg-green-300/40"></div>
              <div className="absolute left-20 top-24 right-0 h-2 bg-green-300/40"></div>
            </div>

            {filteredTables.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <div className="text-center bg-white/90 p-8 rounded-xl shadow-lg">
                  <TableIcon size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4">No hay mesas para mostrar</p>
                  <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    Crear Primera Mesa
                  </button>
                </div>
              </div>
            ) : (
              filteredTables.map((table) => {
                const statusInfo = getStatusInfo(table.status);
                // Usar posición guardada o generar una posición fija basada en el ID de la mesa
                // Esto evita que las mesas se muevan en cada render
                const getFixedPosition = (id: number, axis: 'x' | 'y') => {
                  // Generar una posición pseudo-aleatoria pero determinística basada en el ID
                  const seed = id * (axis === 'x' ? 7919 : 7907); // Números primos diferentes para x e y
                  const random = (seed % 1000) / 1000; // Valor entre 0 y 1
                  return axis === 'x' 
                    ? 100 + random * 600  // Entre 100 y 700
                    : 150 + random * 500; // Entre 150 y 650
                };
                const x = table.positionX ?? getFixedPosition(table.id, 'x');
                const y = table.positionY ?? getFixedPosition(table.id, 'y');
                
                // Tamaño de la mesa basado en capacidad (mesa cuadrada)
                const tableSize = Math.max(50, Math.min(80, table.capacity * 10));
                const chairSize = 18;
                const chairOffset = tableSize / 2 + 8;
                
                return (
                  <div
                    key={table.id}
                    className={`absolute transition-all ${
                      editMode ? 'cursor-move' : 'cursor-pointer'
                    } ${
                      isDragging && draggedTable?.id === table.id ? 'z-50 scale-110' : 'z-10 hover:z-20'
                    }`}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, table)}
                    onClick={() => {
                      if (!isDragging && !editMode) {
                        openDetailsModal(table);
                      }
                    }}
                  >
                    {/* Mesa cuadrada marrón con sillas */}
                    <div className="relative">
                      {/* Silla superior */}
                      <div
                        className="absolute rounded-full shadow-lg border-2"
                        style={{
                          top: `-${chairOffset}px`,
                          left: '50%',
                          transform: 'translateX(-50%)',
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
                        {/* Base de la silla (pedestal metálico) */}
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
                      
                      {/* Silla inferior */}
                      <div
                        className="absolute rounded-full shadow-lg border-2"
                        style={{
                          top: `${chairOffset}px`,
                          left: '50%',
                          transform: 'translateX(-50%)',
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
                      
                      {/* Silla izquierda */}
                      <div
                        className="absolute rounded-full shadow-lg border-2"
                        style={{
                          left: `-${chairOffset}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
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
                      
                      {/* Silla derecha */}
                      <div
                        className="absolute rounded-full shadow-lg border-2"
                        style={{
                          left: `${chairOffset}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
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
                      
                      {/* Mesa cuadrada marrón */}
                      <div
                        className={`rounded-lg shadow-2xl transition-all border-2 ${
                          editMode ? 'ring-2 ring-yellow-400 ring-offset-2' : ''
                        }`}
                        style={{
                          width: `${tableSize}px`,
                          height: `${tableSize}px`,
                          background: 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)',
                          borderColor: '#451a03',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.3), inset 0 2px 5px rgba(255,255,255,0.1)',
                        }}
                      >
                        {/* Base de la mesa (pedestal) */}
                        <div
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-gray-300 border-2 border-gray-400 shadow-lg"
                          style={{
                            width: '12px',
                            height: '12px',
                            bottom: '-6px',
                          }}
                        ></div>
                        
                        {/* Contenido de la mesa */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-white text-center drop-shadow-lg">
                            <div className="text-sm font-bold">{table.number}</div>
                            <div className="text-[10px] opacity-90">{table.capacity}p</div>
                            {table.status === 'OrderPlaced' && table.orderPlacedAt && (
                              <div className="text-[9px] mt-1 opacity-75 flex items-center justify-center gap-1">
                                <Clock size={8} />
                                {getTimeElapsed(table.orderPlacedAt)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCreateOrderModal(table);
                            }}
                            className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-1 transition-colors z-50"
                            title="Crear pedido"
                          >
                            <ShoppingCart size={12} />
                            Pedido
                          </button>
                          {(table.status === 'OrderPlaced' || table.status === 'Occupied') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openPaymentModal(table);
                              }}
                              className="absolute -bottom-16 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-1 transition-colors z-50"
                              title="Cobrar"
                            >
                              <CreditCard size={12} />
                              Cobrar
                            </button>
                          )}
                        </div>
                        
                        {/* Sombra debajo de la mesa */}
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
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-primary-200 cursor-pointer"
                  onClick={() => openDetailsModal(table)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <TableIcon size={24} className="text-primary-500" />
                        {table.number}
                      </h3>
                      <p className="text-sm text-gray-500">ID: #{table.id}</p>
                      {table.status === 'OrderPlaced' && table.orderPlacedAt && (
                        <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
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
                    {table.notes && (
                      <p className="text-sm text-gray-500 italic">{table.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreateOrderModal(table);
                      }}
                      className="w-full px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={16} />
                      Crear Pedido
                    </button>
                    {(table.status === 'OrderPlaced' || table.status === 'Occupied') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPaymentModal(table);
                        }}
                        className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                      >
                        <CreditCard size={16} />
                        Cobrar
                      </button>
                    )}
                    <select
                      value={table.status}
                      onChange={(e) => handleStatusChange(table, e.target.value as TableStatus)}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium border ${statusInfo.bgColor} ${statusInfo.color} border-transparent focus:ring-2 focus:ring-primary-500`}
                    >
                      {TABLE_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(table);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        <Edit2 size={16} className="inline mr-1" />
                        Editar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTable(table);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingTable ? '✏️ Editar Mesa' : '➕ Nueva Mesa'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="tableNumber" className="block text-sm font-medium text-gray-700 mb-1">
              Número de Mesa *
            </label>
            <input
              type="text"
              id="tableNumber"
              value={formData.number}
              onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="tableCapacity" className="block text-sm font-medium text-gray-700 mb-1">
              Capacidad (personas) *
            </label>
            <input
              type="number"
              id="tableCapacity"
              min="1"
              value={formData.capacity}
              onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="tableLocation" className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación
            </label>
            <input
              type="text"
              id="tableLocation"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Ej: Interior, Terraza, Ventana"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="tableSpace" className="block text-sm font-medium text-gray-700 mb-1">
              Espacio
            </label>
            <select
              id="tableSpace"
              value={formData.spaceId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, spaceId: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Sin espacio asignado</option>
              {spaces.map(space => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tableStatus" className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              id="tableStatus"
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as TableStatus }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {TABLE_STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="tableNotes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              id="tableNotes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Notas adicionales sobre la mesa..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {formLoading ? 'Guardando...' : editingTable ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={`Mesa ${selectedTable?.number}`}
        size="md"
      >
        {selectedTable && (
          <div className="space-y-4">
            <div className="flex items-center justify-center mb-4">
              <div className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center shadow-lg ${
                getStatusInfo(selectedTable.status).bgColor
              } ${getStatusInfo(selectedTable.status).color} border-current`}>
                <TableIcon size={40} className="mb-1" />
                <span className="text-sm font-bold">{selectedTable.number}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Capacidad</label>
                <p className="text-lg font-semibold flex items-center gap-2">
                  <Users size={20} />
                  {selectedTable.capacity} personas
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Estado</label>
                <p className={`text-lg font-semibold px-3 py-1 rounded-full inline-block ${
                  getStatusInfo(selectedTable.status).bgColor
                } ${getStatusInfo(selectedTable.status).color}`}>
                  {getStatusInfo(selectedTable.status).label}
                </p>
              </div>
              {selectedTable.location && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Ubicación</label>
                  <p className="text-lg font-semibold flex items-center gap-2">
                    <MapPin size={20} />
                    {selectedTable.location}
                  </p>
                </div>
              )}
              {selectedTable.notes && (
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500">Notas</label>
                  <p className="text-gray-700">{selectedTable.notes}</p>
                </div>
              )}
            </div>

            {/* Botón para liberar mesa si está ocupada pero no tiene pedidos */}
            {(selectedTable.status === 'Occupied' || selectedTable.status === 'OrderPlaced') && (
              <div className="pt-4 border-t space-y-2">
                <button
                  onClick={async () => {
                    if (!selectedTable) return;
                    try {
                      await api.syncTableStatus(selectedTable.id);
                      showToast('Estado de mesa sincronizado', 'success');
                      // Recargar la mesa
                      const updatedTable = await api.getTable(selectedTable.id);
                      if (updatedTable) {
                        setSelectedTable(updatedTable);
                      }
                      loadData();
                    } catch (error: any) {
                      showToast(error.message || 'Error al sincronizar', 'error');
                    }
                  }}
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <Clock size={16} />
                  Sincronizar Estado
                </button>
                {isCheckingOrders ? (
                  <div className="text-center text-gray-500 text-sm py-2">
                    Verificando pedidos...
                  </div>
                ) : !tableHasActiveOrders ? (
                  <button
                    onClick={handleFreeTable}
                    disabled={isFreeingTable}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isFreeingTable ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Liberando...
                      </>
                    ) : (
                      <>
                        <X size={16} />
                        Liberar Mesa
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center text-sm text-gray-500 py-2">
                    La mesa tiene pedidos activos. Debe completar o cancelar los pedidos primero.
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  openEditModal(selectedTable);
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Edit2 size={16} className="inline mr-2" />
                Editar
              </button>
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false);
                  setDeleteTable(selectedTable);
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 size={16} className="inline mr-2" />
                Eliminar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTable}
        onClose={() => setDeleteTable(null)}
        onConfirm={handleDelete}
        title="Eliminar Mesa"
        message={`¿Estás seguro de que deseas eliminar la mesa "${deleteTable?.number}"?`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Create Space Modal */}
      <Modal
        isOpen={isSpaceModalOpen}
        onClose={() => setIsSpaceModalOpen(false)}
        title="➕ Nuevo Espacio"
        size="md"
      >
        <form onSubmit={handleCreateSpace} className="space-y-4">
          <div>
            <label htmlFor="spaceName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Espacio *
            </label>
            <input
              type="text"
              id="spaceName"
              value={spaceFormData.name}
              onChange={(e) => setSpaceFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Planta 1, Terraza, Fondo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="spaceDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              id="spaceDescription"
              value={spaceFormData.description}
              onChange={(e) => setSpaceFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              placeholder="Descripción opcional del espacio..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsSpaceModalOpen(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={spaceFormLoading}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {spaceFormLoading ? 'Creando...' : 'Crear Espacio'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Space Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteSpace}
        onClose={() => setDeleteSpace(null)}
        onConfirm={handleDeleteSpace}
        title="Eliminar Espacio"
        message={`¿Estás seguro de que deseas eliminar el espacio "${deleteSpace?.name}"? Esto eliminará todas las mesas dentro de este espacio que estén en estado "Disponible".`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      {/* Create Order Modal */}
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
                            // Si la imagen falla al cargar, reemplazar con emoji
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
              {/* Botón para volver a categorías */}
              <button
                onClick={() => {
                  setSelectedCategoryId(null);
                  setSelectedProductId(null);
                }}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ← Volver a Categorías
              </button>

              {/* Mostrar nombre de categoría seleccionada */}
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

              {/* Productos de la categoría seleccionada */}
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
                          // Cargar subproductos del producto seleccionado
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

                {/* Si no hay productos en la categoría */}
                {products.filter(p => p.categoryId === selectedCategoryId && p.isAvailable).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos disponibles en esta categoría
                  </div>
                )}
              </div>

              {/* Subproductos (Guarniciones) */}
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

              {/* Cantidad y botón agregar */}
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
                    <Plus size={18} />
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

          {/* Método de Pago */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Método de Pago
            </label>
            <select
              value={orderPaymentMethod}
              onChange={(e) => setOrderPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.name}>
                  {method.name}
                </option>
              ))}
            </select>
          </div>

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

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setTableForPayment(null);
          setTableOrders([]);
        }}
        title={`Cobrar - Mesa ${tableForPayment?.number}`}
        size="md"
      >
        <div className="space-y-4">
          {/* Resumen de Pedidos */}
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

          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-gray-700">Total a Cobrar:</span>
              <span className="text-2xl font-bold text-green-600">
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Método de Pago */}
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

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsPaymentModalOpen(false);
                setTableForPayment(null);
                setTableOrders([]);
              }}
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
      </Modal>

      {/* Cash Register Modals */}
      <OpenCashRegisterModal
        isOpen={isOpenCashRegisterModalOpen}
        onClose={() => setIsOpenCashRegisterModalOpen(false)}
        onConfirm={handleOpenCashRegister}
      />

      <CloseCashRegisterModal
        isOpen={isCloseCashRegisterModalOpen}
        onClose={() => setIsCloseCashRegisterModalOpen(false)}
        onConfirm={handleCloseCashRegister}
        cashRegister={cashRegisterStatus?.cashRegister}
      />

      {/* POS Waiting Modal - z-index alto para estar por encima de otros modales */}
      {isPOSWaitingModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Esperando respuesta del POS</h2>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {posStatusMessage}
                  </p>
                  {posPollingAttempt > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Intento {posPollingAttempt} de consulta...
                    </p>
                  )}
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Por favor, espere mientras se procesa la transacción en el terminal POS.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Truck, Plus, Search, DollarSign, Package, MapPin, Phone, Clock, CheckCircle, XCircle, AlertCircle, X, Eye, ShoppingCart, CreditCard } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { DeliveryPerson, Product, PaymentMethod, Order, Category, SubProduct, CreateOrderRequest } from '../types';

export default function DeliveryPersonsManagementPage() {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeliveryPerson, setSelectedDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [cashRegisterStatuses, setCashRegisterStatuses] = useState<Record<number, { isOpen: boolean; cashRegister: any }>>({});
  
  // Modal states
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCloseCashRegisterModalOpen, setIsCloseCashRegisterModalOpen] = useState(false);
  const [isOpenCashRegisterModalOpen, setIsOpenCashRegisterModalOpen] = useState(false);
  const [selectedDeliveryPersonForCashRegister, setSelectedDeliveryPersonForCashRegister] = useState<number | null>(null);
  const [initialAmount, setInitialAmount] = useState<string>('0');
  const [closeNotes, setCloseNotes] = useState('');
  const [deliveryPersonOrders, setDeliveryPersonOrders] = useState<Order[]>([]);
  const [cashRegisterMovements, setCashRegisterMovements] = useState<any>(null);
  const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
  
  // Order creation state
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
  const [orderCustomerName, setOrderCustomerName] = useState<string>('');
  const [orderCustomerAddress, setOrderCustomerAddress] = useState<string>('');
  const [orderCustomerPhone, setOrderCustomerPhone] = useState<string>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [selectedDeliveryPersonForOrder, setSelectedDeliveryPersonForOrder] = useState<number | null>(null);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    loadProducts();
    loadPaymentMethods();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const deliveryPersonsData = await api.getDeliveryPersons();
      setDeliveryPersons(deliveryPersonsData);
      
      // Cargar estado de caja de cada repartidor activo
      const statuses: Record<number, { isOpen: boolean; cashRegister: any }> = {};
      for (const dp of deliveryPersonsData.filter(d => d.isActive)) {
        try {
          const status = await api.getDeliveryPersonCashRegisterStatus(dp.id);
          statuses[dp.id] = status;
        } catch (error) {
          statuses[dp.id] = { isOpen: false, cashRegister: null };
        }
      }
      setCashRegisterStatuses(statuses);
    } catch (error) {
      showToast('Error al cargar repartidores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await api.getProducts();
      setProducts(productsData);
      
      // Cargar categorías únicas
      const uniqueCategories = Array.from(
        new Map(productsData.map(p => [p.categoryId, { id: p.categoryId, name: p.categoryName }])).values()
      );
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const methods = await api.getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error) {
      console.error('Error al cargar métodos de pago:', error);
    }
  };

  const handleOpenCashRegisterClick = (deliveryPersonId: number) => {
    setSelectedDeliveryPersonForCashRegister(deliveryPersonId);
    setInitialAmount('0');
    setIsOpenCashRegisterModalOpen(true);
  };

  const handleOpenCashRegister = async () => {
    if (!selectedDeliveryPersonForCashRegister) return;
    
    const amount = parseFloat(initialAmount);
    if (isNaN(amount) || amount < 0) {
      showToast('El monto inicial debe ser un número mayor o igual a 0', 'error');
      return;
    }

    try {
      await api.openDeliveryPersonCashRegister(selectedDeliveryPersonForCashRegister, amount);
      showToast('Caja abierta exitosamente', 'success');
      setIsOpenCashRegisterModalOpen(false);
      setInitialAmount('0');
      setSelectedDeliveryPersonForCashRegister(null);
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al abrir la caja', 'error');
    }
  };

  const handleCloseCashRegister = async () => {
    if (!selectedDeliveryPerson) return;
    
    try {
      const result = await api.closeDeliveryPersonCashRegister(selectedDeliveryPerson.id, closeNotes || undefined);
      showToast('Caja cerrada exitosamente', 'success');
      setCloseNotes('');
      setIsCloseCashRegisterModalOpen(false);
      
      // Mostrar movimientos
      if (result && result.movements) {
        setCashRegisterMovements(result);
        setIsMovementsModalOpen(true);
      }
      
      // Recargar datos para actualizar el estado de la caja
      await loadData();
      // Si el modal de detalles está abierto, recargar los pedidos
      if (isDetailsModalOpen && selectedDeliveryPerson) {
        await loadDeliveryPersonOrders(selectedDeliveryPerson.id, false);
      }
    } catch (error: any) {
      showToast(error.message || 'Error al cerrar la caja', 'error');
    }
  };

  const openCreateOrderModal = (deliveryPersonId: number) => {
    // Verificar que la caja esté abierta
    const status = cashRegisterStatuses[deliveryPersonId];
    if (!status || !status.isOpen) {
      showToast('Debes abrir la caja del repartidor primero', 'error');
      return;
    }
    
    setSelectedDeliveryPersonForOrder(deliveryPersonId);
    setOrderCustomerName('');
    setOrderCustomerAddress('');
    setOrderCustomerPhone('');
    setOrderItems([]);
    setOrderPaymentMethod('cash');
    setOrderComments('');
    setSelectedProductId(null);
    setProductQuantity(1);
    setSelectedSubProducts([]);
    setIsCreateOrderModalOpen(true);
  };

  const handleAddProductToOrder = () => {
    if (!selectedProductId) {
      showToast('Selecciona un producto', 'error');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const subProductsData = selectedSubProducts
      .map(id => productSubProducts.find(sp => sp.id === id))
      .filter((sp): sp is SubProduct => sp !== undefined);

    const subtotal = (product.price * productQuantity) + 
      subProductsData.reduce((sum, sp) => sum + sp.price, 0);

    const existingIndex = orderItems.findIndex(item => 
      item.id === product.id && 
      JSON.stringify(item.subProducts?.map(sp => sp.id).sort()) === JSON.stringify(selectedSubProducts.sort())
    );

    if (existingIndex >= 0) {
      const updated = [...orderItems];
      updated[existingIndex].quantity += productQuantity;
      updated[existingIndex].subProducts = subProductsData;
      setOrderItems(updated);
    } else {
      setOrderItems([...orderItems, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: productQuantity,
        subProducts: subProductsData.length > 0 ? subProductsData.map(sp => ({
          id: sp.id,
          name: sp.name,
          price: sp.price
        })) : undefined
      }]);
    }

    setSelectedProductId(null);
    setProductQuantity(1);
    setSelectedSubProducts([]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleProductSelect = (productId: number) => {
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product && product.subProducts) {
      setProductSubProducts(product.subProducts);
    } else {
      setProductSubProducts([]);
    }
    setSelectedSubProducts([]);
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const subProductsTotal = (item.subProducts || []).reduce((subSum, sp) => subSum + sp.price, 0);
      return sum + itemTotal + subProductsTotal;
    }, 0);
  };

  const handleCreateOrder = async () => {
    if (!selectedDeliveryPersonForOrder) {
      showToast('Selecciona un repartidor', 'error');
      return;
    }

    if (!orderCustomerName.trim()) {
      showToast('El nombre del cliente es requerido', 'error');
      return;
    }

    if (!orderCustomerAddress.trim()) {
      showToast('La dirección es requerida', 'error');
      return;
    }

    if (orderItems.length === 0) {
      showToast('Agrega al menos un producto', 'error');
      return;
    }

    try {
      setIsCreatingOrder(true);
      
      const orderData: CreateOrderRequest = {
        customerName: orderCustomerName.trim(),
        customerAddress: orderCustomerAddress.trim(),
        customerPhone: orderCustomerPhone.trim() || undefined,
        paymentMethod: orderPaymentMethod,
        comments: orderComments.trim() || undefined,
        items: orderItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subProducts: item.subProducts
        }))
      };

      const order = await api.createOrder(orderData);
      
      // Asignar el pedido al repartidor
      await api.updateOrderStatus(order.id, 'preparing', selectedDeliveryPersonForOrder);
      
      showToast('Pedido creado y asignado exitosamente', 'success');
      setIsCreateOrderModalOpen(false);
      setOrderCustomerName('');
      setOrderCustomerAddress('');
      setOrderCustomerPhone('');
      setOrderItems([]);
      setOrderPaymentMethod('cash');
      setOrderComments('');
      setSelectedDeliveryPersonForOrder(null);
      
      // Recargar datos
      await loadData();
      if (selectedDeliveryPerson) {
        await loadDeliveryPersonOrders(selectedDeliveryPerson.id);
      }
    } catch (error: any) {
      showToast(error.message || 'Error al crear el pedido', 'error');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const openDetailsModal = async (deliveryPerson: DeliveryPerson) => {
    setSelectedDeliveryPerson(deliveryPerson);
    setIsDetailsModalOpen(true);
    // Si hay caja abierta, mostrar todos los pedidos (incluyendo completados)
    const status = cashRegisterStatuses[deliveryPerson.id];
    const includeCompleted = status?.isOpen || false;
    await loadDeliveryPersonOrders(deliveryPerson.id, includeCompleted);
  };

  const loadDeliveryPersonOrders = async (deliveryPersonId: number, includeCompleted: boolean = false) => {
    try {
      const orders = await api.getDeliveryPersonOrdersByAdmin(deliveryPersonId, includeCompleted);
      setDeliveryPersonOrders(orders);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
      setDeliveryPersonOrders([]);
    }
  };

  const filteredDeliveryPersons = deliveryPersons.filter(dp =>
    dp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dp.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeDeliveryPersons = filteredDeliveryPersons.filter(dp => dp.isActive);
  const inactiveDeliveryPersons = filteredDeliveryPersons.filter(dp => !dp.isActive);

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
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck size={28} className="text-primary-500" />
            Repartidores
          </h1>
          <p className="text-gray-600 mt-1">Gestiona repartidores y crea pedidos de delivery</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Buscar repartidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Cash Register Status Banner */}
      {Object.values(cashRegisterStatuses).some(s => s.isOpen) && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-700">
            <DollarSign size={20} />
            <span className="font-medium">
              {Object.values(cashRegisterStatuses).filter(s => s.isOpen).length} caja(s) abierta(s)
            </span>
          </div>
        </div>
      )}

      {/* Active Delivery Persons */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Repartidores Activos</h2>
        {activeDeliveryPersons.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay repartidores activos</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDeliveryPersons.map(dp => {
              const status = cashRegisterStatuses[dp.id];
              const isOpen = status?.isOpen || false;
              
              return (
                <div
                  key={dp.id}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    isOpen ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{dp.name}</h3>
                      {dp.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Phone size={14} />
                          {dp.phone}
                        </p>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {!isOpen ? (
                      <button
                        onClick={() => handleOpenCashRegisterClick(dp.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium"
                      >
                        <DollarSign size={16} />
                        Abrir Caja
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => openCreateOrderModal(dp.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm font-medium"
                        >
                          <Plus size={16} />
                          Crear Pedido
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDeliveryPerson(dp);
                            setIsCloseCashRegisterModalOpen(true);
                          }}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openDetailsModal(dp)}
                      className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive Delivery Persons */}
      {inactiveDeliveryPersons.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Repartidores Inactivos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveDeliveryPersons.map(dp => (
              <div
                key={dp.id}
                className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50 opacity-60"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{dp.name}</h3>
                    {dp.phone && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <Phone size={14} />
                        {dp.phone}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                    Inactivo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateOrderModalOpen}
        onClose={() => {
          setIsCreateOrderModalOpen(false);
          setOrderCustomerName('');
          setOrderCustomerAddress('');
          setOrderCustomerPhone('');
          setOrderItems([]);
          setOrderPaymentMethod('cash');
          setOrderComments('');
          setSelectedDeliveryPersonForOrder(null);
        }}
        title="Crear Pedido de Delivery"
      >
        <div className="space-y-4">
          {/* Cliente */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Nombre del Cliente *
            </label>
            <input
              type="text"
              value={orderCustomerName}
              onChange={(e) => setOrderCustomerName(e.target.value)}
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
              value={orderCustomerAddress}
              onChange={(e) => setOrderCustomerAddress(e.target.value)}
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
              value={orderCustomerPhone}
              onChange={(e) => setOrderCustomerPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Ej: 099123456"
            />
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Agregar Producto
            </label>
            <div className="flex gap-2">
              <select
                value={selectedCategoryId || ''}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value ? parseInt(e.target.value) : null);
                  setSelectedProductId(null);
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={selectedProductId || ''}
                onChange={(e) => handleProductSelect(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Seleccionar producto</option>
                {products
                  .filter(p => !selectedCategoryId || p.categoryId === selectedCategoryId)
                  .map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${product.price.toFixed(2)}
                    </option>
                  ))}
              </select>
            </div>

            {selectedProductId && productSubProducts.length > 0 && (
              <div className="mt-2 space-y-2">
                <label className="block text-xs font-medium text-gray-600">
                  Guarniciones (opcional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {productSubProducts.map(sp => (
                    <label key={sp.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSubProducts.includes(sp.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSubProducts([...selectedSubProducts, sp.id]);
                          } else {
                            setSelectedSubProducts(selectedSubProducts.filter(id => id !== sp.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{sp.name} (+${sp.price.toFixed(2)})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                value={productQuantity}
                onChange={(e) => setProductQuantity(parseInt(e.target.value) || 1)}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={handleAddProductToOrder}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Items del pedido */}
          {orderItems.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Productos agregados:</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderItems.map((item, idx) => {
                  const itemTotal = item.price * item.quantity;
                  const subProductsTotal = (item.subProducts || []).reduce((sum, sp) => sum + sp.price, 0);
                  return (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{item.quantity}x {item.name}</div>
                        {item.subProducts && item.subProducts.length > 0 && (
                          <div className="text-xs text-gray-600">
                            {item.subProducts.map(sp => sp.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">${(itemTotal + subProductsTotal).toFixed(2)}</span>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t flex justify-between font-bold">
                <span>Total:</span>
                <span className="text-green-600">${calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Método de pago */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Método de Pago
            </label>
            <select
              value={orderPaymentMethod}
              onChange={(e) => setOrderPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {paymentMethods.map(method => (
                <option key={method.name} value={method.name}>
                  {method.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Comentarios */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Comentarios
            </label>
            <textarea
              value={orderComments}
              onChange={(e) => setOrderComments(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="Notas adicionales..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setIsCreateOrderModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateOrder}
              disabled={isCreatingOrder || orderItems.length === 0 || !orderCustomerName.trim() || !orderCustomerAddress.trim()}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingOrder ? 'Creando...' : 'Crear y Asignar Pedido'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedDeliveryPerson(null);
          setDeliveryPersonOrders([]);
        }}
        title={`Repartidor: ${selectedDeliveryPerson?.name}`}
      >
        {selectedDeliveryPerson && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Información</h4>
              <p><strong>Teléfono:</strong> {selectedDeliveryPerson.phone || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedDeliveryPerson.email || 'N/A'}</p>
              <p><strong>Usuario:</strong> {selectedDeliveryPerson.username || 'N/A'}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">
                Pedidos {cashRegisterStatuses[selectedDeliveryPerson.id]?.isOpen ? 'de esta sesión' : 'Asignados'}
                {deliveryPersonOrders.length > 0 && (
                  <span className="text-sm text-gray-500 font-normal ml-2">
                    ({deliveryPersonOrders.length} pedido{deliveryPersonOrders.length !== 1 ? 's' : ''})
                  </span>
                )}
              </h4>
              {deliveryPersonOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay pedidos asignados</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {deliveryPersonOrders.map(order => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Pedido #{order.id}</p>
                          <p className="text-sm text-gray-600">{order.customerName}</p>
                          <p className="text-xs text-gray-500">{order.customerAddress}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${
                          order.status === 'preparing' ? 'bg-orange-100 text-orange-700' :
                          order.status === 'delivering' ? 'bg-purple-100 text-purple-700' :
                          order.status === 'completed' ? 'bg-green-100 text-green-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status === 'preparing' ? 'Preparando' :
                           order.status === 'delivering' ? 'En Camino' :
                           order.status === 'completed' ? 'Completado' :
                           order.status === 'cancelled' ? 'Cancelado' :
                           order.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-green-600 mt-2">${order.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Close Cash Register Modal */}
      <Modal
        isOpen={isCloseCashRegisterModalOpen}
        onClose={() => {
          setIsCloseCashRegisterModalOpen(false);
          setCloseNotes('');
        }}
        title="Cerrar Caja"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            ¿Estás seguro de que deseas cerrar la caja de {selectedDeliveryPerson?.name}?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas (opcional)
            </label>
            <textarea
              value={closeNotes}
              onChange={(e) => setCloseNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
              placeholder="Notas sobre el cierre de caja..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsCloseCashRegisterModalOpen(false);
                setCloseNotes('');
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleCloseCashRegister}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Cerrar Caja
            </button>
          </div>
        </div>
      </Modal>

      {/* Open Cash Register Modal */}
      <Modal
        isOpen={isOpenCashRegisterModalOpen}
        onClose={() => {
          setIsOpenCashRegisterModalOpen(false);
          setInitialAmount('0');
          setSelectedDeliveryPersonForCashRegister(null);
        }}
        title="Abrir Caja de Repartidor"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Ingresa el monto en efectivo que el repartidor llevará de cambio.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Inicial en Efectivo *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={initialAmount}
              onChange={(e) => setInitialAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => {
                setIsOpenCashRegisterModalOpen(false);
                setInitialAmount('0');
                setSelectedDeliveryPersonForCashRegister(null);
              }}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleOpenCashRegister}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Abrir Caja
            </button>
          </div>
        </div>
      </Modal>

      {/* Movements Modal */}
      <Modal
        isOpen={isMovementsModalOpen}
        onClose={() => {
          setIsMovementsModalOpen(false);
          setCashRegisterMovements(null);
        }}
        title="Movimientos de Caja"
      >
        {cashRegisterMovements && (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium mb-3">Resumen</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Monto Inicial:</span>
                  <span className="font-medium ml-2">${cashRegisterMovements.cashRegister.initialAmount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Monto Final:</span>
                  <span className="font-medium ml-2">${cashRegisterMovements.cashRegister.finalAmount?.toFixed(2) || '0.00'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Ventas:</span>
                  <span className="font-medium ml-2 text-green-600">${cashRegisterMovements.summary.totalSales.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Pedidos:</span>
                  <span className="font-medium ml-2">{cashRegisterMovements.summary.totalOrders}</span>
                </div>
                <div>
                  <span className="text-gray-600">Efectivo:</span>
                  <span className="font-medium ml-2">${cashRegisterMovements.summary.totalCash.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">POS:</span>
                  <span className="font-medium ml-2">${cashRegisterMovements.summary.totalPOS.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Transferencia:</span>
                  <span className="font-medium ml-2">${cashRegisterMovements.summary.totalTransfer.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Movimientos */}
            <div>
              <h4 className="font-medium mb-2">Pedidos ({cashRegisterMovements.movements.length})</h4>
              {cashRegisterMovements.movements.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No hay pedidos en esta sesión</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {cashRegisterMovements.movements.map((order: any) => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">Pedido #{order.id}</p>
                          <p className="text-sm text-gray-600">{order.customerName}</p>
                          {order.customerAddress && (
                            <p className="text-xs text-gray-500">{order.customerAddress}</p>
                          )}
                          {order.items && order.items.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              {order.items.slice(0, 2).map((item: any, idx: number) => (
                                <div key={idx}>{item.quantity}x {item.productName}</div>
                              ))}
                              {order.items.length > 2 && <div>+{order.items.length - 2} más...</div>}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs ${
                            order.paymentMethod?.toLowerCase() === 'cash' ? 'bg-green-100 text-green-700' :
                            order.paymentMethod?.toLowerCase() === 'pos' ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {order.paymentMethod || 'N/A'}
                          </span>
                          <p className="text-sm font-medium text-green-600 mt-1">${order.total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Table as TableIcon, Clock, ShoppingCart, X } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import type { Table, Product, Category, SubProduct } from '../types';

const TABLE_STATUSES: { value: string; label: string; color: string; bgColor: string }[] = [
  { value: 'Available', label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'Occupied', label: 'Ocupada', color: 'text-red-700', bgColor: 'bg-red-100' },
  { value: 'Reserved', label: 'Reservada', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'Cleaning', label: 'Limpieza', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'OrderPlaced', label: 'Pedido Realizado', color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

export default function WaiterPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Order creation state
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [tableForOrder, setTableForOrder] = useState<Table | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [orderItems, setOrderItems] = useState<Array<{ id: number; name: string; price: number; quantity: number; subProducts?: Array<{ id: number; name: string; price: number }> }>>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [productSubProducts, setProductSubProducts] = useState<SubProduct[]>([]);
  const [selectedSubProducts, setSelectedSubProducts] = useState<number[]>([]);
  const [orderComments, setOrderComments] = useState<string>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
    loadProducts();
    loadCategories();
    
    // Recargar mesas cada 5 segundos
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const tablesData = await api.getTablesForWaiter();
      setTables(tablesData);
    } catch (error: any) {
      showToast(error.message || 'Error al cargar mesas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const productsData = await api.getProductsForWaiter();
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoriesData = await api.getCategoriesForWaiter();
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading categories:', error);
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
    return matchesSearch;
  });

  const getStatusInfo = (status: string) => {
    return TABLE_STATUSES.find(s => s.value === status) || TABLE_STATUSES[0];
  };

  const handleTableClick = async (table: Table) => {
    // Solo permitir crear pedidos en mesas disponibles
    if (table.status === 'Available') {
      await openCreateOrderModal(table);
    } else {
      showToast('Esta mesa no está disponible para crear pedidos', 'info');
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
    setOrderComments('');
    setIsCreateOrderModalOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!tableForOrder || orderItems.length === 0) {
      showToast('Debes agregar al menos un producto', 'error');
      return;
    }

    try {
      setIsCreatingOrder(true);
      const response = await api.createOrderFromTableForWaiter(tableForOrder.id, {
        items: orderItems,
        paymentMethod: 'cash',
        comments: orderComments || undefined,
      });
      
      showToast(`Pedido #${response.id} creado exitosamente desde ${tableForOrder.number}`, 'success');
      setIsCreateOrderModalOpen(false);
      setTableForOrder(null);
      await loadData();
    } catch (error: any) {
      showToast(error.message || 'Error al crear el pedido', 'error');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando mesas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                <TableIcon className="text-primary-500" size={32} />
                Mesas - Modo Mozo
              </h1>
              <p className="text-gray-600 mt-1">Selecciona una mesa disponible para crear un pedido</p>
            </div>
          </div>
          
          {/* Search */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Buscar por número o ubicación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTables.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-md p-12 text-center">
              <TableIcon size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No hay mesas para mostrar</p>
            </div>
          ) : (
            filteredTables.map((table) => {
              const statusInfo = getStatusInfo(table.status);
              const isAvailable = table.status === 'Available';
              
              return (
                <div
                  key={table.id}
                  className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 cursor-pointer relative ${
                    isAvailable
                      ? 'border-green-400 hover:border-green-500 bg-green-50/30'
                      : 'border-gray-200 hover:border-gray-300 opacity-60'
                  }`}
                  onClick={() => isAvailable && handleTableClick(table)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <TableIcon size={24} className={isAvailable ? 'text-green-500' : 'text-gray-400'} />
                        {table.number}
                      </h3>
                      <p className="text-sm text-gray-500">Capacidad: {table.capacity}</p>
                      {table.orderPlacedAt && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock size={12} />
                          {getTimeElapsed(table.orderPlacedAt)}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {isAvailable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTableClick(table);
                      }}
                      className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <ShoppingCart size={16} />
                      Crear Pedido
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

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
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className="flex flex-col items-center justify-center p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all"
                    >
                      <span className="text-3xl mb-2">{category.icon || '📦'}</span>
                      <span className="text-sm font-medium text-gray-700 text-center">
                        {category.name}
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
                  <span className="text-2xl">{categories.find(c => c.id === selectedCategoryId)?.icon || '📦'}</span>
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
                          onClick={() => {
                            setSelectedProductId(product.id);
                            setProductQuantity(1);
                            setSelectedSubProducts([]);
                            setProductSubProducts([]);
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
                </div>

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
                            setOrderItems([...orderItems, {
                              id: product.id,
                              name: product.name,
                              price: product.price,
                              quantity: productQuantity,
                            }]);
                            setSelectedProductId(null);
                            setProductQuantity(1);
                          }
                        }
                      }}
                      className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      Agregar al Pedido
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Order Items */}
            {orderItems.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Items del Pedido</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orderItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.quantity}x ${item.price.toFixed(2)} = ${(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                      <button
                        onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between pt-2 border-t">
                  <span className="text-lg font-semibold text-gray-800">Total:</span>
                  <span className="text-xl font-bold text-primary-600">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comentarios (opcional)
              </label>
              <textarea
                value={orderComments}
                onChange={(e) => setOrderComments(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={2}
                placeholder="Notas especiales para el pedido..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => {
                  setIsCreateOrderModalOpen(false);
                  setTableForOrder(null);
                  setOrderItems([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isCreatingOrder || orderItems.length === 0}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingOrder ? 'Creando...' : 'Crear Pedido'}
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

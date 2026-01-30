import { useState, useEffect } from 'react';
import { Table as TableIcon, Clock, ShoppingCart, X, Search, Grid, List, MapPin, Users } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import type { Table, Product, Category, SubProduct, TableStatus, Space } from '../types';

const TABLE_STATUSES: { value: TableStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'Available', label: 'Disponible', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'Occupied', label: 'Ocupada', color: 'text-red-700', bgColor: 'bg-red-100' },
  { value: 'Reserved', label: 'Reservada', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'Cleaning', label: 'Limpieza', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'OrderPlaced', label: 'Pedido Realizado', color: 'text-purple-700', bgColor: 'bg-purple-100' },
];

export default function WaiterPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TableStatus | ''>('');
  const [spaceFilter, setSpaceFilter] = useState<number | ''>('');
  const [viewMode, setViewMode] = useState<'grid' | 'floor'>('floor');
  
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
    loadSpaces();
    loadProducts();
    loadCategories();
    
    // Recargar mesas cada 5 segundos
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

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
    const matchesStatus = !statusFilter || table.status === statusFilter;
    return matchesSearch && matchesSpace && matchesStatus;
  });

  const getStatusInfo = (status: TableStatus) => {
    return TABLE_STATUSES.find(s => s.value === status) || TABLE_STATUSES[0];
  };

  const handleTableClick = async (table: Table) => {
    // Permitir crear pedidos en mesas disponibles u ocupadas (para agregar más pedidos)
    if (table.status === 'Available' || table.status === 'Occupied' || table.status === 'OrderPlaced') {
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
      
      // No cerrar el modal automáticamente, permitir crear más pedidos
      // Solo resetear los items del pedido
      setOrderItems([]);
      setSelectedProductId(null);
      setSelectedCategoryId(null);
      setProductQuantity(1);
      setProductSubProducts([]);
      setSelectedSubProducts([]);
      setOrderComments('');
      
      // Recargar datos para actualizar el estado de la mesa
      await loadData();
      
      // Si la respuesta incluye la mesa actualizada, actualizar el estado local
      if (response.table) {
        setTables(prevTables => 
          prevTables.map(t => t.id === response.table.id ? response.table : t)
        );
        // Actualizar tableForOrder con la mesa actualizada
        setTableForOrder(response.table);
      }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <TableIcon className="text-primary-500" size={32} />
              Mesas - Modo Mozo
            </h1>
            <p className="text-gray-600 mt-1">Selecciona una mesa disponible para crear un pedido</p>
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
                Click en una mesa disponible para crear pedido
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
                  const isAvailable = table.status === 'Available' || table.status === 'Occupied' || table.status === 'OrderPlaced';
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
                      onClick={() => isAvailable && handleTableClick(table)}
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
                                background: isAvailable
                                  ? 'radial-gradient(circle at 30% 30%, #4ade80, #22c55e 60%, #16a34a 100%)'
                                  : 'radial-gradient(circle at 30% 30%, #ef4444, #dc2626 60%, #991b1b 100%)',
                                borderColor: isAvailable ? '#16a34a' : '#991b1b',
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
                            background: isAvailable
                              ? 'linear-gradient(135deg, #92400e 0%, #78350f 50%, #451a03 100%)'
                              : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
                            borderColor: isAvailable ? '#451a03' : '#dc2626',
                            boxShadow: isAvailable
                              ? '0 10px 25px rgba(0,0,0,0.3), inset 0 2px 5px rgba(255,255,255,0.1)'
                              : '0 10px 25px rgba(220, 38, 38, 0.5), inset 0 2px 5px rgba(255,255,255,0.1), 0 0 20px rgba(220, 38, 38, 0.3)',
                          }}
                        >
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
                              {table.location && (
                                <div className="text-[9px] mt-1 opacity-90">{table.location}</div>
                              )}
                              {table.spaceId && spaces.find(s => s.id === table.spaceId) && (
                                <div className="text-[9px] mt-1 opacity-90">
                                  {spaces.find(s => s.id === table.spaceId)?.name}
                                </div>
                              )}
                              {table.orderPlacedAt && (
                                <div className="text-[9px] mt-1 opacity-90 flex items-center justify-center gap-1">
                                  <Clock size={8} />
                                  {getTimeElapsed(table.orderPlacedAt)}
                                </div>
                              )}
                            </div>
                            {isAvailable && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTableClick(table);
                                }}
                                className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-primary-500 hover:bg-primary-600 text-white text-xs rounded-lg shadow-lg flex items-center gap-1 transition-colors z-50"
                                title="Crear pedido"
                              >
                                <ShoppingCart size={12} />
                                Pedido
                              </button>
                            )}
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
                const isAvailable = table.status === 'Available' || table.status === 'Occupied' || table.status === 'OrderPlaced';
                const tableSpace = table.spaceId ? spaces.find(s => s.id === table.spaceId) : null;
                
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
                        {table.location && (
                          <div className="flex items-center gap-2 text-gray-600 mt-1">
                            <MapPin size={14} />
                            <span className="text-xs">{table.location}</span>
                          </div>
                        )}
                        {tableSpace && (
                          <div className="flex items-center gap-2 text-gray-600 mt-1">
                            <Users size={14} />
                            <span className="text-xs">{tableSpace.name}</span>
                          </div>
                        )}
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
        )}

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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Trash2, MapPin, Phone, User, CreditCard, LogOut, Package, Truck, AlertCircle } from 'lucide-react';
import { useToast } from '../components/Toast/ToastContext';
import { api } from '../api/client';
import type { Product, Category, PaymentMethod, CreateOrderRequest } from '../types';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  subProducts?: Array<{ id: number; name: string; price: number }>;
}

export default function CustomerOrderPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Customer info
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [comments, setComments] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptImagePreview, setReceiptImagePreview] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [availableDeliveryPersons, setAvailableDeliveryPersons] = useState<Array<{ id: number; name: string; phone?: string }>>([]);
  const [selectedDeliveryPersonId, setSelectedDeliveryPersonId] = useState<number | null>(null);
  const [businessStatus, setBusinessStatus] = useState<{ isOpen: boolean; isWithinHours: boolean; message: string } | null>(null);

  useEffect(() => {
    // Verificar si el usuario está logueado
    const token = localStorage.getItem('customer_token');
    const user = localStorage.getItem('customer_user');
    
    if (!token || !user) {
      navigate('/clientes/login');
      return;
    }

    // Cargar datos del usuario
    try {
      const userData = JSON.parse(user);
      setCustomerName(userData.name || '');
      setCustomerAddress(userData.defaultAddress || '');
      setCustomerPhone(userData.phone || '');
      setRestaurantId(userData.restaurantId || null);
      
      // Cargar nombre del restaurante
      if (userData.restaurantId) {
        loadRestaurantName(userData.restaurantId);
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
    }

    loadData();
    loadBusinessStatus();
    loadAvailableDeliveryPersons();
  }, [navigate]);

  const loadRestaurantName = async (id: number) => {
    try {
      const response = await fetch(`/api/restaurants/${id}`);
      if (response.ok) {
        const restaurant = await response.json();
        setRestaurantName(restaurant.name || '');
      }
    } catch (error) {
      console.error('Error loading restaurant name:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('customer_token');
      
      if (!token) {
        showToast('No estás autenticado', 'error');
        navigate('/clientes/login');
        return;
      }

      // Usar endpoints autenticados que filtran por RestaurantId del token
      const [productsData, categoriesData, paymentMethodsData] = await Promise.all([
        fetch('/api/products', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(res => {
          if (!res.ok) throw new Error('Error al cargar productos');
          return res.json();
        }).catch(() => []),
        fetch('/api/categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(res => {
          if (!res.ok) throw new Error('Error al cargar categorías');
          return res.json();
        }).catch(() => []),
        fetch('/api/orders/payment-methods', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }).then(res => {
          if (!res.ok) throw new Error('Error al cargar métodos de pago');
          return res.json();
        }).catch(() => []),
      ]);
      
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setPaymentMethods(Array.isArray(paymentMethodsData) ? paymentMethodsData : []);
    } catch (error) {
      showToast('Error al cargar productos', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinessStatus = async () => {
    try {
      const token = localStorage.getItem('customer_token');
      if (!token) return;

      const response = await fetch('/api/orders/business-status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const status = await response.json();
        setBusinessStatus({
          isOpen: status.isOpen || false,
          isWithinHours: status.isWithinHours || false,
          message: status.message || 'El negocio está cerrado'
        });
      }
    } catch (error) {
      console.error('Error al cargar estado del negocio:', error);
    }
  };

  const loadAvailableDeliveryPersons = async () => {
    try {
      const token = localStorage.getItem('customer_token');
      if (!token) return;

      const response = await fetch('/api/orders/available-delivery-persons', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const deliveryPersons = await response.json();
        setAvailableDeliveryPersons(Array.isArray(deliveryPersons) ? deliveryPersons : []);
      } else {
        setAvailableDeliveryPersons([]);
      }
    } catch (error) {
      console.error('Error al cargar repartidores disponibles:', error);
      setAvailableDeliveryPersons([]);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }]);
    }
    showToast(`${product.name} agregado al carrito`, 'success');
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity <= 0) return null;
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      showToast('Agrega al menos un producto al carrito', 'error');
      return;
    }

    if (!customerName.trim() || !customerAddress.trim()) {
      showToast('Nombre y dirección son requeridos', 'error');
      return;
    }

    // Validar horario del negocio
    if (businessStatus && (!businessStatus.isOpen || !businessStatus.isWithinHours)) {
      showToast(businessStatus.message || 'El negocio está cerrado en este momento', 'error');
      return;
    }

    // Validar que haya repartidores disponibles si no se seleccionó uno
    if (availableDeliveryPersons.length === 0 && !selectedDeliveryPersonId) {
      showToast('No hay repartidores disponibles en este momento. Por favor, intenta más tarde.', 'error');
      return;
    }

    // Validar comprobante si es transferencia
    const isTransfer = selectedPaymentMethod.toLowerCase().includes('transfer') || 
                       selectedPaymentMethod.toLowerCase().includes('transferencia');
    if (isTransfer && !receiptImage) {
      showToast('Debes adjuntar el comprobante de transferencia', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      
      const orderData: CreateOrderRequest = {
        customerName: customerName.trim(),
        customerAddress: customerAddress.trim(),
        customerPhone: customerPhone.trim() || undefined,
        paymentMethod: selectedPaymentMethod,
        comments: comments.trim() || undefined,
        receiptImage: receiptImage || undefined,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subProducts: item.subProducts
        })),
        // Flag para indicar que viene de clientesDelivery y requiere repartidor
        source: 'clientesDelivery',
        // Asignar repartidor si se seleccionó uno
        deliveryPersonId: selectedDeliveryPersonId || undefined
      };

      const token = localStorage.getItem('customer_token');
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al crear el pedido');
      }

      const order = await response.json();
      const orderDisplayNumber = order.orderNumber || order.id;
      showToast(`Pedido #${orderDisplayNumber} creado exitosamente. Será asignado a un repartidor.`, 'success');
      
      // Limpiar carrito y formulario
      setCart([]);
      setComments('');
      setReceiptImage(null);
      setReceiptImagePreview(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear el pedido';
      showToast(errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
    navigate('/clientes/login');
  };

  const filteredProducts = selectedCategoryId
    ? products.filter(p => p.categoryId === selectedCategoryId)
    : products;

  // Separar productos recomendados
  const recommendedProducts = products.filter(p => p.isRecommended && p.isAvailable);
  const regularProducts = filteredProducts.filter(p => !p.isRecommended || !p.isAvailable);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart size={28} className="text-primary-500" />
              Realizar Pedido
            </h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <LogOut size={20} />
              Salir
            </button>
          </div>
          {restaurantName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Package size={16} className="text-primary-500" />
              <span className="font-semibold">Restaurante:</span>
              <span className="text-primary-600 font-bold">{restaurantName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Productos */}
          <div className="lg:col-span-2 space-y-4">
            {/* Categorías */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategoryId === null
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Todos
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                      selectedCategoryId === category.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.icon} {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Productos Recomendados */}
            {recommendedProducts.length > 0 && selectedCategoryId === null && (
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg shadow-md p-4 border-2 border-yellow-300">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">⭐</span>
                  <h2 className="text-xl font-bold text-gray-800">Recomendados</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recommendedProducts.map(product => (
                    <div key={product.id} className="bg-white border-2 border-yellow-400 rounded-lg overflow-hidden hover:shadow-lg transition-all transform hover:scale-105">
                      {product.image && (
                        <div className="w-full h-48 overflow-hidden bg-gray-100">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-1 mb-1">
                              <h3 className="font-bold text-gray-800">{product.name}</h3>
                              <span className="text-yellow-500">⭐</span>
                            </div>
                            {product.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xl font-bold text-primary-600">${product.price.toFixed(2)}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2 font-medium"
                          >
                            <Plus size={18} />
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Productos */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Productos</h2>
              {regularProducts.length === 0 && recommendedProducts.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay productos disponibles</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {regularProducts.map(product => (
                    <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-all">
                      {product.image && (
                        <div className="w-full h-48 overflow-hidden bg-gray-100">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800">{product.name}</h3>
                            {product.description && (
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="font-bold text-primary-600 text-lg">${product.price.toFixed(2)}</span>
                          <button
                            onClick={() => addToCart(product)}
                            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2"
                          >
                            <Plus size={18} />
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Carrito y Checkout */}
          <div className="space-y-4">
            {/* Carrito */}
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-20">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ShoppingCart size={24} />
                Carrito ({cart.length})
              </h2>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">El carrito está vacío</p>
              ) : (
                <>
                  <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">${item.price.toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1 hover:bg-red-100 text-red-600 rounded ml-2"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-gray-800">Total:</span>
                      <span className="text-2xl font-bold text-primary-600">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Formulario de Checkout */}
            {cart.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Datos de Entrega</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User size={16} className="inline mr-1" />
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tu nombre"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin size={16} className="inline mr-1" />
                      Dirección *
                    </label>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Calle y número"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone size={16} className="inline mr-1" />
                      Teléfono
                    </label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="099123456"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CreditCard size={16} className="inline mr-1" />
                      Método de Pago *
                    </label>
                    <select
                      value={selectedPaymentMethod}
                      onChange={(e) => {
                        setSelectedPaymentMethod(e.target.value);
                        if (!e.target.value.toLowerCase().includes('transfer')) {
                          setReceiptImage(null);
                          setReceiptImagePreview(null);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {paymentMethods.map(method => (
                        <option key={method.id} value={method.name}>
                          {method.displayName || method.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Repartidor */}
                  {availableDeliveryPersons.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Truck size={16} className="inline mr-1" />
                        Repartidor (Opcional)
                      </label>
                      <select
                        value={selectedDeliveryPersonId || ''}
                        onChange={(e) => setSelectedDeliveryPersonId(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Seleccionar repartidor (o asignar desde cocina)</option>
                        {availableDeliveryPersons.map(deliveryPerson => (
                          <option key={deliveryPerson.id} value={deliveryPerson.id}>
                            {deliveryPerson.name} {deliveryPerson.phone ? `(${deliveryPerson.phone})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Si no seleccionas un repartidor, se asignará uno desde cocina
                      </p>
                    </div>
                  )}

                  {/* Alerta si no hay repartidores disponibles */}
                  {availableDeliveryPersons.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">No hay repartidores disponibles</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          El pedido será asignado a un repartidor desde cocina cuando esté disponible
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Comprobante para transferencia */}
                  {(selectedPaymentMethod.toLowerCase().includes('transfer') || 
                    selectedPaymentMethod.toLowerCase().includes('transferencia')) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Comprobante de Transferencia {receiptImage ? '(Adjuntado)' : '*'}
                      </label>
                      {receiptImagePreview ? (
                        <div className="relative">
                          <img
                            src={receiptImagePreview}
                            alt="Vista previa"
                            className="w-full max-h-32 object-contain border border-gray-300 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptImage(null);
                              setReceiptImagePreview(null);
                            }}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                          <input
                            type="file"
                            id="receipt-upload"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const base64String = reader.result as string;
                                  setReceiptImage(base64String);
                                  setReceiptImagePreview(base64String);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                          <label
                            htmlFor="receipt-upload"
                            className="cursor-pointer flex flex-col items-center gap-2"
                          >
                            <Package size={24} className="text-gray-400" />
                            <span className="text-sm text-gray-600">Haz clic para adjuntar comprobante</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comentarios
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Instrucciones especiales..."
                    />
                  </div>

                  <button
                    onClick={handleSubmitOrder}
                    disabled={isSubmitting || cart.length === 0}
                    className="w-full px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={20} />
                        Realizar Pedido (${calculateTotal().toFixed(2)})
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

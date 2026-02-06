import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast/ToastContext';
import { Navigate } from 'react-router-dom';
import { Plus, Trash2, Edit, Building2, Search, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface Restaurant {
  id: number;
  name: string;
  identifier: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  adminsCount?: number;
  productsCount?: number;
  ordersCount?: number;
}

export default function SuperAdminPage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    identifier: '',
    address: '',
    phone: '',
    email: '',
    adminName: '',
    adminUsername: '',
    adminPassword: '',
    adminEmail: '',
  });

  // Verificar que el usuario sea SuperAdmin
  if (!user || user.role !== 'SuperAdmin') {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/restaurants`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al cargar restaurantes');
      }

      const data = await response.json();
      setRestaurants(data);
    } catch (error) {
      showToast('Error al cargar restaurantes', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.name || !formData.identifier) {
        showToast('Nombre e identificador son requeridos', 'error');
        return;
      }

      if (!formData.adminName || !formData.adminUsername || !formData.adminPassword || !formData.adminEmail) {
        showToast('Todos los datos del usuario admin son requeridos', 'error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/restaurants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear restaurante');
      }

      showToast('Restaurante creado exitosamente con usuario admin', 'success');
      setIsCreateModalOpen(false);
      setFormData({ 
        name: '', 
        identifier: '', 
        address: '', 
        phone: '', 
        email: '',
        adminName: '',
        adminUsername: '',
        adminPassword: '',
        adminEmail: '',
      });
      fetchRestaurants();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear restaurante';
      showToast(errorMessage, 'error');
    }
  };

  const handleEdit = async () => {
    if (!selectedRestaurant) return;

    try {
      // Solo enviar datos del restaurante, no del admin
      const restaurantData = {
        name: formData.name,
        identifier: formData.identifier,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
      };

      const response = await fetch(`/api/restaurants/${selectedRestaurant.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(restaurantData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar restaurante');
      }

      showToast('Restaurante actualizado exitosamente', 'success');
      setIsEditModalOpen(false);
      setSelectedRestaurant(null);
      setFormData({ 
        name: '', 
        identifier: '', 
        address: '', 
        phone: '', 
        email: '',
        adminName: '',
        adminUsername: '',
        adminPassword: '',
        adminEmail: '',
      });
      fetchRestaurants();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar restaurante';
      showToast(errorMessage, 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas desactivar este restaurante?')) {
      return;
    }

    try {
      const response = await fetch(`/api/restaurants/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Error al desactivar restaurante');
      }

      showToast('Restaurante desactivado exitosamente', 'success');
      fetchRestaurants();
    } catch (error) {
      showToast('Error al desactivar restaurante', 'error');
    }
  };

  const openEditModal = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setFormData({
      name: restaurant.name,
      identifier: restaurant.identifier,
      address: restaurant.address || '',
      phone: restaurant.phone || '',
      email: restaurant.email || '',
      adminName: '',
      adminUsername: '',
      adminPassword: '',
      adminEmail: '',
    });
    setIsEditModalOpen(true);
  };

  const filteredRestaurants = restaurants.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    restaurant.identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="text-primary-500" size={32} />
                Gestión de Restaurantes
              </h1>
              <p className="text-gray-600 mt-1">Administra los restaurantes del sistema</p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus size={20} />
              Nuevo Restaurante
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre o identificador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Restaurants List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            <p className="mt-4 text-gray-600">Cargando restaurantes...</p>
          </div>
        ) : filteredRestaurants.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Building2 className="mx-auto text-gray-400" size={48} />
            <p className="mt-4 text-gray-600">No se encontraron restaurantes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">{restaurant.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">ID: {restaurant.identifier}</p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      restaurant.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {restaurant.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {restaurant.address && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Dirección:</span> {restaurant.address}
                    </p>
                  )}
                  {restaurant.phone && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Teléfono:</span> {restaurant.phone}
                    </p>
                  )}
                  {restaurant.email && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Email:</span> {restaurant.email}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    Creado: {new Date(restaurant.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(restaurant)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(restaurant.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Desactivar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Nuevo Restaurante</h2>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setFormData({ 
                    name: '', 
                    identifier: '', 
                    address: '', 
                    phone: '', 
                    email: '',
                    adminName: '',
                    adminUsername: '',
                    adminPassword: '',
                    adminEmail: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Datos del Restaurante */}
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos del Restaurante</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Nombre del restaurante"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identificador <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.identifier}
                      onChange={(e) => setFormData({ ...formData, identifier: e.target.value.toLowerCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="restaurante1"
                    />
                    <p className="text-xs text-gray-500 mt-1">Usado para login (solo minúsculas, sin espacios)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Dirección del restaurante"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Teléfono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="email@restaurante.com"
                    />
                  </div>
                </div>
              </div>

              {/* Datos del Usuario Admin */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Usuario Admin Inicial</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del Admin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Nombre completo del administrador"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.adminUsername}
                      onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="usuario_admin"
                    />
                    <p className="text-xs text-gray-500 mt-1">Usuario para login en el sistema</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="admin@restaurante.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.adminPassword}
                      onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Contraseña del administrador"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres recomendado</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setFormData({ 
                    name: '', 
                    identifier: '', 
                    address: '', 
                    phone: '', 
                    email: '',
                    adminName: '',
                    adminUsername: '',
                    adminPassword: '',
                    adminEmail: '',
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Crear Restaurante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedRestaurant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Editar Restaurante</h2>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedRestaurant(null);
                  setFormData({ 
                    name: '', 
                    identifier: '', 
                    address: '', 
                    phone: '', 
                    email: '',
                    adminName: '',
                    adminUsername: '',
                    adminPassword: '',
                    adminEmail: '',
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Identificador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value.toLowerCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedRestaurant(null);
                  setFormData({ name: '', identifier: '', address: '', phone: '', email: '' });
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

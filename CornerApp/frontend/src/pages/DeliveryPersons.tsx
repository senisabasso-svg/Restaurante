import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, Phone, Mail, User, Package, MapPin, Clock } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import type { DeliveryPerson, CreateDeliveryPersonRequest } from '../types';

export default function DeliveryPersonsPage() {
  const [deliveryPersons, setDeliveryPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<DeliveryPerson | null>(null);
  const [deletePerson, setDeletePerson] = useState<DeliveryPerson | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateDeliveryPersonRequest & { isActive?: boolean }>({
    name: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    isActive: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getDeliveryPersons();
      setDeliveryPersons(data);
    } catch (error) {
      showToast('Error al cargar repartidores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPerson(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      username: '',
      password: '',
      isActive: true,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (person: DeliveryPerson) => {
    setEditingPerson(person);
    setFormData({
      name: person.name,
      phone: person.phone || '',
      email: person.email || '',
      username: person.username,
      password: '',
      isActive: person.isActive,
    });
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (!formData.username.trim()) {
      showToast('El usuario es requerido', 'error');
      return;
    }
    if (!editingPerson && !formData.password) {
      showToast('La contraseña es requerida', 'error');
      return;
    }

    try {
      setFormLoading(true);
      if (editingPerson) {
        await api.updateDeliveryPerson(editingPerson.id, {
          ...formData,
          id: editingPerson.id,
          password: formData.password || undefined,
        });
        showToast('Repartidor actualizado correctamente');
      } else {
        await api.createDeliveryPerson(formData);
        showToast('Repartidor creado correctamente');
      }
      setIsFormModalOpen(false);
      loadData();
    } catch (error) {
      showToast(editingPerson ? 'Error al actualizar repartidor' : 'Error al crear repartidor', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePerson) return;
    try {
      await api.deleteDeliveryPerson(deletePerson.id);
      showToast('Repartidor eliminado correctamente');
      setDeletePerson(null);
      loadData();
    } catch (error) {
      showToast('Error al eliminar repartidor', 'error');
    }
  };

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
          <div>
            <h1 className="text-xl font-bold text-gray-800">🚚 Gestión de Repartidores</h1>
            <p className="text-sm text-gray-500">{deliveryPersons.length} repartidores registrados</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            Nuevo Repartidor
          </button>
        </div>
      </div>

      {/* Delivery Persons Grid */}
      {deliveryPersons.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No hay repartidores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliveryPersons.map((person) => (
            <div
              key={person.id}
              className={`bg-white rounded-xl shadow-md p-6 ${!person.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{person.name}</h3>
                    <p className="text-sm text-gray-500">@{person.username}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${person.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
                  }`}>
                  {person.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {person.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone size={14} />
                    <span>{person.phone}</span>
                  </div>
                )}
                {person.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail size={14} />
                    <span>{person.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User size={14} />
                  <span>Usuario: {person.username}</span>
                </div>
              </div>

              {/* Active Orders Section */}
              <div className="border-t border-gray-100 pt-4 mt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Package size={12} />
                    Pedidos Asignados
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${(person.activeOrders?.length || 0) > 0
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-500'
                    }`}>
                    {person.activeOrders?.length || 0}
                  </span>
                </div>

                {person.activeOrders && person.activeOrders.length > 0 ? (
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {person.activeOrders.map((order) => (
                      <div key={order.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 hover:border-primary-200 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-primary-600">#{order.id}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${order.status === 'delivering'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-700'
                            }`}>
                            {order.status === 'delivering' ? 'En Camino' : 'Preparando'}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{order.customerName}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <MapPin size={10} />
                            <span className="line-clamp-1">{order.customerAddress}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100 shadow-sm" title="Hora de asignación">
                            <Clock size={10} className="text-primary-500" />
                            {order.assignedAt ? new Date(order.assignedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 italic">Sin pedidos activos</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(person)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg font-medium transition-colors"
                >
                  <Edit2 size={14} />
                  Editar
                </button>
                <button
                  onClick={() => setDeletePerson(person)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                >
                  <Trash2 size={14} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingPerson ? '✏️ Editar Repartidor' : '➕ Nuevo Repartidor'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="deliveryPersonName" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              id="deliveryPersonName"
              name="deliveryPersonName"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nombre completo"
              autoComplete="name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="deliveryPersonPhone" className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                id="deliveryPersonPhone"
                name="deliveryPersonPhone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Número de teléfono"
                autoComplete="tel"
              />
            </div>
            <div>
              <label htmlFor="deliveryPersonEmail" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                id="deliveryPersonEmail"
                name="deliveryPersonEmail"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="deliveryPersonUsername" className="block text-sm font-medium text-gray-700 mb-1">Usuario *</label>
            <input
              type="text"
              id="deliveryPersonUsername"
              name="deliveryPersonUsername"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nombre de usuario para login"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label htmlFor="deliveryPersonPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña {editingPerson ? '(dejar vacío para no cambiar)' : '*'}
            </label>
            <input
              type="password"
              id="deliveryPersonPassword"
              name="deliveryPersonPassword"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={editingPerson ? '••••••••' : 'Contraseña'}
              autoComplete="new-password"
              required={!editingPerson}
            />
          </div>

          {editingPerson && (
            <div>
              <label htmlFor="deliveryPersonIsActive" className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="deliveryPersonIsActive"
                  name="deliveryPersonIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Repartidor activo</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {formLoading ? 'Guardando...' : (editingPerson ? 'Guardar Cambios' : 'Crear Repartidor')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deletePerson}
        onClose={() => setDeletePerson(null)}
        onConfirm={handleDelete}
        title="Eliminar Repartidor"
        message={`¿Estás seguro de eliminar a "${deletePerson?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}


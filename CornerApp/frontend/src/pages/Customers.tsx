import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Eye,
  Trash2,
  Trophy,
  ShoppingBag,
  DollarSign,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import Pagination from '../components/Pagination/Pagination';
import type { Customer } from '../types';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [stats, setStats] = useState<{
    totalCustomers: number;
    totalPoints: number;
    customersWithOrders: number;
  } | null>(null);
  
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersData, statsData] = await Promise.all([
        api.getCustomers({ search: searchTerm }),
        api.getCustomerStats(),
      ]);
      setCustomers(customersData.data);
      setStats(statsData);
    } catch (error) {
      showToast('Error al cargar clientes', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData();
  };

  const openDetailsModal = async (customer: Customer) => {
    try {
      const details = await api.getCustomer(customer.id);
      setSelectedCustomer(details);
      setIsDetailsModalOpen(true);
    } catch (error) {
      showToast('Error al cargar detalles', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    try {
      await api.deleteCustomer(selectedCustomer.id);
      showToast('Cliente eliminado', 'success');
      setIsDeleteModalOpen(false);
      setSelectedCustomer(null);
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar';
      showToast(errorMessage, 'error');
    }
  };

  // Paginación
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = customers.slice(startIndex, endIndex);

  // Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
        <div className="flex items-center gap-3">
          <Link 
            to="/admin" 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">👥 Registro de Clientes</h1>
            <p className="text-sm text-gray-500">Consulta y gestiona los clientes registrados</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Clientes</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalCustomers}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <ShoppingBag size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Con Pedidos</p>
              <p className="text-2xl font-bold text-gray-800">{stats.customersWithOrders}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Trophy size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Puntos Totales</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalPoints.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              id="searchCustomers"
              name="searchCustomers"
              placeholder="Buscar por nombre, teléfono, email o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Buscar
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Contacto</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Dirección</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Pedidos</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Total Gastado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Puntos</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Users size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No hay clientes registrados</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{customer.name}</div>
                      <div className="text-xs text-gray-400">
                        Desde {new Date(customer.createdAt).toLocaleDateString('es-ES')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {customer.phone && (
                        <div className="text-sm text-gray-600">📱 {customer.phone}</div>
                      )}
                      {customer.email && (
                        <div className="text-sm text-gray-600">✉️ {customer.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {customer.defaultAddress || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        <ShoppingBag size={14} />
                        {customer.ordersCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-green-600">
                        ${customer.totalSpent?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        <Trophy size={14} />
                        {customer.points}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openDetailsModal(customer)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                          title="Ver detalles"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Details Modal */}
      <Modal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedCustomer(null);
        }}
        title={`Cliente: ${selectedCustomer?.name || ''}`}
      >
        {selectedCustomer && (
          <div className="space-y-4">
            {/* Contact Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">📇 Información de Contacto</h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Nombre:</span> <span className="font-medium">{selectedCustomer.name}</span></p>
                {selectedCustomer.phone && (
                  <p><span className="text-gray-500">Teléfono:</span> <span className="font-medium">{selectedCustomer.phone}</span></p>
                )}
                {selectedCustomer.email && (
                  <p><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedCustomer.email}</span></p>
                )}
                {selectedCustomer.defaultAddress && (
                  <p><span className="text-gray-500">Dirección:</span> <span className="font-medium">{selectedCustomer.defaultAddress}</span></p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <ShoppingBag size={24} className="mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold text-gray-800">{selectedCustomer.ordersCount}</p>
                <p className="text-xs text-gray-500">Pedidos</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <DollarSign size={24} className="mx-auto mb-2 text-green-600" />
                <p className="text-2xl font-bold text-gray-800">${selectedCustomer.totalSpent?.toFixed(0) || 0}</p>
                <p className="text-xs text-gray-500">Gastado</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <Trophy size={24} className="mx-auto mb-2 text-yellow-600" />
                <p className="text-2xl font-bold text-gray-800">{selectedCustomer.points}</p>
                <p className="text-xs text-gray-500">Puntos</p>
              </div>
            </div>

            {/* Recent Orders */}
            {selectedCustomer.recentOrders && selectedCustomer.recentOrders.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-800 mb-2">🛒 Últimos Pedidos</h4>
                <div className="space-y-2">
                  {selectedCustomer.recentOrders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-200 last:border-0">
                      <div>
                        <span className="font-medium text-primary-600">#{order.id}</span>
                        <span className="text-gray-400 ml-2">
                          {new Date(order.createdAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                      <span className="font-bold text-green-600">${order.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="text-xs text-gray-500 text-center">
              Cliente desde: {new Date(selectedCustomer.createdAt).toLocaleDateString('es-ES')}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedCustomer(null);
        }}
        onConfirm={handleDelete}
        title="Eliminar Cliente"
        message={`¿Estás seguro de eliminar a "${selectedCustomer?.name}"? Solo se puede eliminar si no tiene pedidos asociados.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}


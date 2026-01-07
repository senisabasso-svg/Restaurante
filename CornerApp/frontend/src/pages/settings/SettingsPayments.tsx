import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Edit2, 
  Trash2, 
  ArrowLeft,
  Check,
  X,
  GripVertical,
  Receipt
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast/ToastContext';
import Modal from '../../components/Modal/Modal';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import type { PaymentMethod, CreatePaymentMethodRequest, UpdatePaymentMethodRequest } from '../../types';

const ICONS = ['💵', '💳', '📱', '🏦', '💰', '🔄', '✅', '🎁'];

export default function SettingsPaymentsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState<CreatePaymentMethodRequest>({
    name: '',
    displayName: '',
    icon: '💳',
    description: '',
    requiresReceipt: false,
    isActive: true,
    displayOrder: 0,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    accountType: '',
    accountAlias: '',
  });
  const { showToast } = useToast();

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const data = await api.getAllPaymentMethods();
      setPaymentMethods(data);
    } catch (error) {
      showToast('Error al cargar métodos de pago', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setSelectedMethod(null);
    setFormData({
      name: '',
      displayName: '',
      icon: '💳',
      description: '',
      requiresReceipt: false,
      isActive: true,
      displayOrder: paymentMethods.length,
      bankName: '',
      accountNumber: '',
      accountHolder: '',
      accountType: '',
      accountAlias: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setFormData({
      name: method.name,
      displayName: method.displayName,
      icon: method.icon || '💳',
      description: method.description || '',
      requiresReceipt: method.requiresReceipt,
      isActive: method.isActive,
      displayOrder: method.displayOrder,
      bankName: method.bankName || '',
      accountNumber: method.accountNumber || '',
      accountHolder: method.accountHolder || '',
      accountType: method.accountType || '',
      accountAlias: method.accountAlias || '',
    });
    setIsModalOpen(true);
  };

  const openDeleteModal = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.displayName.trim()) {
      showToast('Nombre interno y nombre para mostrar son requeridos', 'error');
      return;
    }

    try {
      if (selectedMethod) {
        await api.updatePaymentMethod(selectedMethod.id, formData as UpdatePaymentMethodRequest);
        showToast('Método de pago actualizado', 'success');
      } else {
        await api.createPaymentMethod(formData);
        showToast('Método de pago creado', 'success');
      }
      setIsModalOpen(false);
      loadPaymentMethods();
    } catch (error) {
      showToast('Error al guardar método de pago', 'error');
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!selectedMethod) return;

    try {
      await api.deletePaymentMethod(selectedMethod.id);
      showToast('Método de pago eliminado', 'success');
      setIsDeleteModalOpen(false);
      loadPaymentMethods();
    } catch (error) {
      showToast('Error al eliminar método de pago', 'error');
      console.error(error);
    }
  };

  const toggleActive = async (method: PaymentMethod) => {
    try {
      await api.updatePaymentMethod(method.id, { isActive: !method.isActive });
      showToast(`Método ${method.isActive ? 'desactivado' : 'activado'}`, 'success');
      loadPaymentMethods();
    } catch (error) {
      showToast('Error al actualizar estado', 'error');
      console.error(error);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              to="/admin" 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-800">💳 Métodos de Pago</h1>
              <p className="text-sm text-gray-500">Gestiona los métodos de pago disponibles</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>

      {/* Payment Methods List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {paymentMethods.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CreditCard size={48} className="mx-auto mb-4 opacity-50" />
            <p>No hay métodos de pago configurados</p>
            <button
              onClick={openCreateModal}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                  !method.isActive ? 'opacity-60 bg-gray-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-gray-300 cursor-grab">
                    <GripVertical size={20} />
                  </div>
                  <div className="text-2xl">{method.icon || '💳'}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-800">{method.displayName}</h3>
                      {method.requiresReceipt && (
                        <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                          <Receipt size={12} />
                          Requiere recibo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Nombre interno: <code className="bg-gray-100 px-1 rounded">{method.name}</code>
                    </p>
                    {method.description && (
                      <p className="text-sm text-gray-400 mt-1">{method.description}</p>
                    )}
                    {method.bankName && (
                      <p className="text-xs text-gray-400 mt-1">
                        🏦 {method.bankName}
                        {method.accountAlias && <span className="ml-2 font-mono">{method.accountAlias}</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Toggle Active */}
                  <button
                    onClick={() => toggleActive(method)}
                    className={`p-2 rounded-lg transition-colors ${
                      method.isActive
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                    title={method.isActive ? 'Desactivar' : 'Activar'}
                  >
                    {method.isActive ? <Check size={18} /> : <X size={18} />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => openEditModal(method)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => openDeleteModal(method)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedMethod ? 'Editar Método de Pago' : 'Nuevo Método de Pago'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon }))}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                    formData.icon === icon
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre para mostrar *
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="Ej: Efectivo, Tarjeta de Crédito"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          {/* Internal Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre interno *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
              placeholder="Ej: cash, credit_card"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Se usará en la API (sin espacios, minúsculas)</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <input
              type="text"
              id="description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Options Row */}
          <div className="flex gap-4">
            {/* Requires Receipt */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="requiresReceipt"
                name="requiresReceipt"
                checked={formData.requiresReceipt}
                onChange={(e) => setFormData(prev => ({ ...prev, requiresReceipt: e.target.checked }))}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Requiere comprobante</span>
            </label>

            {/* Is Active */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          </div>

          {/* Display Order */}
          <div>
            <label htmlFor="displayOrder" className="block text-sm font-medium text-gray-700 mb-1">
              Orden de visualización
            </label>
            <input
              type="number"
              id="displayOrder"
              name="displayOrder"
              value={formData.displayOrder}
              onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
              min="0"
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Bank Information Section */}
          {formData.requiresReceipt && (
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium text-gray-800 mb-3 flex items-center gap-2">
                🏦 Información Bancaria
                <span className="text-xs font-normal text-gray-500">(para transferencias)</span>
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Bank Name */}
                <div>
                  <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-1">
                    Banco
                  </label>
                  <input
                    type="text"
                    id="bankName"
                    name="bankName"
                    value={formData.bankName}
                    onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Ej: Banco Nación"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Account Type */}
                <div>
                  <label htmlFor="accountType" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de cuenta
                  </label>
                  <select
                    id="accountType"
                    name="accountType"
                    value={formData.accountType}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Caja de Ahorro">Caja de Ahorro</option>
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                    <option value="Cuenta Vista">Cuenta Vista</option>
                  </select>
                </div>

                {/* Account Holder */}
                <div>
                  <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-1">
                    Titular
                  </label>
                  <input
                    type="text"
                    id="accountHolder"
                    name="accountHolder"
                    value={formData.accountHolder}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountHolder: e.target.value }))}
                    placeholder="Nombre del titular"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Número de cuenta
                  </label>
                  <input
                    type="text"
                    id="accountNumber"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Ej: 1234567890"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Account Alias (CBU/CLABE) */}
                <div className="md:col-span-2">
                  <label htmlFor="accountAlias" className="block text-sm font-medium text-gray-700 mb-1">
                    CBU / Alias / CLABE
                  </label>
                  <input
                    type="text"
                    id="accountAlias"
                    name="accountAlias"
                    value={formData.accountAlias}
                    onChange={(e) => setFormData(prev => ({ ...prev, accountAlias: e.target.value }))}
                    placeholder="Ej: mi.alias.banco o 0000000000000000000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {selectedMethod ? 'Guardar cambios' : 'Crear método'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Eliminar Método de Pago"
        message={`¿Estás seguro de eliminar "${selectedMethod?.displayName}"? Si tiene pedidos asociados, se desactivará en lugar de eliminarse.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}


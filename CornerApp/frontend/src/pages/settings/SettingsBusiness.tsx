import { useState, useEffect } from 'react';
import {
  Store,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Instagram,
  Facebook,
  Clock,
  DollarSign,
  Timer,
  Save,
  Power,
  Loader2,
  CheckCircle,
  Webhook
} from 'lucide-react';
import { useToast } from '../../components/Toast/ToastContext';
import api from '../../api/client';
import type { BusinessInfo, UpdateBusinessInfoRequest } from '../../types';

export default function SettingsBusinessPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [formData, setFormData] = useState<UpdateBusinessInfoRequest>({});

  useEffect(() => {
    loadBusinessInfo();
  }, []);

  const loadBusinessInfo = async () => {
    try {
      setLoading(true);
      const data = await api.getBusinessInfo();
      setBusinessInfo(data);
      setFormData({
        storeName: data.storeName,
        description: data.description || '',
        address: data.address || '',
        storeLatitude: data.storeLatitude,
        storeLongitude: data.storeLongitude,
        phone: data.phone || '',
        whatsApp: data.whatsApp || '',
        email: data.email || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        businessHours: data.businessHours || '',
        openingTime: data.openingTime || '20:00',
        closingTime: data.closingTime || '00:00',
        minimumOrderAmount: data.minimumOrderAmount,
        estimatedDeliveryMinutes: data.estimatedDeliveryMinutes,
        isOpen: data.isOpen,
        welcomeMessage: data.welcomeMessage || '',
        closedMessage: data.closedMessage || '',
        pointsPerOrder: data.pointsPerOrder || 1,
        orderCompletionWebhookUrl: data.orderCompletionWebhookUrl || '',
      });
    } catch (error) {
      showToast('Error al cargar la información del negocio', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateBusinessInfo(formData);
      setBusinessInfo(updated);
      showToast('Información guardada correctamente', 'success');
    } catch (error) {
      showToast('Error al guardar la información', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOpen = async () => {
    try {
      const result = await api.toggleBusinessOpen();
      setFormData(prev => ({ ...prev, isOpen: result.isOpen }));
      if (businessInfo) {
        setBusinessInfo({ ...businessInfo, isOpen: result.isOpen });
      }
      showToast(result.message, 'success');
    } catch (error) {
      showToast('Error al cambiar el estado', 'error');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Store size={28} className="text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Datos del Negocio</h1>
              <p className="text-gray-500">Configura la información de tu tienda</p>
            </div>
          </div>

          {/* Toggle abierto/cerrado */}
          <button
            onClick={handleToggleOpen}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${formData.isOpen
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
          >
            <Power size={18} />
            {formData.isOpen ? 'Abierto' : 'Cerrado'}
          </button>
        </div>
      </div>

      {/* Formulario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Información básica */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Store size={20} className="text-primary-500" />
            Información Básica
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Tienda *
              </label>
              <input
                type="text"
                id="storeName"
                name="storeName"
                value={formData.storeName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, storeName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Mi Tienda"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe tu negocio..."
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline mr-1" />
                Dirección
              </label>
              <input
                type="text"
                id="address"
                name="address"
                value={formData.address || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Calle 123, Ciudad"
              />
            </div>

            {/* Coordenadas del negocio */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPin size={16} className="text-blue-600" />
                Coordenadas del Negocio
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Estas coordenadas se usan para calcular distancias de entrega y validar zonas de cobertura.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="storeLatitude" className="block text-sm font-medium text-gray-700 mb-1">
                    Latitud
                  </label>
                  <input
                    type="number"
                    id="storeLatitude"
                    name="storeLatitude"
                    step="0.000001"
                    value={formData.storeLatitude ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, storeLatitude: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="-31.3833"
                  />
                </div>
                <div>
                  <label htmlFor="storeLongitude" className="block text-sm font-medium text-gray-700 mb-1">
                    Longitud
                  </label>
                  <input
                    type="number"
                    id="storeLongitude"
                    name="storeLongitude"
                    step="0.000001"
                    value={formData.storeLongitude ?? ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, storeLongitude: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="-57.9667"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Ejemplo para Salto, Uruguay: Latitud -31.3833, Longitud -57.9667
              </p>
            </div>
          </div>
        </div>

        {/* Contacto */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Phone size={20} className="text-primary-500" />
            Contacto
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone size={14} className="inline mr-1" />
                  Teléfono
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="+598 99 123 456"
                />
              </div>
              <div>
                <label htmlFor="whatsApp" className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageCircle size={14} className="inline mr-1" />
                  WhatsApp
                </label>
                <input
                  type="tel"
                  id="whatsApp"
                  name="whatsApp"
                  value={formData.whatsApp || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsApp: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="+598 99 123 456"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                <Mail size={14} className="inline mr-1" />
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="contacto@mitienda.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-1">
                  <Instagram size={14} className="inline mr-1" />
                  Instagram
                </label>
                <input
                  type="text"
                  id="instagram"
                  name="instagram"
                  value={formData.instagram || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, instagram: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="@mitienda"
                />
              </div>
              <div>
                <label htmlFor="facebook" className="block text-sm font-medium text-gray-700 mb-1">
                  <Facebook size={14} className="inline mr-1" />
                  Facebook
                </label>
                <input
                  type="text"
                  id="facebook"
                  name="facebook"
                  value={formData.facebook || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, facebook: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="facebook.com/mitienda"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Configuración de pedidos */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-primary-500" />
            Configuración de Pedidos
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minimumOrderAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  <DollarSign size={14} className="inline mr-1" />
                  Pedido Mínimo
                </label>
                <input
                  type="number"
                  id="minimumOrderAmount"
                  name="minimumOrderAmount"
                  min="0"
                  step="0.01"
                  value={formData.minimumOrderAmount || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimumOrderAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label htmlFor="estimatedDeliveryMinutes" className="block text-sm font-medium text-gray-700 mb-1">
                  <Timer size={14} className="inline mr-1" />
                  Tiempo Estimado (min)
                </label>
                <input
                  type="number"
                  id="estimatedDeliveryMinutes"
                  name="estimatedDeliveryMinutes"
                  min="0"
                  value={formData.estimatedDeliveryMinutes || 30}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimatedDeliveryMinutes: parseInt(e.target.value) || 30 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="businessHours" className="block text-sm font-medium text-gray-700 mb-1">
                <Clock size={14} className="inline mr-1" />
                Horarios de Atención (Texto informativo)
              </label>
              <textarea
                id="businessHours"
                name="businessHours"
                rows={3}
                value={formData.businessHours || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, businessHours: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Lunes a Viernes: 9:00 - 18:00&#10;Sábados: 10:00 - 14:00"
              />
              <p className="text-xs text-gray-500 mt-1">Este texto se muestra a los clientes como información</p>
            </div>

            {/* Horarios de operación para pedidos */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Clock size={16} className="text-blue-600" />
                Horarios de Operación para Pedidos
              </h3>
              <p className="text-xs text-gray-600 mb-3">
                Estos horarios controlan cuándo los clientes pueden realizar pedidos. Si el horario de cierre es menor que el de apertura, significa que cierra al día siguiente (ej: 20:00 a 02:00).
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="openingTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Apertura
                  </label>
                  <input
                    type="time"
                    id="openingTime"
                    name="openingTime"
                    value={formData.openingTime || '20:00'}
                    onChange={(e) => setFormData(prev => ({ ...prev, openingTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label htmlFor="closingTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Hora de Cierre
                  </label>
                  <input
                    type="time"
                    id="closingTime"
                    name="closingTime"
                    value={formData.closingTime || '00:00'}
                    onChange={(e) => setFormData(prev => ({ ...prev, closingTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sistema de Puntos */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle size={20} className="text-amber-600" />
            Sistema de Puntos e Incentivos
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Configura cuántos puntos de recompensa recibe automáticamente el cliente por cada pedido completado.
          </p>
          <div className="max-w-xs">
            <label htmlFor="pointsPerOrder" className="block text-sm font-medium text-gray-700 mb-1">
              Puntos por Pedido Finalizado
            </label>
            <div className="relative">
              <input
                type="number"
                id="pointsPerOrder"
                name="pointsPerOrder"
                min="0"
                value={formData.pointsPerOrder || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, pointsPerOrder: parseInt(e.target.value) || 0 }))}
                className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-bold text-primary-600"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-400 text-sm font-medium">pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mensajes personalizados */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MessageCircle size={20} className="text-primary-500" />
            Mensajes Personalizados
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="welcomeMessage" className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje de Bienvenida
              </label>
              <textarea
                id="welcomeMessage"
                name="welcomeMessage"
                rows={2}
                value={formData.welcomeMessage || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="¡Bienvenido a nuestra tienda!"
              />
            </div>

            <div>
              <label htmlFor="closedMessage" className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje cuando está Cerrado
              </label>
              <textarea
                id="closedMessage"
                name="closedMessage"
                rows={2}
                value={formData.closedMessage || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, closedMessage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Estamos cerrados. ¡Volvemos pronto!"
              />
            </div>
          </div>
        </div>
        {/* Integraciones */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Webhook size={20} className="text-primary-500" />
            Integraciones
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="orderCompletionWebhookUrl" className="block text-sm font-medium text-gray-700 mb-1">
                Webhook de Pedidos Completados
              </label>
              <input
                type="url"
                id="orderCompletionWebhookUrl"
                name="orderCompletionWebhookUrl"
                value={formData.orderCompletionWebhookUrl || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, orderCompletionWebhookUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="https://tu-sistema.com/api/webhooks/order-completed"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL que recibirá una notificación POST cuando un pedido sea marcado como completado.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save size={18} />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
}


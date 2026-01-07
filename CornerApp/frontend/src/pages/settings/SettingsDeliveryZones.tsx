import { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation,
  Circle,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';
import { useToast } from '../../components/Toast/ToastContext';
import api from '../../api/client';
import type { DeliveryZoneConfig, UpdateDeliveryZoneRequest } from '../../types';

export default function SettingsDeliveryZonesPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoneConfig, setZoneConfig] = useState<DeliveryZoneConfig | null>(null);
  const [formData, setFormData] = useState<UpdateDeliveryZoneRequest>({});

  useEffect(() => {
    loadDeliveryZone();
  }, []);

  const loadDeliveryZone = async () => {
    try {
      setLoading(true);
      const data = await api.getDeliveryZone();
      setZoneConfig(data);
      setFormData({
        name: data.name,
        storeLatitude: data.storeLatitude,
        storeLongitude: data.storeLongitude,
        maxDeliveryRadiusKm: data.maxDeliveryRadiusKm,
        isEnabled: data.isEnabled,
      });
    } catch (error) {
      showToast('Error al cargar la configuración de zona', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await api.updateDeliveryZone(formData);
      setZoneConfig(updated);
      showToast('Configuración de zona guardada', 'success');
    } catch (error) {
      showToast('Error al guardar la configuración', 'error');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = () => {
    setFormData(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
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
            <div className="p-3 bg-blue-100 rounded-xl">
              <MapPin size={28} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Zonas de Entrega</h1>
              <p className="text-gray-500">Configura el área y costos de delivery</p>
            </div>
          </div>
          
          {/* Toggle habilitado */}
          <button
            onClick={toggleEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              formData.isEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {formData.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {formData.isEnabled ? 'Validación Activa' : 'Validación Inactiva'}
          </button>
        </div>

        {!formData.isEnabled && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-yellow-600 mt-0.5" />
            <p className="text-sm text-yellow-800">
              La validación de zona está desactivada. Se aceptarán pedidos de cualquier ubicación.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ubicación de la tienda */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Navigation size={20} className="text-primary-500" />
            Ubicación de la Tienda
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="zoneName" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Zona
              </label>
              <input
                type="text"
                id="zoneName"
                name="zoneName"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Zona Principal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="storeLatitude" className="block text-sm font-medium text-gray-700 mb-1">
                  Latitud
                </label>
                <input
                  type="number"
                  id="storeLatitude"
                  name="storeLatitude"
                  step="0.0001"
                  value={formData.storeLatitude || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, storeLatitude: parseFloat(e.target.value) }))}
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
                  step="0.0001"
                  value={formData.storeLongitude || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, storeLongitude: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="-57.9667"
                />
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                💡 Puedes obtener las coordenadas buscando tu dirección en Google Maps y haciendo clic derecho en el punto exacto.
              </p>
            </div>
          </div>
        </div>

        {/* Radio de entrega */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Circle size={20} className="text-primary-500" />
            Radio de Entrega
          </h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="maxDeliveryRadiusKm" className="block text-sm font-medium text-gray-700 mb-1">
                Radio Máximo (km)
              </label>
              <input
                type="number"
                id="maxDeliveryRadiusKm"
                name="maxDeliveryRadiusKm"
                min="0"
                step="0.1"
                value={formData.maxDeliveryRadiusKm || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, maxDeliveryRadiusKm: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="5"
              />
              <p className="text-xs text-gray-500 mt-1">
                Los pedidos fuera de este radio serán rechazados
              </p>
            </div>

            {/* Vista previa visual del radio */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-dashed border-blue-300 relative">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="absolute -bottom-6 text-xs font-medium text-blue-600">
                  {formData.maxDeliveryRadiusKm || 0} km
                </span>
              </div>
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
              Guardar Configuración
            </>
          )}
        </button>
      </div>
    </div>
  );
}


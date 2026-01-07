import { useState, useEffect } from 'react';
import {
  Mail,
  Server,
  Lock,
  User,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Power
} from 'lucide-react';
import { useToast } from '../../components/Toast/ToastContext';
import { api } from '../../api/client';
import type { EmailConfig, UpdateEmailConfigRequest } from '../../types';

export default function SettingsEmailPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<UpdateEmailConfigRequest>({
    smtpHost: '',
    smtpPort: 587,
    smtpUseSsl: true,
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: 'CornerApp',
    isEnabled: false
  });

  useEffect(() => {
    loadEmailConfig();
  }, []);

  const loadEmailConfig = async () => {
    try {
      setLoading(true);
      const data = await api.getEmailConfig();
      setEmailConfig(data);
      setFormData({
        smtpHost: data.smtpHost || '',
        smtpPort: data.smtpPort || 587,
        smtpUseSsl: data.smtpUseSsl ?? true,
        smtpUsername: data.smtpUsername || '',
        smtpPassword: '', // No mostrar contraseña existente
        fromEmail: data.fromEmail || '',
        fromName: data.fromName || 'CornerApp',
        isEnabled: data.isEnabled ?? false
      });
    } catch (error) {
      showToast('Error al cargar la configuración de email', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validaciones básicas
      if (formData.isEnabled) {
        if (!formData.smtpHost || !formData.fromEmail) {
          showToast('Debe completar al menos el servidor SMTP y el email de origen', 'error');
          return;
        }
      }

      const updated = await api.updateEmailConfig(formData);
      setEmailConfig(updated);
      showToast('Configuración de email guardada correctamente', 'success');
      
      // Limpiar contraseña del formulario después de guardar
      setFormData(prev => ({ ...prev, smtpPassword: '' }));
    } catch (error: any) {
      showToast(error?.message || 'Error al guardar la configuración', 'error');
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-primary-100 rounded-lg">
            <Mail className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración de Email</h1>
            <p className="text-gray-600">Configura el servidor SMTP para enviar recibos a los clientes</p>
          </div>
        </div>

        {/* Estado */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className={`w-5 h-5 ${formData.isEnabled ? 'text-green-600' : 'text-gray-400'}`} />
              <div>
                <p className="font-medium text-gray-900">
                  Email {formData.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                </p>
                <p className="text-sm text-gray-600">
                  {formData.isEnabled 
                    ? 'Los recibos se enviarán automáticamente cuando se complete un pedido'
                    : 'Los recibos no se enviarán por email'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleEnabled}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                formData.isEnabled
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {formData.isEnabled ? 'Deshabilitar' : 'Habilitar'}
            </button>
          </div>
        </div>

        {/* Formulario */}
        <div className="space-y-6">
          {/* Servidor SMTP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Server className="w-4 h-4 inline mr-2" />
              Servidor SMTP
            </label>
            <input
              type="text"
              value={formData.smtpHost}
              onChange={(e) => setFormData(prev => ({ ...prev, smtpHost: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Ejemplo: smtp.gmail.com, smtp.outlook.com, smtp.mail.yahoo.com
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Puerto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Puerto
              </label>
              <input
                type="number"
                value={formData.smtpPort}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpPort: parseInt(e.target.value) || 587 }))}
                placeholder="587"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* SSL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usar SSL/TLS
              </label>
              <select
                value={formData.smtpUseSsl ? 'true' : 'false'}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpUseSsl: e.target.value === 'true' }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          {/* Credenciales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Usuario SMTP
            </label>
            <input
              type="text"
              value={formData.smtpUsername}
              onChange={(e) => setFormData(prev => ({ ...prev, smtpUsername: e.target.value }))}
              placeholder="tu-email@gmail.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="w-4 h-4 inline mr-2" />
              Contraseña SMTP
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.smtpPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, smtpPassword: e.target.value }))}
                placeholder={emailConfig?.hasPassword ? '•••••••• (dejar vacío para mantener la actual)' : 'Ingresa la contraseña'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {emailConfig?.hasPassword 
                ? 'Deja vacío para mantener la contraseña actual'
                : 'Para Gmail, usa una contraseña de aplicación'}
            </p>
          </div>

          {/* Email de origen */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
              Email de origen
            </label>
            <input
              type="email"
              value={formData.fromEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, fromEmail: e.target.value }))}
              placeholder="noreply@cornerapp.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de origen
            </label>
            <input
              type="text"
              value={formData.fromName}
              onChange={(e) => setFormData(prev => ({ ...prev, fromName: e.target.value }))}
              placeholder="CornerApp"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Información */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Configuración para Gmail:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Servidor: smtp.gmail.com</li>
                  <li>Puerto: 587</li>
                  <li>SSL: Sí</li>
                  <li>Usa una contraseña de aplicación (no tu contraseña normal)</li>
                  <li>Activa la verificación en 2 pasos en tu cuenta de Google</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botón guardar */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Guardar Configuración
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


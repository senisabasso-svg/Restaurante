import { 
  Settings as SettingsIcon, 
  Database, 
  Server, 
  Info,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SettingsInfoPage() {
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
            <h1 className="text-xl font-bold text-gray-800">ℹ️ Información</h1>
            <p className="text-sm text-gray-500">Información del sistema y estado</p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System Info */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info size={24} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Información del Sistema</h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Versión</span>
              <span className="font-medium text-gray-800">1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Frontend</span>
              <span className="font-medium text-gray-800">React + TypeScript</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Backend</span>
              <span className="font-medium text-gray-800">ASP.NET Core</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Base de Datos</span>
              <span className="font-medium text-gray-800">SQLite / SQL Server</span>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Server size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Estado de la API</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Backend API</span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="font-medium text-green-600">Conectado</span>
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">URL Base</span>
              <span className="font-medium text-gray-800">localhost:5000</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600">Documentación API</span>
              <a 
                href="http://localhost:5000/swagger" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Ver Swagger →
              </a>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Database size={24} className="text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Base de Datos</h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            La base de datos se gestiona automáticamente mediante Entity Framework Core.
          </p>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">
              Las migraciones y la estructura de la base de datos se manejan desde el backend.
            </p>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <SettingsIcon size={24} className="text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Preferencias</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Tema</p>
                <p className="text-sm text-gray-500">Próximamente: modo oscuro</p>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
                Claro
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-800">Idioma</p>
                <p className="text-sm text-gray-500">Idioma de la interfaz</p>
              </div>
              <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-sm">
                Español
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


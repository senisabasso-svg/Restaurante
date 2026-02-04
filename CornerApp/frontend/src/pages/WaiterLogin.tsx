import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast/ToastContext';
import { LogIn, Lock, User, Utensils, Store } from 'lucide-react';
import Logo from '../components/Logo/Logo';

export default function WaiterLoginPage() {
  const [restaurantId, setRestaurantId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username || !password) {
      showToast('Por favor completa todos los campos', 'error');
      return;
    }

    if (!restaurantId) {
      showToast('El ID del restaurante es requerido', 'error');
      return;
    }

    const restaurantIdNum = parseInt(restaurantId, 10);
    if (isNaN(restaurantIdNum) || restaurantIdNum <= 0) {
      showToast('El ID del restaurante debe ser un número válido', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ restaurantId: restaurantIdNum, username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al iniciar sesión');
      }

      const data = await response.json();
      
      // Verificar que el usuario sea Employee (Mozo)
      if (data.user?.role !== 'Employee') {
        throw new Error('Este usuario no tiene permisos de mozo');
      }
      
      // Guardar token y datos del mozo
      localStorage.setItem('waiter_token', data.token);
      localStorage.setItem('waiter_user', JSON.stringify(data.user));
      
      showToast('¡Bienvenido!', 'success');
      navigate('/mozo');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al iniciar sesión';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative">
      {/* Fondo azul que cubre toda la pantalla */}
      <div className="absolute inset-0 bg-gradient-to-br from-[rgba(5,8,46,1)] via-[rgba(15,25,80,1)] to-[rgba(5,8,46,1)] z-0">
        {/* Logo de fondo izquierdo - Grande y detrás de todo */}
        <div className="absolute inset-0 lg:w-1/2 flex items-center justify-center">
          <Logo showText={false} height={400} className="opacity-25" />
        </div>
      </div>

      {/* Panel izquierdo - Decorativo */}
      <div className="hidden lg:flex lg:w-1/2 relative z-10 overflow-hidden">
        {/* Patrón de fondo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-400 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-400 rounded-full blur-3xl"></div>
        </div>
        
        {/* Contenido decorativo */}
        <div className="relative z-10 flex flex-col justify-center items-center p-12 text-white max-w-lg mx-auto w-full">
          <h2 className="text-4xl font-bold mb-4 text-center">Mozos</h2>
          <p className="text-xl text-blue-200 text-center mb-12">Gestiona mesas y pedidos desde un solo lugar</p>
          
          {/* Icono decorativo */}
          <div className="flex flex-col items-center p-8 bg-white/10 rounded-xl backdrop-blur-sm">
            <Utensils size={64} className="mb-4" />
            <span className="text-lg font-semibold">Panel de Mozos</span>
          </div>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-transparent relative z-20 rounded-[8rem] lg:rounded-l-[8rem] lg:rounded-r-none m-4 lg:m-0 lg:ml-0">
        {/* Logo de fondo - Grande y detrás de todo */}
        <div className="absolute inset-0 flex items-center justify-center z-0 bg-gray-600 rounded-[8rem] lg:rounded-l-[8rem] lg:rounded-r-none shadow-[0px_0px_0px_0px_rgba(0,0,0,0)] overflow-hidden">
          <Logo showText={false} height={400} className="opacity-10" />
        </div>
        
        <div className="w-full max-w-md relative z-10 p-6">
          {/* Logo móvil */}
          <div className="lg:hidden flex justify-center mb-8">
            <Logo showText={true} height={64} />
          </div>

          {/* Título */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center" style={{ color: 'var(--tw-ring-offset-color)' }}>Iniciar Sesión</h1>
            <p className="text-center text-gray-600 text-sm">Acceso para mozos</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ID Restaurante */}
            <div>
              <label htmlFor="restaurantId" className="block text-sm font-semibold text-white mb-2">
                ID del Restaurante <span className="text-gray-400 text-xs">(requerido)</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Store size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="restaurantId"
                  type="number"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa el ID del restaurante"
                  autoComplete="off"
                  disabled={loading}
                  min="1"
                  required
                />
              </div>
            </div>

            {/* Usuario */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-white mb-2">
                Usuario
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu usuario"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white mb-2">
                Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl hover:from-primary-600 hover:to-purple-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <LogIn size={22} />
                  <span>Acceder</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500" style={{ color: 'var(--tw-ring-offset-color)' }}>
              Sistema de mozos RiDi Express
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

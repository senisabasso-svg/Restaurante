import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../components/Toast/ToastContext';
import { UserPlus, Lock, Mail, User, Phone, MapPin, Store } from 'lucide-react';
import Logo from '../components/Logo/Logo';

interface Restaurant {
  id: number;
  name: string;
  address?: string;
  phone?: string;
}

export default function CustomerRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [restaurantId, setRestaurantId] = useState<number>(0);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Cargar restaurantes disponibles
    const fetchRestaurants = async () => {
      try {
        setLoadingRestaurants(true);
        const response = await fetch('/api/restaurants');
        
        if (!response.ok) {
          throw new Error('Error al cargar restaurantes');
        }

        const data = await response.json();
        setRestaurants(data);
        
        // Si solo hay un restaurante, seleccionarlo automáticamente
        if (data.length === 1) {
          setRestaurantId(data[0].id);
        }
      } catch (error) {
        showToast('Error al cargar restaurantes. Por favor, recarga la página.', 'error');
        console.error(error);
      } finally {
        setLoadingRestaurants(false);
      }
    };

    fetchRestaurants();
  }, [showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!name || !email || !password || !phone || !defaultAddress || !restaurantId || restaurantId <= 0) {
      showToast('Por favor completa todos los campos', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim(),
          defaultAddress: defaultAddress.trim(),
          restaurantId: restaurantId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al registrarse');
      }

      const data = await response.json();
      
      // Guardar token y datos del cliente
      localStorage.setItem('customer_token', data.token);
      localStorage.setItem('customer_user', JSON.stringify(data.user));
      
      showToast('¡Registro exitoso! Bienvenido', 'success');
      navigate('/clientes/pedidos');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al registrarse';
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
          <h2 className="text-4xl font-bold mb-4 text-center">Únete</h2>
          <p className="text-xl text-blue-200 text-center mb-12">Crea tu cuenta y realiza pedidos</p>
          
          {/* Icono decorativo */}
          <div className="flex flex-col items-center p-8 bg-white/10 rounded-xl backdrop-blur-sm">
            <UserPlus size={64} className="mb-4" />
            <span className="text-lg font-semibold">Registro de Clientes</span>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center" style={{ color: 'var(--tw-ring-offset-color)' }}>Crear Cuenta</h1>
            <p className="text-center text-gray-600 text-sm">Regístrate para realizar pedidos</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Restaurante */}
            <div>
              <label htmlFor="restaurantId" className="block text-sm font-semibold text-white mb-2">
                Restaurante
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Store size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <select
                  id="restaurantId"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(Number(e.target.value))}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900"
                  disabled={loading || loadingRestaurants}
                  required
                >
                  <option value="0">Selecciona un restaurante</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </div>
              {loadingRestaurants && (
                <p className="mt-1 text-xs text-gray-400">Cargando restaurantes...</p>
              )}
            </div>

            {/* Nombre */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Nombre Completo
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu nombre completo"
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-white mb-2">
                Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu email"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-white mb-2">
                Teléfono
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu teléfono"
                  autoComplete="tel"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Dirección */}
            <div>
              <label htmlFor="address" className="block text-sm font-semibold text-white mb-2">
                Dirección
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="address"
                  type="text"
                  value={defaultAddress}
                  onChange={(e) => setDefaultAddress(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Ingresa tu dirección de entrega"
                  autoComplete="street-address"
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
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-white mb-2">
                Confirmar Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Confirma tu contraseña"
                  autoComplete="new-password"
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
                  <span>Registrando...</span>
                </>
              ) : (
                <>
                  <UserPlus size={22} />
                  <span>Registrarse</span>
                </>
              )}
            </button>
          </form>

          {/* Link a Login */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500" style={{ color: 'var(--tw-ring-offset-color)' }}>
              ¿Ya tienes una cuenta?{' '}
              <Link
                to="/clientes/login"
                className="text-primary-500 hover:text-primary-600 font-semibold transition-colors"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-500" style={{ color: 'var(--tw-ring-offset-color)' }}>
              Sistema de pedidos en línea
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Truck } from 'lucide-react';

export default function DeliveryLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('delivery_token');
    localStorage.removeItem('delivery_user');
    navigate('/delivery/login');
  };

  const deliveryUser = localStorage.getItem('delivery_user');
  let userName = 'Repartidor';
  try {
    if (deliveryUser) {
      const user = JSON.parse(deliveryUser);
      userName = user.name || user.username || 'Repartidor';
    }
  } catch (e) {
    console.error('Error al parsear usuario:', e);
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundColor: '#f9fafb' }}>
      {/* Header simple para repartidores */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Truck size={24} className="text-purple-600" />
              <h1 className="text-xl font-bold text-gray-800">Panel de Repartidor</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 hidden sm:inline">{userName}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

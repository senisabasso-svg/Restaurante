import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Clock,
  ChefHat,
  Truck,
  DollarSign,
  Package,
  FolderOpen,
  Users,
  ArrowRight
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';

interface Stats {
  pendingOrders: number;
  preparingOrders: number;
  deliveringOrders: number;
  totalToday: number;
  totalProducts: number;
  totalCategories: number;
  totalDeliveryPersons: number;
  pendingReceiptsCount: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    pendingOrders: 0,
    preparingOrders: 0,
    deliveringOrders: 0,
    totalToday: 0,
    totalProducts: 0,
    totalCategories: 0,
    totalDeliveryPersons: 0,
    pendingReceiptsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [products, categories, deliveryPersons, orderStats] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getDeliveryPersons(),
        api.getOrderStats(),
      ]);

      setStats({
        pendingOrders: orderStats.pendingOrders || 0,
        preparingOrders: orderStats.preparingOrders || 0,
        deliveringOrders: orderStats.deliveringOrders || 0,
        totalToday: orderStats.todayRevenue || 0,
        totalProducts: products.length,
        totalCategories: categories.length,
        totalDeliveryPersons: deliveryPersons.length,
        pendingReceiptsCount: (orderStats as any).pendingReceiptsCount || 0,
      });
    } catch (error) {
      showToast('Error al cargar estadísticas', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pedidos Pendientes',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'bg-yellow-500',
      link: '/admin/orders?status=pending',
    },
    {
      title: 'En Preparación',
      value: stats.preparingOrders,
      icon: ChefHat,
      color: 'bg-orange-500',
      link: '/admin/orders?status=preparing',
    },
    {
      title: 'En Camino',
      value: stats.deliveringOrders,
      icon: Truck,
      color: 'bg-blue-500',
      link: '/admin/orders?status=delivering',
    },
    {
      title: 'Ventas Hoy',
      value: `$${stats.totalToday.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
      link: '/admin/orders',
    },
    {
      title: 'Comprobantes Pendientes',
      value: stats.pendingReceiptsCount,
      icon: DollarSign, // Cambiaré a un icono más apropiado si es posible, o usaré DollarSign con otro color
      color: stats.pendingReceiptsCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-400',
      link: '/admin/active-orders?filter=receipts',
    },
  ];

  const quickLinks = [
    {
      title: 'Gestionar Pedidos',
      description: 'Ver y administrar todos los pedidos',
      icon: ShoppingCart,
      link: '/admin/orders',
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Productos',
      description: `${stats.totalProducts} productos registrados`,
      icon: Package,
      link: '/admin/products',
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Categorías',
      description: `${stats.totalCategories} categorías activas`,
      icon: FolderOpen,
      link: '/admin/categories',
      color: 'from-pink-500 to-pink-600',
    },
    {
      title: 'Repartidores',
      description: `${stats.totalDeliveryPersons} repartidores`,
      icon: Users,
      link: '/admin/delivery-persons',
      color: 'from-teal-500 to-teal-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Link
              key={index}
              to={card.link}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-xl text-white group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickLinks.map((link, index) => {
          const Icon = link.icon;
          return (
            <Link
              key={index}
              to={link.link}
              className={`bg-gradient-to-r ${link.color} rounded-xl shadow-md p-6 text-white hover:shadow-lg transition-all hover:scale-[1.02] group`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl">
                    <Icon size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{link.title}</h3>
                    <p className="text-white/80 text-sm">{link.description}</p>
                  </div>
                </div>
                <ArrowRight size={24} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


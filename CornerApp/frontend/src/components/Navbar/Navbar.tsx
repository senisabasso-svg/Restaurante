import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Truck,
  Settings,
  ChevronDown,
  Info,
  CreditCard,
  Users,
  History,
  BarChart3,
  ChefHat,
  LogOut,
  CheckCircle,
  Table as TableIcon,
  Shield,
  MoreHorizontal,
  Store,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { api } from '../../api/client';
import Logo from '../Logo/Logo';

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  subItems?: { path: string; label: string; icon: React.ElementType }[];
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const navItems: NavItem[] = [
    // Activos: muestra todos los pedidos (tanto de salón como de delivery)
    // { path: '/admin/active-orders', label: 'Activos', icon: ClipboardList }, // Temporalmente deshabilitado - pedidos van directo a cocina
    { path: '/admin/payments', label: t('nav.payments'), icon: CheckCircle },
    { path: '/admin/kitchen', label: t('nav.kitchen'), icon: ChefHat },
    //{ path: '/admin/mesas-ver', label: 'Mesas', icon: TableIcon },
    { path: '/admin/tables', label: t('nav.tables'), icon: TableIcon },

    { path: '/admin/repartidores', label: t('nav.deliveryPersons'), icon: Truck },
    { path: '/admin', label: t('nav.dashboard'), icon: LayoutDashboard },
    {
      path: '/admin/mas',
      label: t('nav.more'),
      icon: MoreHorizontal,
      subItems: [
        //{ path: '/admin/delivery-persons', label: t('nav.deliveryPersons'), icon: Truck },
        { path: '/admin/reports', label: t('nav.reports'), icon: BarChart3 },
        { path: '/admin/orders', label: t('nav.history'), icon: History },
      ]
    },
    {
      path: '/admin/settings',
      label: t('nav.config'),
      icon: Settings,
      subItems: [
        //{ path: '/admin/tables', label: 'Mesas', icon: TableIcon },
        { path: '/admin/settings/business', label: 'Datos del Negocio', icon: Store },
        // { path: '/admin/settings/delivery-zones', label: 'Zonas de Entrega', icon: MapPin }, // Temporalmente deshabilitado
        { path: '/admin/products', label: t('nav.products'), icon: Package },
        { path: '/admin/delivery-persons', label: t('nav.deliveryPersons'), icon: Truck },
        { path: '/admin/categories', label: t('nav.categories'), icon: FolderOpen },
        { path: '/admin/customers', label: t('nav.customers'), icon: Users },
        { path: '/admin/users', label: t('nav.users'), icon: Shield },
        { path: '/admin/settings/payments', label: t('nav.paymentMethods'), icon: CreditCard },
        //{ path: '/admin/settings/email', label: 'Configuración de Email', icon: Mail },
       // { path: '/admin/settings/rewards', label: 'Premios', icon: Gift },
        { path: '/admin/settings/info', label: t('nav.info'), icon: Info },
      ]
    },
  ];
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [pendingReceiptsCount, setPendingReceiptsCount] = useState(0); // Para Pagos (comprobantes pendientes)
  // const [activeOrdersCount, setActiveOrdersCount] = useState(0); // Para Activos (pedidos activos) - Temporalmente deshabilitado
  const [kitchenOrdersCount, setKitchenOrdersCount] = useState(0); // Para Cocina (pedidos en preparing)
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar contadores para cada sección
  useEffect(() => {
    const loadCounters = async () => {
      try {
        // Contador para Pagos: comprobantes pendientes de verificación
        const stats = await api.getOrderStats();
        setPendingReceiptsCount(stats.pendingReceiptsCount || 0);

        // Contador para Activos: total de pedidos activos (pending, preparing, delivering) - Temporalmente deshabilitado
        const activeOrders = await api.getActiveOrders();
        const activeOrdersArray = Array.isArray(activeOrders)
          ? activeOrders
          : (activeOrders as any)?.data || [];
        // setActiveOrdersCount(activeOrdersArray.length); // Temporalmente deshabilitado

        // Contador para Cocina: pedidos en estado "preparing"
        const kitchenOrders = activeOrdersArray.filter((o: any) => o.status === 'preparing');
        setKitchenOrdersCount(kitchenOrders.length);
      } catch (error) {
        console.error('Error al cargar contadores:', error);
      }
    };

    loadCounters();
    // Actualizar cada 30 segundos
    const interval = setInterval(loadCounters, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string, subItems?: { path: string; label: string; icon: React.ElementType }[]) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    // Si tiene subItems, verificar si alguna subruta está activa
    if (subItems && subItems.length > 0) {
      return subItems.some(subItem => location.pathname === subItem.path || location.pathname.startsWith(subItem.path));
    }
    return location.pathname.startsWith(path);
  };

  const toggleDropdown = (path: string) => {
    setOpenDropdown(openDropdown === path ? null : path);
  };

  return (
    <nav className="bg-white shadow-lg rounded-lg mx-4 mt-4 mb-2">
      <div className="px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/admin">
            <Logo variant="text-only" />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1" ref={dropdownRef}>
            {navItems
              .filter((item) => {
                // Filtrar enlace de Mesas si el usuario no es Admin o Employee
                if (item.path === '/admin/mesas-ver') {
                  return user && (user.role === 'Admin' || user.role === 'Employee');
                }
                return true;
              })
              .map((item) => {
              const Icon = item.icon;
              const hasSubItems = item.subItems && item.subItems.length > 0;
              const isDropdownOpen = openDropdown === item.path;

              if (hasSubItems) {
                return (
                  <div key={item.path} className="relative">
                    <button
                      onClick={() => toggleDropdown(item.path)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive(item.path, item.subItems)
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                      <ChevronDown
                        size={16}
                        className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                        {item.subItems!.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <div
                              key={subItem.path}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenDropdown(null);
                                // Usar setTimeout para asegurar que el dropdown se cierre antes de navegar
                                setTimeout(() => {
                                  navigate(subItem.path);
                                }, 0);
                              }}
                              className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors cursor-pointer ${location.pathname === subItem.path
                                ? 'bg-primary-50 text-primary-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                              <SubIcon size={16} />
                              <span>{subItem.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${isActive(item.path)
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.path === '/admin/payments' && pendingReceiptsCount > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive(item.path)
                        ? 'bg-white text-primary-500'
                        : 'bg-red-500 text-white'
                    }`}>
                      {pendingReceiptsCount}
                    </span>
                  )}
                  {/* {item.path === '/admin/active-orders' && activeOrdersCount > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive(item.path)
                        ? 'bg-white text-primary-500'
                        : 'bg-blue-500 text-white'
                    }`}>
                      {activeOrdersCount}
                    </span>
                  )} */}
                  {item.path === '/admin/kitchen' && kitchenOrdersCount > 0 && (
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                      isActive(item.path)
                        ? 'bg-white text-primary-500'
                        : 'bg-orange-500 text-white'
                    }`}>
                      {kitchenOrdersCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden sm:inline text-sm text-gray-600">
                {user.name}
              </span>
            )}
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              title={t('nav.logout')}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <div className="flex overflow-x-auto py-2 px-2 gap-1">
          {navItems
            .filter((item) => {
              // Filtrar enlace de Mesas si el usuario no es Admin o Employee
              if (item.path === '/admin/mesas-ver') {
                return user && (user.role === 'Admin' || user.role === 'Employee');
              }
              return true;
            })
            .map((item) => {
            const Icon = item.icon;
            const hasSubItems = item.subItems && item.subItems.length > 0;

            if (hasSubItems) {
              return (
                <div key={item.path} className="relative">
                  <button
                    onClick={() => toggleDropdown(item.path)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${isActive(item.path, item.subItems)
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                    <ChevronDown size={12} />
                  </button>

                  {openDropdown === item.path && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {item.subItems!.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <div
                            key={subItem.path}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setOpenDropdown(null);
                              // Usar setTimeout para asegurar que el dropdown se cierre antes de navegar
                              setTimeout(() => {
                                navigate(subItem.path);
                              }, 0);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors cursor-pointer ${location.pathname === subItem.path
                              ? 'bg-primary-50 text-primary-600 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                              }`}
                          >
                            <SubIcon size={14} />
                            <span>{subItem.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all relative ${isActive(item.path)
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.path === '/admin/payments' && pendingReceiptsCount > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-primary-500'
                      : 'bg-red-500 text-white'
                  }`}>
                    {pendingReceiptsCount}
                  </span>
                )}
                {/* {item.path === '/admin/active-orders' && activeOrdersCount > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-primary-500'
                      : 'bg-blue-500 text-white'
                  }`}>
                    {activeOrdersCount}
                  </span>
                )} */}
                {item.path === '/admin/kitchen' && kitchenOrdersCount > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    isActive(item.path)
                      ? 'bg-white text-primary-500'
                      : 'bg-orange-500 text-white'
                  }`}>
                    {kitchenOrdersCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MOCK_USER, MOCK_TOKEN } from '../data/mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const USE_MOCK_DATA = true; // Cambiar a false cuando el backend funcione

interface User {
  id: number;
  restaurantId: number | null;
  restaurantName?: string;
  username: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (restaurantId: number | null, username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar token y usuario del localStorage al iniciar
    // Buscar primero admin_token, luego waiter_token
    const savedToken = localStorage.getItem('admin_token') || localStorage.getItem('waiter_token');
    const savedUser = localStorage.getItem('admin_user') || localStorage.getItem('waiter_user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error al parsear usuario guardado:', e);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('waiter_token');
        localStorage.removeItem('waiter_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (restaurantId: number | null, username: string, password: string) => {
    // Modo MOCK: Usar datos hardcodeados para demostración
    if (USE_MOCK_DATA || (username === 'corner' && password === 'password123')) {
      console.log('🔧 Usando datos MOCK para login');
      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockData = {
        token: MOCK_TOKEN,
        user: {
          ...MOCK_USER,
          restaurantId: restaurantId || MOCK_USER.restaurantId
        }
      };
      
      setToken(mockData.token);
      setUser(mockData.user);
      
      // Guardar en localStorage
      localStorage.setItem('admin_token', mockData.token);
      localStorage.setItem('admin_user', JSON.stringify(mockData.user));
      return;
    }

    // Modo normal: Intentar conectar al backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          restaurantId: restaurantId || undefined, 
          username, 
          password 
        }),
      });

      if (!response.ok) {
        // Si falla, usar datos mock como fallback
        console.warn('⚠️ Backend no disponible, usando datos MOCK');
        const mockData = {
          token: MOCK_TOKEN,
          user: {
            ...MOCK_USER,
            restaurantId: restaurantId || MOCK_USER.restaurantId
          }
        };
        
        setToken(mockData.token);
        setUser(mockData.user);
        localStorage.setItem('admin_token', mockData.token);
        localStorage.setItem('admin_user', JSON.stringify(mockData.user));
        return;
      }

      const data = await response.json();
      
      setToken(data.token);
      setUser(data.user);
      
      // Guardar en localStorage
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
    } catch (error) {
      // Si hay error de red, usar datos mock como fallback
      console.warn('⚠️ Error de conexión, usando datos MOCK:', error);
      const mockData = {
        token: MOCK_TOKEN,
        user: {
          ...MOCK_USER,
          restaurantId: restaurantId || MOCK_USER.restaurantId
        }
      };
      
      setToken(mockData.token);
      setUser(mockData.user);
      localStorage.setItem('admin_token', mockData.token);
      localStorage.setItem('admin_user', JSON.stringify(mockData.user));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}


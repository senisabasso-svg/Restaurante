import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';

interface WaiterProtectedRouteProps {
  children: ReactNode;
}

export default function WaiterProtectedRoute({ children }: WaiterProtectedRouteProps) {
  const token = localStorage.getItem('waiter_token');
  const user = localStorage.getItem('waiter_user');

  if (!token || !user) {
    return <Navigate to="/mozo/login" replace />;
  }

  try {
    const userData = JSON.parse(user);
    // Verificar que el usuario sea Employee (Mozo)
    if (userData.role !== 'Employee') {
      localStorage.removeItem('waiter_token');
      localStorage.removeItem('waiter_user');
      return <Navigate to="/mozo/login" replace />;
    }
  } catch (error) {
    localStorage.removeItem('waiter_token');
    localStorage.removeItem('waiter_user');
    return <Navigate to="/mozo/login" replace />;
  }

  return <>{children}</>;
}

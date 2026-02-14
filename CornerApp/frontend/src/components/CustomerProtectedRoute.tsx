import { Navigate } from 'react-router-dom';

interface CustomerProtectedRouteProps {
  children: React.ReactNode;
}

export default function CustomerProtectedRoute({ children }: CustomerProtectedRouteProps) {
  const token = localStorage.getItem('customer_token');
  const user = localStorage.getItem('customer_user');

  if (!token || !user) {
    return <Navigate to="/clientes/login" replace />;
  }

  return <>{children}</>;
}

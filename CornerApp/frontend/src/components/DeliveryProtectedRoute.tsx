import { Navigate } from 'react-router-dom';

interface DeliveryProtectedRouteProps {
  children: React.ReactNode;
}

export default function DeliveryProtectedRoute({ children }: DeliveryProtectedRouteProps) {
  const token = localStorage.getItem('delivery_token');
  const user = localStorage.getItem('delivery_user');

  if (!token || !user) {
    return <Navigate to="/delivery/login" replace />;
  }

  return <>{children}</>;
}

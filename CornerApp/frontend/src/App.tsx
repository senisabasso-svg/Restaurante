import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import OrdersPage from './pages/Orders';
import ProductsPage from './pages/Products';
import CategoriesPage from './pages/Categories';
import DeliveryPersonsPage from './pages/DeliveryPersons';
import SettingsInfoPage from './pages/settings/SettingsInfo';
import SettingsPaymentsPage from './pages/settings/SettingsPayments';
import SettingsBusinessPage from './pages/settings/SettingsBusiness';
import SettingsDeliveryZonesPage from './pages/settings/SettingsDeliveryZones';
import ReportsPage from './pages/settings/Reports';
import SettingsRewardsPage from './pages/settings/SettingsRewards';
import SettingsEmailPage from './pages/settings/SettingsEmail';
import CustomersPage from './pages/Customers';
import ActiveOrdersPage from './pages/ActiveOrders';
import KitchenPage from './pages/Kitchen';
import PaymentVerificationPage from './pages/PaymentVerification';
import TablesPage from './pages/Tables';
import AdminUsersPage from './pages/AdminUsers';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/active-orders" element={<ActiveOrdersPage />} />
        <Route path="/admin/payments" element={<PaymentVerificationPage />} />
        <Route path="/admin/kitchen" element={<KitchenPage />} />
        <Route path="/admin/tables" element={<TablesPage />} />
        <Route path="/admin/orders" element={<OrdersPage />} />
        <Route path="/admin/products" element={<ProductsPage />} />
        <Route path="/admin/categories" element={<CategoriesPage />} />
        <Route path="/admin/delivery-persons" element={<DeliveryPersonsPage />} />
        <Route path="/admin/customers" element={<CustomersPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        {/* Settings sub-routes */}
        <Route path="/admin/settings" element={<Navigate to="/admin/settings/business" replace />} />
        <Route path="/admin/settings/business" element={<SettingsBusinessPage />} />
        <Route path="/admin/settings/delivery-zones" element={<SettingsDeliveryZonesPage />} />
        <Route path="/admin/settings/info" element={<SettingsInfoPage />} />
        <Route path="/admin/settings/payments" element={<SettingsPaymentsPage />} />
        <Route path="/admin/settings/email" element={<SettingsEmailPage />} />
        <Route path="/admin/settings/rewards" element={<SettingsRewardsPage />} />
      </Route>
    </Routes>
  );
}


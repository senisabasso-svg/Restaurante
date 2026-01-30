import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import DeliveryLayout from './components/Layout/DeliveryLayout';
import ProtectedRoute from './components/ProtectedRoute';
import DeliveryProtectedRoute from './components/DeliveryProtectedRoute';
import WaiterProtectedRoute from './components/WaiterProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/Login';
import DeliveryLoginPage from './pages/DeliveryLogin';
import WaiterLoginPage from './pages/WaiterLogin';
import Dashboard from './pages/Dashboard';
import OrdersPage from './pages/Orders';
import ProductsPage from './pages/Products';
import CategoriesPage from './pages/Categories';
import DeliveryPersonsPage from './pages/DeliveryPersons';
import SettingsInfoPage from './pages/settings/SettingsInfo';
import SettingsPaymentsPage from './pages/settings/SettingsPayments';
import SettingsBusinessPage from './pages/settings/SettingsBusiness';
// import SettingsDeliveryZonesPage from './pages/settings/SettingsDeliveryZones'; // Temporalmente deshabilitado
import ReportsPage from './pages/settings/Reports';
import SettingsRewardsPage from './pages/settings/SettingsRewards';
import SettingsEmailPage from './pages/settings/SettingsEmail';
import CustomersPage from './pages/Customers';
import ActiveOrdersPage from './pages/ActiveOrders';
import KitchenPage from './pages/Kitchen';
import PaymentVerificationPage from './pages/PaymentVerification';
import TablesPage from './pages/Tables';
import TablesViewPage from './pages/TablesView';
import AdminUsersPage from './pages/AdminUsers';
import DeliveryOrdersPage from './pages/DeliveryOrders';
import DeliveryPersonsManagementPage from './pages/DeliveryPersonsManagement';
import WaiterPage from './pages/WaiterPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/delivery/login" element={<DeliveryLoginPage />} />
      <Route path="/mozo/login" element={<WaiterLoginPage />} />
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
        <Route path="/admin/active-orders/salon" element={<ActiveOrdersPage />} />
        <Route path="/admin/active-orders/delivery" element={<ActiveOrdersPage />} />
        <Route path="/admin/payments" element={<PaymentVerificationPage />} />
        <Route path="/admin/kitchen" element={<KitchenPage />} />
        <Route path="/admin/mesas-ver" element={<TablesViewPage />} />
        <Route path="/admin/tables" element={<TablesPage />} />
        <Route path="/admin/repartidores" element={<DeliveryPersonsManagementPage />} />
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
        {/* <Route path="/admin/settings/delivery-zones" element={<SettingsDeliveryZonesPage />} /> */} {/* Temporalmente deshabilitado */}
        <Route path="/admin/settings/info" element={<SettingsInfoPage />} />
        <Route path="/admin/settings/payments" element={<SettingsPaymentsPage />} />
        <Route path="/admin/settings/email" element={<SettingsEmailPage />} />
        <Route path="/admin/settings/rewards" element={<SettingsRewardsPage />} />
      </Route>
      {/* Rutas protegidas para repartidores */}
      <Route
        element={
          <ErrorBoundary>
            <DeliveryProtectedRoute>
              <DeliveryLayout />
            </DeliveryProtectedRoute>
          </ErrorBoundary>
        }
      >
        <Route path="/delivery/orders" element={<ErrorBoundary><DeliveryOrdersPage /></ErrorBoundary>} />
      </Route>
      {/* Rutas protegidas para mozos */}
      <Route
        path="/mozo"
        element={
          <ErrorBoundary>
            <WaiterProtectedRoute>
              <WaiterPage />
            </WaiterProtectedRoute>
          </ErrorBoundary>
        }
      />
    </Routes>
  );
}


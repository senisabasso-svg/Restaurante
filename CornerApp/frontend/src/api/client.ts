/**
 * API Client centralizado para CornerApp
 * Maneja todas las peticiones HTTP al backend
 */

const API_BASE_URL = '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    // Obtener token del localStorage
    const token = localStorage.getItem('admin_token');

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (!response.ok) {
      // Si es 401 (No autorizado), limpiar token y redirigir al login
      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text);
  }

  // Orders
  async getActiveOrders() {
    return this.request<Order[]>('/admin/api/orders/active');
  }

  async getOrderStats() {
    return this.request<{
      pendingOrders: number;
      preparingOrders: number;
      deliveringOrders: number;
      todayRevenue: number;
      todayOrders: number;
      totalActiveOrders: number;
      pendingReceiptsCount: number;
    }>('/admin/api/reports/dashboard-stats');
  }

  async getOrders(params?: { showArchived?: boolean; sortBy?: string; sortOrder?: string; page?: number; pageSize?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.showArchived) queryParams.append('showArchived', 'true');
    // Siempre ordenar por fecha de creación (createdAt) por defecto, no por fecha de entrega
    queryParams.append('sortBy', params?.sortBy || 'createdAt');
    queryParams.append('sortOrder', params?.sortOrder || 'desc');
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());

    const query = queryParams.toString();
    return this.request<{ data: Order[]; totalCount: number; page: number; pageSize: number; totalPages: number }>(`/admin/api/orders${query ? `?${query}` : ''}`);
  }

  async getOrder(id: number) {
    return this.request<Order>(`/api/orders/${id}`);
  }

  async createOrder(data: CreateOrderRequest) {
    return this.request<Order>('/admin/api/orders/create', { method: 'POST', body: data });
  }

  async updateOrderStatus(id: number, status: string, deliveryPersonId?: number) {
    return this.request<Order>(`/admin/api/orders/${id}/status`, {
      method: 'PUT',
      body: { status, deliveryPersonId },
    });
  }

  async archiveOrder(id: number) {
    return this.request(`/admin/api/orders/${id}/archive`, { method: 'POST' });
  }

  async restoreOrder(id: number) {
    return this.request(`/admin/api/orders/${id}/restore`, { method: 'POST' });
  }

  async deleteOrder(id: number) {
    return this.request(`/admin/api/orders/${id}`, { method: 'DELETE' });
  }

  async verifyReceipt(id: number, isVerified: boolean) {
    return this.request<Order>(`/admin/api/orders/${id}/receipt/verify`, {
      method: 'PUT',
      body: { isVerified },
    });
  }

  async getOrderStatusHistory(id: number) {
    return this.request<OrderStatusHistoryItem[]>(`/admin/api/orders/${id}/history`);
  }

  // Products
  async getProducts() {
    return this.request<Product[]>('/api/products');
  }

  async getProduct(id: number) {
    return this.request<Product>(`/api/products/${id}`);
  }

  async createProduct(data: CreateProductRequest) {
    return this.request<Product>('/admin/api/products/create', { method: 'POST', body: data });
  }

  async updateProduct(id: number, data: UpdateProductRequest) {
    return this.request<Product>(`/admin/api/products/${id}`, { method: 'PUT', body: data });
  }

  async deleteProduct(id: number) {
    return this.request(`/admin/api/products/${id}`, { method: 'DELETE' });
  }

  async uploadProductImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/admin/api/products/upload-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al subir imagen');
    }

    return response.json();
  }

  // Categories
  async getCategories() {
    return this.request<Category[]>('/api/categories');
  }

  async getCategory(id: number) {
    return this.request<Category>(`/api/categories/${id}`);
  }

  async createCategory(data: CreateCategoryRequest) {
    return this.request<Category>('/admin/api/categories/create', { method: 'POST', body: data });
  }

  async updateCategory(id: number, data: UpdateCategoryRequest) {
    return this.request<Category>(`/admin/api/categories/${id}`, { method: 'PUT', body: data });
  }

  async deleteCategory(id: number) {
    return this.request(`/admin/api/categories/${id}`, { method: 'DELETE' });
  }

  // Delivery Persons
  async getDeliveryPersons() {
    // Para la gestión de repartidores, obtener TODOS (activos e inactivos)
    return this.request<DeliveryPerson[]>('/admin/api/delivery-persons');
  }

  async getActiveDeliveryPersons() {
    // Para asignar pedidos, solo obtener repartidores activos
    return this.request<DeliveryPerson[]>('/api/orders/delivery-persons');
  }

  async createDeliveryPerson(data: CreateDeliveryPersonRequest) {
    return this.request<DeliveryPerson>('/admin/api/delivery-persons', { method: 'POST', body: data });
  }

  async updateDeliveryPerson(id: number, data: UpdateDeliveryPersonRequest) {
    return this.request<DeliveryPerson>(`/admin/api/delivery-persons/${id}`, { method: 'PUT', body: data });
  }

  async deleteDeliveryPerson(id: number) {
    return this.request(`/admin/api/delivery-persons/${id}`, { method: 'DELETE' });
  }

  // Payment Methods (para pedidos - solo activos)
  async getPaymentMethods() {
    return this.request<PaymentMethod[]>('/api/orders/payment-methods');
  }

  // Payment Methods Admin (CRUD completo)
  async getAllPaymentMethods() {
    return this.request<PaymentMethod[]>('/admin/api/payment-methods');
  }

  async createPaymentMethod(data: CreatePaymentMethodRequest) {
    return this.request<PaymentMethod>('/admin/api/payment-methods', { method: 'POST', body: data });
  }

  async updatePaymentMethod(id: number, data: UpdatePaymentMethodRequest) {
    return this.request<PaymentMethod>(`/admin/api/payment-methods/${id}`, { method: 'PUT', body: data });
  }

  async deletePaymentMethod(id: number) {
    return this.request(`/admin/api/payment-methods/${id}`, { method: 'DELETE' });
  }

  // Tables
  async getTables(status?: string) {
    const query = status ? `?status=${status}` : '';
    return this.request<Table[]>(`/api/tables${query}`);
  }

  async getTable(id: number) {
    return this.request<Table>(`/api/tables/${id}`);
  }

  async createTable(data: CreateTableRequest) {
    return this.request<Table>('/api/tables', { method: 'POST', body: data });
  }

  async updateTable(id: number, data: UpdateTableRequest) {
    return this.request<Table>(`/api/tables/${id}`, { method: 'PUT', body: data });
  }

  async deleteTable(id: number) {
    return this.request(`/api/tables/${id}`, { method: 'DELETE' });
  }

  async updateTableStatus(id: number, status: string) {
    return this.request<Table>(`/api/tables/${id}/status`, { method: 'PATCH', body: { status } });
  }

  // Spaces
  async getSpaces() {
    return this.request<Space[]>('/api/spaces');
  }

  async getSpace(id: number) {
    return this.request<Space>(`/api/spaces/${id}`);
  }

  async createSpace(data: CreateSpaceRequest) {
    return this.request<Space>('/api/spaces', { method: 'POST', body: data });
  }

  async deleteSpace(id: number) {
    return this.request(`/api/spaces/${id}`, { method: 'DELETE' });
  }

  // Rewards Admin
  async getAdminRewards() {
    return this.request<Reward[]>('/admin/api/rewards');
  }

  async createReward(data: CreateRewardRequest) {
    return this.request<Reward>('/admin/api/rewards', { method: 'POST', body: data });
  }

  async updateReward(id: number, data: UpdateRewardRequest) {
    return this.request<Reward>(`/admin/api/rewards/${id}`, { method: 'PUT', body: data });
  }

  async deleteReward(id: number) {
    return this.request(`/admin/api/rewards/${id}`, { method: 'DELETE' });
  }

  // Customers
  async getCustomers(params?: { search?: string; page?: number; pageSize?: number }) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    const query = queryParams.toString();
    return this.request<{ data: Customer[]; totalCount: number; page: number; pageSize: number }>(`/admin/api/customers${query ? `?${query}` : ''}`);
  }

  async getCustomer(id: number) {
    return this.request<Customer>(`/admin/api/customers/${id}`);
  }

  async getCustomerStats() {
    return this.request<{ totalCustomers: number; totalPoints: number; customersWithOrders: number }>('/admin/api/customers/stats');
  }

  async deleteCustomer(id: number) {
    return this.request(`/admin/api/customers/${id}`, { method: 'DELETE' });
  }

  // Business Info
  async getBusinessInfo() {
    return this.request<BusinessInfo>('/admin/api/business-info');
  }

  // Email Config
  async getEmailConfig() {
    return this.request<EmailConfig>('/admin/api/email-config');
  }

  async updateEmailConfig(data: UpdateEmailConfigRequest) {
    return this.request<EmailConfig>('/admin/api/email-config', { method: 'PUT', body: data });
  }

  async updateBusinessInfo(data: UpdateBusinessInfoRequest) {
    return this.request<BusinessInfo>('/admin/api/business-info', { method: 'PUT', body: data });
  }

  async toggleBusinessOpen() {
    return this.request<{ isOpen: boolean; message: string }>('/admin/api/business-info/toggle-open', { method: 'POST' });
  }

  // Delivery Zone
  async getDeliveryZone() {
    return this.request<DeliveryZoneConfig>('/admin/api/delivery-zone');
  }

  async updateDeliveryZone(data: UpdateDeliveryZoneRequest) {
    return this.request<DeliveryZoneConfig>('/admin/api/delivery-zone', { method: 'PUT', body: data });
  }

  // Reports
  async getRevenueReport(period: string = 'month') {
    return this.request<RevenueData>(`/admin/api/reports/revenue?period=${period}`);
  }

  async getTopProducts(period: string = 'month', limit: number = 10) {
    return this.request<TopProduct[]>(`/admin/api/reports/top-products?period=${period}&limit=${limit}`);
  }

  async getReportStats(period: string = 'month') {
    return this.request<ReportStats>(`/admin/api/reports/stats?period=${period}`);
  }

  async getRevenueByPaymentMethod(period: string = 'month') {
    return this.request<RevenueByPaymentMethod[]>(`/admin/api/reports/revenue-by-payment-method?period=${period}`);
  }

  async getComparison(period: string = 'month') {
    return this.request<ComparisonData>(`/admin/api/reports/comparison?period=${period}`);
  }

  async getPeakHours(period: string = 'month') {
    return this.request<PeakHoursData>(`/admin/api/reports/peak-hours?period=${period}`);
  }

  async getTopCustomers(period: string = 'month', limit: number = 10) {
    return this.request<TopCustomer[]>(`/admin/api/reports/top-customers?period=${period}&limit=${limit}`);
  }

  async getDeliveryPerformance(period: string = 'month') {
    return this.request<DeliveryPerformance[]>(`/admin/api/reports/delivery-performance?period=${period}`);
  }

  async getExportData(period: string = 'month') {
    return this.request<ExportOrder[]>(`/admin/api/reports/export?period=${period}`);
  }
}

// Import types
import type {
  Order,
  CreateOrderRequest,
  Product,
  CreateProductRequest,
  UpdateProductRequest,
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  DeliveryPerson,
  CreateDeliveryPersonRequest,
  UpdateDeliveryPersonRequest,
  PaymentMethod,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  DashboardStats,
  OrderStatusHistoryItem,
  Customer,
  BusinessInfo,
  UpdateBusinessInfoRequest,
  DeliveryZoneConfig,
  UpdateDeliveryZoneRequest,
  RevenueData,
  TopProduct,
  ReportStats,
  RevenueByPaymentMethod,
  ComparisonData,
  PeakHoursData,
  TopCustomer,
  DeliveryPerformance,
  ExportOrder,
  Reward,
  CreateRewardRequest,
  UpdateRewardRequest,
  Table,
  CreateTableRequest,
  UpdateTableRequest,
  Space,
  CreateSpaceRequest
} from '../types';

// Export singleton instance
export const api = new ApiClient();
export default api;


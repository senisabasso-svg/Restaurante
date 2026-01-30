// Order types
export interface Order {
  id: number;
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  status: OrderStatus;
  total: number;
  paymentMethod: string;
  deliveryPersonId?: number;
  deliveryPerson?: DeliveryPerson;
  tableId?: number; // ID de la mesa asociada al pedido
  table?: Table; // Información completa de la mesa (incluye número)
  comments?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  transferReceiptImage?: string; // Base64 image del comprobante de transferencia
  isReceiptVerified?: boolean; // Si el comprobante ha sido verificado
  receiptVerifiedAt?: string; // Fecha de verificación
  receiptVerifiedBy?: string; // Usuario que verificó
}

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  categoryId?: number; // ID de la categoría del producto
  categoryName?: string; // Nombre de la categoría del producto (para facilitar filtrado)
  quantity: number;
  unitPrice: number;
  subtotal: number;
  subProducts?: OrderItemSubProduct[]; // Subproductos (guarniciones) asociados
}

export interface OrderItemSubProduct {
  id: number;
  name: string;
  price: number;
}

export interface CreateOrderRequest {
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  paymentMethod: string;
  comments?: string;
  items: {
    id: number;
    name: string;
    price: number;
    quantity: number;
    subProducts?: {
      id: number;
      name: string;
      price: number;
    }[];
  }[];
}

// Product types
export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: number;
  category?: Category;
  isAvailable: boolean;
  displayOrder: number;
  createdAt: string;
  subProducts?: SubProduct[];
}

export interface SubProduct {
  id: number;
  name: string;
  description?: string;
  price: number;
  productId: number;
  displayOrder: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSubProductRequest {
  name: string;
  description?: string;
  price: number;
  productId: number;
  displayOrder?: number;
  isAvailable?: boolean;
}

export interface UpdateSubProductRequest {
  name?: string;
  description?: string;
  price?: number;
  productId?: number;
  displayOrder?: number;
  isAvailable?: boolean;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId: number;
  displayOrder?: number;
  isAvailable?: boolean;
}

export interface UpdateProductRequest extends CreateProductRequest {
  id: number;
}

// Category types
export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  products?: Product[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  id: number;
  displayOrder?: number;
  isActive?: boolean;
}

// Delivery Person types
export interface DeliveryPerson {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  username: string;
  isActive: boolean;
  createdAt: string;
  activeOrders?: {
    id: number;
    customerName: string;
    customerAddress: string;
    status: string;
    total: number;
    createdAt: string;
    assignedAt: string;
  }[];
}

export interface CreateDeliveryPersonRequest {
  name: string;
  phone?: string;
  email?: string;
  username: string;
  password: string;
}

export interface UpdateDeliveryPersonRequest {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  username: string;
  password?: string;
  isActive?: boolean;
}

// Payment Method types
export interface PaymentMethod {
  id: number;
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
  requiresReceipt: boolean;
  isActive: boolean;
  displayOrder: number;
  // Información bancaria
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  accountType?: string;
  accountAlias?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePaymentMethodRequest {
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
  requiresReceipt?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  // Información bancaria
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  accountType?: string;
  accountAlias?: string;
}

export interface UpdatePaymentMethodRequest {
  name?: string;
  displayName?: string;
  icon?: string;
  description?: string;
  requiresReceipt?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  // Información bancaria
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  accountType?: string;
  accountAlias?: string;
}

// Customer types
export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  defaultAddress?: string;
  documentType?: string; // Cedula, Rut, Otro
  documentNumber?: string;
  points: number;
  ordersCount: number;
  totalSpent?: number;
  createdAt: string;
  updatedAt?: string;
  recentOrders?: { id: number; status: string; total: number; createdAt: string }[];
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email: string;
  defaultAddress?: string;
  documentType?: string; // Cedula, Rut, Otro
  documentNumber?: string;
}

// Order Status History
export interface OrderStatusHistoryItem {
  id: number;
  fromStatus: string;
  toStatus: string;
  changedBy?: string;
  note?: string;
  changedAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard stats
export interface DashboardStats {
  pendingOrders: number;
  preparingOrders: number;
  deliveringOrders: number;
  totalToday: number;
  archivedCount: number;
}

// Business Info
export interface BusinessInfo {
  id: number;
  storeName: string;
  description?: string;
  address?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  phone?: string;
  whatsApp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  businessHours?: string;
  openingTime?: string; // Formato HH:mm (ej: "20:00")
  closingTime?: string; // Formato HH:mm (ej: "00:00")
  minimumOrderAmount: number;
  estimatedDeliveryMinutes: number;
  isOpen: boolean;
  pointsPerOrder: number;
  welcomeMessage?: string;
  closedMessage?: string;
  createdAt: string;
  updatedAt: string;
  orderCompletionWebhookUrl?: string;
}

export interface UpdateBusinessInfoRequest {
  storeName?: string;
  description?: string;
  address?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  phone?: string;
  whatsApp?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  businessHours?: string;
  openingTime?: string; // Formato HH:mm (ej: "20:00")
  closingTime?: string; // Formato HH:mm (ej: "00:00")
  minimumOrderAmount?: number;
  estimatedDeliveryMinutes?: number;
  isOpen?: boolean;
  pointsPerOrder?: number;
  welcomeMessage?: string;
  closedMessage?: string;
  orderCompletionWebhookUrl?: string;
}

// Delivery Zone
export interface DeliveryZoneConfig {
  id: number;
  name: string;
  storeLatitude: number;
  storeLongitude: number;
  maxDeliveryRadiusKm: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDeliveryZoneRequest {
  name?: string;
  storeLatitude?: number;
  storeLongitude?: number;
  maxDeliveryRadiusKm?: number;
  isEnabled?: boolean;
}

// Email Config
export interface EmailConfig {
  id: number;
  smtpHost?: string;
  smtpPort: number;
  smtpUseSsl: boolean;
  smtpUsername?: string;
  fromEmail?: string;
  fromName?: string;
  isEnabled: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEmailConfigRequest {
  smtpHost?: string;
  smtpPort?: number;
  smtpUseSsl?: boolean;
  smtpUsername?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  isEnabled?: boolean;
}

// Reports
export interface RevenueData {
  period: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  revenueByDay: { date: string; revenue: number; ordersCount: number }[];
}

export interface TopProduct {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface ReportStats {
  period: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  cancellationRate: number;
  completionRate: number;
}

export interface RevenueByPaymentMethod {
  paymentMethod: string;
  revenue: number;
  ordersCount: number;
}

export interface ComparisonData {
  period: string;
  current: {
    revenue: number;
    orders: number;
    averageOrder: number;
  };
  previous: {
    revenue: number;
    orders: number;
    averageOrder: number;
  };
  changes: {
    revenuePercent: number;
    ordersPercent: number;
    averagePercent: number;
  };
}

export interface PeakHoursData {
  hourlyData: { hour: number; ordersCount: number; revenue: number }[];
  peakHour: number;
  peakOrders: number;
}

export interface TopCustomer {
  customerName: string;
  customerPhone?: string;
  ordersCount: number;
  totalSpent: number;
  lastOrderDate: string;
}

export interface DeliveryPerformance {
  deliveryPersonId: number;
  name: string;
  totalDeliveries: number;
  completedDeliveries: number;
  cancelledDeliveries: number;
  totalRevenue: number;
  completionRate: number;
}

export interface ExportOrder {
  id: number;
  createdAt: string;
  customerName: string;
  customerPhone?: string;
  customerAddress: string;
  status: string;
  paymentMethod: string;
  total: number;
  deliveryPerson?: string;
  itemsCount: number;
  items: string;
}

export interface Reward {
  id: number;
  name: string;
  description?: string;
  pointsRequired: number;
  isActive: boolean;
  discountPercentage?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateRewardRequest {
  name: string;
  description?: string;
  pointsRequired: number;
  isActive: boolean;
  discountPercentage?: number;
}

export interface UpdateRewardRequest {
  name?: string;
  description?: string;
  pointsRequired?: number;
  isActive?: boolean;
  discountPercentage?: number;
}

// Table types
export interface Table {
  id: number;
  number: string;
  capacity: number;
  location?: string;
  spaceId?: number | null;
  positionX?: number;
  positionY?: number;
  status: TableStatus;
  isActive: boolean;
  notes?: string;
  orderPlacedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TableStatus = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'OrderPlaced';

export interface CreateTableRequest {
  number: string;
  capacity: number;
  location?: string;
  status?: TableStatus;
  notes?: string;
  spaceId?: number | null;
}

export interface UpdateTableRequest {
  number?: string;
  capacity?: number;
  location?: string;
  positionX?: number;
  positionY?: number;
  status?: TableStatus;
  notes?: string;
  isActive?: boolean;
  spaceId?: number | null;
}

// Space types
export interface Space {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  tables?: Table[];
}

export interface CreateSpaceRequest {
  name: string;
  description?: string;
}

// Cash Register types
export interface CashRegister {
  id: number;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  finalAmount?: number;
  totalSales: number;
  totalCash: number;
  totalPOS: number;
  totalTransfer: number;
  isOpen: boolean;
  createdBy?: string;
  closedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CashRegisterStatus {
  isOpen: boolean;
  cashRegister?: {
    id: number;
    openedAt: string;
    initialAmount: number;
    totalSales: number;
    totalCash: number;
    totalPOS: number;
    totalTransfer: number;
    createdBy?: string;
  };
}

export interface OpenCashRegisterRequest {
  initialAmount: number;
}

export interface CloseCashRegisterRequest {
  notes?: string;
}

export interface CashRegisterReport {
  id: number;
  openedAt: string;
  closedAt?: string;
  initialAmount: number;
  finalAmount: number;
  totalSales: number;
  totalCash: number;
  totalPOS: number;
  totalTransfer: number;
  ordersCount: number;
  isOpen: boolean;
  createdBy?: string;
  closedBy?: string;
  notes?: string;
  duration: number; // horas
}

export interface CashRegistersReport {
  period: string;
  startDate: string;
  endDate: string;
  summary: {
    totalCashRegisters: number;
    openCashRegisters: number;
    closedCashRegisters: number;
    totalSales: number;
    totalCash: number;
    totalPOS: number;
    totalTransfer: number;
  };
  cashRegisters: CashRegisterReport[];
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: string; // "Admin" o "Employee"
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface CreateAdminUserRequest {
  username: string;
  email: string;
  password: string;
  name: string;
  role: string; // "Admin" o "Employee"
}

export interface UpdateAdminUserRequest {
  email?: string;
  password?: string;
  name?: string;
  role?: string; // "Admin" o "Employee"
}
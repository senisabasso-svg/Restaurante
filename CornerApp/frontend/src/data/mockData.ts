/**
 * Datos mock hardcodeados para demostración
 * Se usan cuando el backend no está disponible
 */

export const MOCK_USER = {
  id: 1,
  restaurantId: 12,
  restaurantName: "Corner Restaurant",
  username: "corner",
  email: "corner@cornerapp.com",
  name: "Corner Admin",
  role: "Admin",
  isSuperAdmin: false
};

export const MOCK_TOKEN = "mock-jwt-token-for-demo-purposes-only";

export const MOCK_RESTAURANT = {
  id: 12,
  name: "Corner Restaurant",
  identifier: "corner",
  address: "Dirección de demostración",
  phone: "123456789",
  email: "corner@cornerapp.com",
  isActive: true
};

export const MOCK_CATEGORY = {
  id: 1,
  restaurantId: 12,
  name: "Bebidas",
  description: "Categoría de bebidas",
  displayOrder: 1,
  isActive: true
};

export const MOCK_PRODUCT = {
  id: 1,
  restaurantId: 12,
  name: "Coca Cola",
  description: "Bebida gaseosa",
  price: 500,
  categoryId: 1,
  displayOrder: 1,
  isAvailable: true,
  image: ""
};

export const MOCK_SUBPRODUCTS = [
  {
    id: 1,
    productId: 1,
    name: "Tamaño Grande",
    description: "Vaso grande de 500ml",
    price: 100,
    displayOrder: 1,
    isAvailable: true
  },
  {
    id: 2,
    productId: 1,
    name: "Tamaño Mediano",
    description: "Vaso mediano de 350ml",
    price: 50,
    displayOrder: 2,
    isAvailable: true
  },
  {
    id: 3,
    productId: 1,
    name: "Sin Hielo",
    description: "Sin cubos de hielo",
    price: 0,
    displayOrder: 3,
    isAvailable: true
  }
];

export const MOCK_SPACE = {
  id: 1,
  restaurantId: 12,
  name: "Sala Principal",
  description: "Área principal del restaurante",
  isActive: true
};

export const MOCK_TABLES = [
  {
    id: 1,
    restaurantId: 12,
    number: "1",
    capacity: 4,
    location: "Frente",
    status: "OrderPlaced" as const,
    spaceId: 1,
    isActive: true
  },
  {
    id: 2,
    restaurantId: 12,
    number: "2",
    capacity: 2,
    location: "Fondo",
    status: "Available" as const,
    spaceId: 1,
    isActive: true
  }
];

// Repartidor
export const MOCK_DELIVERY_PERSON = {
  id: 1,
  name: "Juan Pérez",
  phone: "0987654321",
  email: "juan.perez@cornerapp.com",
  username: "juan_delivery",
  isActive: true,
  createdAt: new Date().toISOString(),
  activeOrders: []
};

// Cliente
export const MOCK_CUSTOMER = {
  id: 1,
  name: "María González",
  email: "maria.gonzalez@email.com",
  phone: "0991234567",
  defaultAddress: "Av. Principal 123, Montevideo",
  documentType: "Cedula",
  documentNumber: "12345678",
  points: 150,
  ordersCount: 5,
  totalSpent: 12500,
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  recentOrders: [
    {
      id: 1,
      status: "completed",
      total: 2500,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
};

// Pedido en cocina (enviado desde la mesa)
export const MOCK_ORDER_IN_KITCHEN = {
  id: 1,
  customerName: "Mesa 1",
  customerAddress: "Mesa 1 - Sala Principal",
  customerPhone: undefined,
  status: "preparing" as const,
  total: 600,
  paymentMethod: "cash",
  deliveryPersonId: undefined,
  deliveryPerson: undefined,
  tableId: 1,
  table: {
    id: 1,
    number: "1",
    capacity: 4,
    location: "Frente",
    status: "OrderPlaced" as const,
    spaceId: 1,
    isActive: true
  },
  comments: "Sin cebolla",
  isArchived: false,
  createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Hace 10 minutos
  updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Actualizado hace 5 minutos
  items: [
    {
      id: 1,
      orderId: 1,
      productId: 1,
      productName: "Coca Cola",
      categoryId: 1,
      categoryName: "Bebidas",
      quantity: 2,
      unitPrice: 500,
      subtotal: 1000,
      subProducts: [
        {
          id: 1,
          name: "Tamaño Grande",
          price: 100
        }
      ]
    }
  ],
  transferReceiptImage: undefined,
  isReceiptVerified: undefined,
  receiptVerifiedAt: undefined,
  receiptVerifiedBy: undefined
};

// Caja abierta
export const MOCK_CASH_REGISTER_STATUS = {
  isOpen: true,
  cashRegister: {
    id: 1,
    openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // Abierta hace 4 horas
    initialAmount: 50000,
    totalSales: 125000,
    totalCash: 80000,
    totalPOS: 30000,
    totalTransfer: 15000,
    createdBy: "corner"
  }
};

export const MOCK_CASH_REGISTER = {
  id: 1,
  openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  closedAt: undefined,
  initialAmount: 50000,
  finalAmount: undefined,
  totalSales: 125000,
  totalCash: 80000,
  totalPOS: 30000,
  totalTransfer: 15000,
  isOpen: true,
  createdBy: "corner",
  closedBy: undefined,
  notes: undefined,
  createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString()
};

// Reportes
export const MOCK_REPORT_STATS = {
  period: "Este mes",
  totalOrders: 145,
  completedOrders: 132,
  cancelledOrders: 8,
  pendingOrders: 5,
  totalRevenue: 725000,
  averageOrderValue: 5000,
  cancellationRate: 5.5,
  completionRate: 91.0
};

export const MOCK_REVENUE_DATA = {
  totalRevenue: 725000,
  revenueByDay: [
    { date: "2024-01-01", revenue: 25000, ordersCount: 5 },
    { date: "2024-01-02", revenue: 30000, ordersCount: 6 },
    { date: "2024-01-03", revenue: 28000, ordersCount: 5 },
    { date: "2024-01-04", revenue: 35000, ordersCount: 7 },
    { date: "2024-01-05", revenue: 32000, ordersCount: 6 }
  ]
};

export const MOCK_TOP_PRODUCTS = [
  {
    productId: 1,
    productName: "Coca Cola",
    quantitySold: 85,
    revenue: 42500
  }
];

export const MOCK_REVENUE_BY_PAYMENT = [
  {
    paymentMethod: "cash",
    revenue: 400000,
    ordersCount: 80
  },
  {
    paymentMethod: "pos",
    revenue: 250000,
    ordersCount: 50
  },
  {
    paymentMethod: "transfer",
    revenue: 75000,
    ordersCount: 15
  }
];

export const MOCK_COMPARISON_DATA = {
  period: "Este mes",
  current: {
    revenue: 725000,
    orders: 145,
    averageOrder: 5000
  },
  previous: {
    revenue: 680000,
    orders: 136,
    averageOrder: 5000
  },
  changes: {
    revenuePercent: 6.6,
    ordersPercent: 6.6,
    averagePercent: 0.0
  }
};

export const MOCK_PEAK_HOURS_DATA = {
  hourlyData: [
    { hour: 12, ordersCount: 15, revenue: 75000 },
    { hour: 13, ordersCount: 20, revenue: 100000 },
    { hour: 14, ordersCount: 18, revenue: 90000 },
    { hour: 19, ordersCount: 22, revenue: 110000 },
    { hour: 20, ordersCount: 25, revenue: 125000 }
  ],
  peakHour: 20,
  peakOrders: 25
};

export const MOCK_DELIVERY_PERFORMANCE = [
  {
    deliveryPersonId: 1,
    name: "Juan Pérez",
    totalDeliveries: 45,
    completedDeliveries: 42,
    cancelledDeliveries: 3,
    totalRevenue: 210000,
    completionRate: 93.3
  }
];

export const MOCK_CASH_REGISTERS_REPORT = {
  period: "Este mes",
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
  endDate: new Date().toISOString(),
  summary: {
    totalCashRegisters: 30,
    openCashRegisters: 1,
    closedCashRegisters: 29,
    totalSales: 725000,
    totalCash: 400000,
    totalPOS: 250000,
    totalTransfer: 75000
  },
  cashRegisters: [
    {
      id: 1,
      openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      closedAt: undefined,
      initialAmount: 50000,
      finalAmount: 175000,
      totalSales: 125000,
      totalCash: 80000,
      totalPOS: 30000,
      totalTransfer: 15000,
      ordersCount: 25,
      isOpen: true,
      createdBy: "corner",
      closedBy: undefined,
      notes: undefined,
      duration: 4.0
    }
  ]
};

export const MOCK_PRODUCTS = [MOCK_PRODUCT];
export const MOCK_SPACES = [MOCK_SPACE];

// Función para simular delay de red
export const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

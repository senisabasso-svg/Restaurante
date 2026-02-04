/**
 * API Client centralizado para CornerApp
 * Maneja todas las peticiones HTTP al backend
 */

const API_BASE_URL = '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {}, skipAuth = false } = options;

    // Obtener token del localStorage (admin, mozo o repartidor) solo si no se omite la autenticación
    const token = skipAuth ? null : (localStorage.getItem('admin_token') || localStorage.getItem('waiter_token') || localStorage.getItem('delivery_token'));

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
      // Si es 401 (No autorizado), limpiar tokens y redirigir al login apropiado
      if (response.status === 401) {
        const isDeliveryRoute = endpoint.includes('/deliveryperson/') || endpoint.includes('/delivery/');
        const isWaiterRoute = endpoint.includes('/waiter/') || window.location.pathname.includes('/mozo');
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        localStorage.removeItem('waiter_token');
        localStorage.removeItem('waiter_user');
        localStorage.removeItem('delivery_token');
        localStorage.removeItem('delivery_user');
        if (isDeliveryRoute) {
          window.location.href = '/delivery/login';
        } else if (isWaiterRoute) {
          window.location.href = '/mozo/login';
        } else {
          window.location.href = '/login';
        }
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      let errorData: any = {};
      try {
        const text = await response.text();
        if (text) {
          errorData = JSON.parse(text);
        }
      } catch (e) {
        // Si no se puede parsear, usar el texto como mensaje
        errorData = { error: await response.text().catch(() => response.statusText) };
      }
      
      const errorMessage = errorData.error || errorData.message || errorData.details || `Error ${response.status}: ${response.statusText}`;
      const error = new Error(errorMessage);
      (error as any).response = { data: errorData, status: response.status };
      throw error;
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    const parsed = JSON.parse(text);
    
    // Si la respuesta está envuelta en un objeto 'data', extraerlo
    if (parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray(parsed.data)) {
      return parsed.data as T;
    }
    
    // Si la respuesta está envuelta en un objeto 'data' pero no es array, devolver el objeto completo
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed.data as T;
    }
    
    return parsed as T;
  }

  // Orders
  async getActiveOrders() {
    // Agregar timestamp para evitar caché cuando se fuerza recarga después de transferencia
    return this.request<Order[]>(`/admin/api/orders/active?t=${Date.now()}`);
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

  async getOrdersByTable(tableId: number) {
    try {
      // Usar el endpoint específico para obtener pedidos de una mesa
      // Este endpoint incluye pedidos completados pero no archivados
      console.log(`📡 getOrdersByTable: Llamando a /api/tables/${tableId}/orders`);
      const orders = await this.request<Order[]>(`/api/tables/${tableId}/orders`);
      
      const completedCount = orders.filter(o => o.status === 'completed').length;
      const pendingCount = orders.filter(o => o.status === 'pending').length;
      const preparingCount = orders.filter(o => o.status === 'preparing').length;
      
      console.log(`✅ getOrdersByTable: Obtenidos ${orders.length} pedidos para mesa ${tableId}`, {
        total: orders.length,
        completados: completedCount,
        pendientes: pendingCount,
        preparando: preparingCount,
        pedidos: orders.map(o => ({ id: o.id, status: o.status, isArchived: o.isArchived }))
      });
      
      return orders;
    } catch (error: any) {
      // Si el endpoint no existe (404), usar el método anterior como fallback
      if (error?.response?.status === 404 || error?.response?.status === 401) {
        console.warn(`⚠️ Endpoint /api/tables/${tableId}/orders no disponible (${error?.response?.status}), usando método alternativo`);
        
        // Obtener TODOS los pedidos sin paginación para asegurar que incluya los completados
        console.log(`📡 getOrdersByTable (fallback): Obteniendo todos los pedidos...`);
        const ordersResponse = await this.getOrders({ 
          showArchived: false,
          page: 1,
          pageSize: 10000 // Tamaño muy grande para obtener todos los pedidos
        });
        
        // Manejar diferentes estructuras de respuesta
        let ordersArray: Order[] = [];
        
        if (Array.isArray(ordersResponse)) {
          ordersArray = ordersResponse;
        } else if (ordersResponse?.data && Array.isArray(ordersResponse.data)) {
          ordersArray = ordersResponse.data;
        } else {
          console.warn('❌ getOrdersByTable (fallback): Estructura de respuesta inesperada', ordersResponse);
          return [];
        }
        
        console.log(`📊 getOrdersByTable (fallback): Obtenidos ${ordersArray.length} pedidos totales del servidor`);
        
        // Convertir tableId a número para comparación
        const tableIdNum = Number(tableId);
        
        const tableOrders = ordersArray.filter(
          (order: Order) => {
            if (!order) return false;
            
            const orderTableId = order.tableId ? Number(order.tableId) : null;
            const matchesTable = orderTableId === tableIdNum;
            // Incluir pedidos activos (pending, preparing, delivering) Y pedidos completados (para cobrar)
            // Excluir SOLO cancelados y archivados (archivados = ya cobrados)
            const shouldInclude = order.status !== 'cancelled' && !order.isArchived;
            
            if (matchesTable) {
              console.log(`🔍 getOrdersByTable (fallback): Pedido #${order.id} - tableId: ${orderTableId}, status: ${order.status}, archivado: ${order.isArchived}, incluido: ${shouldInclude}`);
            }
            
            return matchesTable && shouldInclude;
          }
        );
        
        const completedCount = tableOrders.filter(o => o.status === 'completed').length;
        console.log(`✅ getOrdersByTable (fallback): Encontrados ${tableOrders.length} pedidos para mesa ${tableId} (${completedCount} completados)`);
        return tableOrders;
      }
      
      // Si es otro error, lanzarlo
      console.error('❌ Error en getOrdersByTable:', error);
      throw error;
    }
  }

  async deleteOrderItem(orderId: number, itemId: number) {
    return this.request<{ success: boolean; message: string; order: Order }>(`/api/tables/orders/${orderId}/items/${itemId}`, { method: 'DELETE' });
  }

  async processTablePayment(
    orderId: number, 
    paymentMethod: string, 
    posInfo?: { 
      transactionId?: number; 
      sTransactionId?: string; 
      transactionDateTime?: string; 
      response?: string 
    }
  ) {
    // Primero actualizar el método de pago del pedido
    const paymentMethodBody: any = { paymentMethod };
    
    // Si es pago POS y hay información de transacción, incluirla
    if (paymentMethod.toLowerCase() === 'pos' && posInfo) {
      paymentMethodBody.POSTransactionId = posInfo.transactionId;
      paymentMethodBody.POSTransactionIdString = posInfo.sTransactionId;
      paymentMethodBody.POSTransactionDateTime = posInfo.transactionDateTime;
      paymentMethodBody.POSResponse = posInfo.response;
    }
    
    await this.request<Order>(`/admin/api/orders/${orderId}/payment-method`, {
      method: 'PATCH',
      body: paymentMethodBody,
    });
    
    // Luego completar el pedido
    return this.updateOrderStatus(orderId, 'completed');
  }

  async sendPOSTransaction(amount: number) {
    const requestBody = { amount };
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📤 [POS FRONTEND] Enviando transacción al backend');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Endpoint: /admin/api/pos/transaction');
    console.log('JSON enviado al backend:', JSON.stringify(requestBody, null, 2));
    console.log('═══════════════════════════════════════════════════════════');
    
    const response = await this.request<{ 
      success: boolean; 
      message: string; 
      transactionId?: number;
      sTransactionId?: string;
      transactionDateTime?: string;
      requestJson?: string; // JSON enviado al ITD
      response?: string; // Respuesta recibida del ITD
    }>('/admin/api/pos/transaction', {
      method: 'POST',
      body: requestBody,
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [POS FRONTEND] Respuesta recibida del backend');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Respuesta completa:', JSON.stringify(response, null, 2));
    if (response.requestJson) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📤 JSON ENVIADO AL POSLINK (ITD):');
      console.log('═══════════════════════════════════════════════════════════');
      try {
        const jsonParsed = JSON.parse(response.requestJson);
        console.log(JSON.stringify(jsonParsed, null, 2));
      } catch {
        console.log(response.requestJson);
      }
      console.log('═══════════════════════════════════════════════════════════');
    }
    if (response.response) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📥 RESPUESTA RECIBIDA DEL POSLINK (ITD):');
      console.log('═══════════════════════════════════════════════════════════');
      try {
        const responseParsed = JSON.parse(response.response);
        console.log(JSON.stringify(responseParsed, null, 2));
      } catch {
        console.log(response.response);
      }
      console.log('═══════════════════════════════════════════════════════════');
    }
    console.log('═══════════════════════════════════════════════════════════');
    
    return response;
  }

  async sendPOSVoid(
    amount: number, 
    originalTransactionDateTime?: string,
    orderId?: number,
    ticketNumber?: string,
    taxableAmount?: number,
    invoiceAmount?: number
  ) {
    return this.request<{ 
      success: boolean; 
      message: string; 
      response?: string; 
      responseCode?: number;
      refundTransactionId?: number;
      refundTransactionIdString?: string;
      refundTransactionDateTime?: string;
    }>('/admin/api/pos/void', {
      method: 'POST',
      body: { 
        amount,
        originalTransactionDateTime,
        orderId,
        ticketNumber,
        taxableAmount,
        invoiceAmount
      },
    });
  }

  async queryPOSTransaction(transactionId: number | string, transactionDateTime: string) {
    const requestBody: { transactionId?: number; sTransactionId?: string; transactionDateTime: string } = {
      transactionDateTime,
    };
    
    if (typeof transactionId === 'number') {
      requestBody.transactionId = transactionId;
      requestBody.sTransactionId = transactionId.toString();
    } else {
      requestBody.sTransactionId = transactionId;
      const parsed = parseInt(transactionId, 10);
      if (!isNaN(parsed)) {
        requestBody.transactionId = parsed;
      }
    }

    console.log('🔄 [POS] Consultando estado de transacción (polling):', {
      transactionId,
      transactionDateTime,
      requestBody
    });

    const response = await this.request<{ 
      success: boolean;
      statusCode: number;
      statusMessage: string;
      isCompleted: boolean;
      isPending: boolean;
      isError: boolean;
      remainingExpirationTime?: number | null;
      response?: string;
    }>('/admin/api/pos/query', {
      method: 'POST',
      body: requestBody,
    });
    
    console.log('📥 [POS] Respuesta del polling:', {
      success: response.success,
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      isCompleted: response.isCompleted,
      isPending: response.isPending,
      isError: response.isError,
      response: response.response,
      respuestaCompleta: response
    });

    return response;
  }

  async sendPOSReverse(transactionId?: number | string, transactionDateTime?: string, orderId?: number) {
    const requestBody: { 
      transactionId?: number; 
      sTransactionId?: string; 
      transactionDateTime?: string;
      orderId?: number;
    } = {};
    
    if (orderId) {
      requestBody.orderId = orderId;
    } else if (transactionId) {
      if (typeof transactionId === 'number') {
        requestBody.transactionId = transactionId;
        requestBody.sTransactionId = transactionId.toString();
      } else {
        requestBody.sTransactionId = transactionId;
        const parsed = parseInt(transactionId, 10);
        if (!isNaN(parsed)) {
          requestBody.transactionId = parsed;
        }
      }
      
      if (transactionDateTime) {
        requestBody.transactionDateTime = transactionDateTime;
      }
    }

    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔄 [POS FRONTEND] Enviando reverso al backend');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Endpoint: /admin/api/pos/reverse');
    console.log('JSON enviado al backend:', JSON.stringify(requestBody, null, 2));
    console.log('═══════════════════════════════════════════════════════════');

    const response = await this.request<{ 
      success: boolean; 
      message: string; 
      responseCode?: number;
      requestJson?: string; // JSON enviado al ITD
      response?: string; // Respuesta recibida del ITD
    }>('/admin/api/pos/reverse', {
      method: 'POST',
      body: requestBody,
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📥 [POS FRONTEND] Respuesta de reverso recibida del backend');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Respuesta completa:', JSON.stringify(response, null, 2));
    if (response.requestJson) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🔄 JSON ENVIADO AL POSLINK (ITD) PARA REVERSO:');
      console.log('═══════════════════════════════════════════════════════════');
      try {
        const jsonParsed = JSON.parse(response.requestJson);
        console.log(JSON.stringify(jsonParsed, null, 2));
      } catch {
        console.log(response.requestJson);
      }
      console.log('═══════════════════════════════════════════════════════════');
    }
    if (response.response) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('📥 RESPUESTA RECIBIDA DEL POSLINK (ITD) PARA REVERSO:');
      console.log('═══════════════════════════════════════════════════════════');
      try {
        const responseParsed = JSON.parse(response.response);
        console.log(JSON.stringify(responseParsed, null, 2));
      } catch {
        console.log(response.response);
      }
      console.log('═══════════════════════════════════════════════════════════');
    }
    console.log('═══════════════════════════════════════════════════════════');

    return response;
  }

  // Products
  async getProducts() {
    return this.request<Product[]>('/admin/api/products');
  }

  async getProduct(id: number) {
    return this.request<Product>(`/api/products/${id}`);
  }

  async createProduct(data: CreateProductRequest) {
    return this.request<Product>('/admin/api/products', { method: 'POST', body: data });
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

  // SubProducts
  async getSubProductsByProduct(productId: number) {
    return this.request<SubProduct[]>(`/admin/api/subproducts/product/${productId}`);
  }

  async getSubProduct(id: number) {
    return this.request<SubProduct>(`/admin/api/subproducts/${id}`);
  }

  async createSubProduct(data: CreateSubProductRequest) {
    return this.request<SubProduct>('/admin/api/subproducts', { method: 'POST', body: data });
  }

  async updateSubProduct(id: number, data: UpdateSubProductRequest) {
    return this.request<SubProduct>(`/admin/api/subproducts/${id}`, { method: 'PUT', body: data });
  }

  async deleteSubProduct(id: number) {
    return this.request(`/admin/api/subproducts/${id}`, { method: 'DELETE' });
  }

  // Categories
  async getCategories(queryParams?: string) {
    const endpoint = queryParams ? `/api/categories${queryParams}` : '/api/categories';
    return this.request<Category[]>(endpoint);
  }

  async getCategory(id: number) {
    return this.request<Category>(`/api/categories/${id}`);
  }

  async createCategory(data: CreateCategoryRequest) {
    return this.request<Category>('/admin/api/categories', { method: 'POST', body: data });
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

  // Delivery Person Cash Register (Admin)
  async getDeliveryPersonCashRegisterStatus(deliveryPersonId: number) {
    return this.request<{ isOpen: boolean; cashRegister: any }>(`/admin/api/delivery-persons/${deliveryPersonId}/cash-register/status`);
  }

  async openDeliveryPersonCashRegister(deliveryPersonId: number, initialAmount: number) {
    return this.request<any>(`/admin/api/delivery-persons/${deliveryPersonId}/cash-register/open`, {
      method: 'POST',
      body: { initialAmount },
    });
  }

  async closeDeliveryPersonCashRegister(deliveryPersonId: number, notes?: string) {
    return this.request<{
      cashRegister: any;
      movements: any[];
      summary: {
        totalOrders: number;
        totalSales: number;
        totalCash: number;
        totalPOS: number;
        totalTransfer: number;
      };
    }>(`/admin/api/delivery-persons/${deliveryPersonId}/cash-register/close`, {
      method: 'POST',
      body: { notes },
    });
  }

  // Admin: Obtener pedidos de un repartidor específico
  async getDeliveryPersonOrdersByAdmin(deliveryPersonId: number, includeCompleted: boolean = false) {
    return this.request<Order[]>(`/admin/api/delivery-persons/${deliveryPersonId}/orders?includeCompleted=${includeCompleted}`);
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
    return this.request<Table>(`/api/tables/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  async freeTable(id: number) {
    return this.request<{ message: string; table: Table }>(`/api/tables/${id}/free`, {
      method: 'POST',
    });
  }

  async syncTableStatus(id: number) {
    return this.request<{ message: string; oldStatus?: string; newStatus?: string; status?: string; table: Table }>(`/api/tables/${id}/sync-status`, {
      method: 'POST',
    });
  }

  async transferTableOrders(sourceTableId: number, targetTableId: number) {
    return this.request<{ 
      message: string; 
      transferredOrdersCount: number; 
      sourceTable: { id: number; number: string; status: string }; 
      targetTable: { id: number; number: string; status: string } 
    }>(`/api/tables/${sourceTableId}/transfer-to/${targetTableId}`, {
      method: 'POST',
    });
  }

  async createOrderFromTable(tableId: number, data: { items: Array<{ id: number; name: string; price: number; quantity: number; subProducts?: Array<{ id: number; name: string; price: number }> }>; paymentMethod?: string; comments?: string }) {
    return this.request<{ id: number; message: string; order: Order; table: Table }>(`/api/tables/${tableId}/create-order`, { method: 'POST', body: data });
  }

  // Public endpoints for waiters (no authentication required)
  async getTablesForWaiter() {
    return this.request<Table[]>('/api/tables/waiter', { skipAuth: true });
  }

  async getProductsForWaiter() {
    return this.request<Product[]>('/admin/api/products/waiter', { skipAuth: true });
  }

  async getCategoriesForWaiter() {
    return this.request<Category[]>('/admin/api/categories/waiter', { skipAuth: true });
  }

  async createOrderFromTableForWaiter(tableId: number, data: { items: Array<{ id: number; name: string; price: number; quantity: number; subProducts?: Array<{ id: number; name: string; price: number }> }>; paymentMethod?: string; comments?: string }) {
    return this.request<{ id: number; message: string; order: Order; table: Table }>(`/api/tables/waiter/${tableId}/create-order`, { method: 'POST', body: data, skipAuth: true });
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

  async createCustomer(data: CreateCustomerRequest) {
    return this.request<Customer>('/admin/api/customers', { method: 'POST', body: data });
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

  // Cash Register
  async getCashRegisterStatus() {
    return this.request<{ isOpen: boolean; cashRegister?: any }>('/admin/api/cash-register/status');
  }

  async openCashRegister(initialAmount: number) {
    return this.request<any>('/admin/api/cash-register/open', {
      method: 'POST',
      body: { initialAmount },
    });
  }

  async closeCashRegister(notes?: string) {
    return this.request<any>('/admin/api/cash-register/close', {
      method: 'POST',
      body: { notes },
    });
  }

  // Delivery Cash Register (Caja de Repartidor)
  async getDeliveryCashRegisterStatus() {
    return this.request<{ isOpen: boolean; cashRegister: any }>('/api/delivery-cash-register/status');
  }

  async openDeliveryCashRegister() {
    return this.request<any>('/api/delivery-cash-register/open', {
      method: 'POST',
    });
  }

  async closeDeliveryCashRegister(notes?: string) {
    return this.request<any>('/api/delivery-cash-register/close', {
      method: 'POST',
      body: { notes },
    });
  }

  async getDeliveryOrders() {
    return this.request<Order[]>('/api/delivery-cash-register/orders');
  }

  // Delivery Cash Register: Actualizar estado de pedido con nota
  async updateDeliveryCashRegisterOrderStatus(orderId: number, status: string, note?: string) {
    return this.request<Order>(`/api/delivery-cash-register/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status, note },
    });
  }

  async getCashRegisterHistory(page: number = 1, pageSize: number = 20) {
    return this.request<{ cashRegisters: any[]; total: number; page: number; pageSize: number; totalPages: number }>(
      `/admin/api/cash-register/history?page=${page}&pageSize=${pageSize}`
    );
  }

  async getCashRegistersReport(period: string = 'month') {
    return this.request<any>(`/admin/api/reports/cash-registers?period=${period}`);
  }

  async getCashRegisterMovements(cashRegisterId: number) {
    return this.request<any>(`/admin/api/cash-register/${cashRegisterId}/movements`);
  }

  // Delivery Person (Repartidor) endpoints
  async deliveryPersonLogin(username: string, password: string) {
    return this.request<{ token: string; deliveryPerson: any }>('/api/deliveryperson/login', {
      method: 'POST',
      body: { username, password },
      skipAuth: true,
    });
  }

  async getDeliveryPersonOrders() {
    return this.request<Order[]>('/api/deliveryperson/orders');
  }

  async getDeliveryPersonOrder(orderId: number) {
    return this.request<Order>(`/api/deliveryperson/orders/${orderId}`);
  }

  async updateDeliveryPersonLocation(orderId: number, latitude: number, longitude: number) {
    return this.request<any>(`/api/deliveryperson/orders/${orderId}/location`, {
      method: 'PATCH',
      body: { latitude, longitude },
    });
  }

  async updateDeliveryOrderStatus(orderId: number, status: string) {
    return this.request<Order>(`/api/deliveryperson/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  async verifyDeliveryPersonToken() {
    return this.request<{ deliveryPerson: any }>('/api/deliveryperson/verify', {
      method: 'POST',
    });
  }

  // Admin Users
  async getAdminUsers(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<{ data: AdminUser[]; total: number }>(`/admin/api/users${query}`);
  }

  async getAdminUser(id: number) {
    return this.request<AdminUser>(`/admin/api/users/${id}`);
  }

  async createAdminUser(user: CreateAdminUserRequest) {
    return this.request<AdminUser>('/admin/api/users', {
      method: 'POST',
      body: user,
    });
  }

  async updateAdminUser(id: number, user: UpdateAdminUserRequest) {
    return this.request<AdminUser>(`/admin/api/users/${id}`, {
      method: 'PUT',
      body: user,
    });
  }

  async deleteAdminUser(id: number) {
    return this.request<{ message: string }>(`/admin/api/users/${id}`, {
      method: 'DELETE',
    });
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
  CreateCustomerRequest,
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
  CreateSpaceRequest,
  SubProduct,
  CreateSubProductRequest,
  UpdateSubProductRequest,
  CashRegister,
  CashRegisterStatus,
  OpenCashRegisterRequest,
  CloseCashRegisterRequest,
  CashRegistersReport,
  UpdateAdminUserRequest,
  CreateAdminUserRequest,
  AdminUser,
  UpdateEmailConfigRequest,
  EmailConfig
} from '../types';

// Export singleton instance
export const api = new ApiClient();
export default api;


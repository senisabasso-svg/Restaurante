import { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Package,
  CreditCard,
  Calendar,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Users,
  Truck,
  FileSpreadsheet,
  Award,
  RotateCcw,
  AlertCircle,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useToast } from '../../components/Toast/ToastContext';
import Pagination from '../../components/Pagination/Pagination';
import Modal from '../../components/Modal/Modal';
import api from '../../api/client';
import type { 
  RevenueData, 
  TopProduct, 
  ReportStats, 
  RevenueByPaymentMethod,
  ComparisonData,
  PeakHoursData,
  TopCustomer,
  DeliveryPerformance,
  CashRegistersReport
} from '../../types';

type Period = 'today' | 'week' | 'month' | 'year';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

// Componente de número animado
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: { 
  value: number; 
  prefix?: string; 
  suffix?: string; 
  decimals?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    const duration = 1000;
    const startTime = performance.now();
    const startValue = displayValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (value - startValue) * easeOutQuart;
      
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value]);

  return (
    <span>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  );
}

// Componente de indicador de cambio
function ChangeIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  
  if (value === 0) return <span className="text-gray-400 text-sm">Sin cambios</span>;
  
  return (
    <span className={`flex items-center gap-1 text-sm font-medium ${
      isPositive ? 'text-green-600' : 'text-red-600'
    }`}>
      <Icon size={16} />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function ReportsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<Period>('month');
  
  // Data states
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [revenueByPayment, setRevenueByPayment] = useState<RevenueByPaymentMethod[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHoursData | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [deliveryPerformance, setDeliveryPerformance] = useState<DeliveryPerformance[]>([]);
  const [cashRegistersReport, setCashRegistersReport] = useState<CashRegistersReport | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Cash Register Movements Modal
  const [isCashRegisterMovementsModalOpen, setIsCashRegisterMovementsModalOpen] = useState(false);
  const [cashRegisterMovements, setCashRegisterMovements] = useState<any>(null);
  const [loadingMovements, setLoadingMovements] = useState(false);
  
  // Refund Ticket Modal
  const [isRefundTicketModalOpen, setIsRefundTicketModalOpen] = useState(false);
  const [selectedRefundOrder, setSelectedRefundOrder] = useState<any>(null);

  useEffect(() => {
    loadReports();
  }, [period]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [revenue, products, statistics, paymentRevenue, comp, hours, customers, delivery, cashRegisters] = await Promise.all([
        api.getRevenueReport(period),
        api.getTopProducts(period, 10),
        api.getReportStats(period),
        api.getRevenueByPaymentMethod(period),
        api.getComparison(period),
        api.getPeakHours(period),
        api.getTopCustomers(period, 5),
        api.getDeliveryPerformance(period),
        api.getCashRegistersReport(period),
      ]);
      setRevenueData(revenue);
      setTopProducts(products);
      setStats(statistics);
      setRevenueByPayment(paymentRevenue);
      setComparison(comp);
      setPeakHours(hours);
      setTopCustomers(customers);
      setDeliveryPerformance(delivery);
      setCashRegistersReport(cashRegisters);
    } catch (error) {
      showToast('Error al cargar los reportes', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCashRegisterMovements = async (cashRegisterId: number) => {
    try {
      setLoadingMovements(true);
      setIsCashRegisterMovementsModalOpen(true);
      const movements = await api.getCashRegisterMovements(cashRegisterId);
      
      // Agrupar pedidos POS por posTransactionId para mostrar una sola opción de devolución por transacción
      if (movements.orders) {
        const groupedOrders: any[] = [];
        const posTransactionsMap = new Map<string, any>();
        const nonPosOrders: any[] = [];

        movements.orders.forEach((order: any) => {
          // Si es pago POS y tiene transacción ID, agrupar por posTransactionId
          if (order.paymentMethod?.toLowerCase() === 'pos' && (order.posTransactionId || order.posTransactionIdString)) {
            const transactionId = order.posTransactionId?.toString() || order.posTransactionIdString || '';
            
            if (posTransactionsMap.has(transactionId)) {
              // Ya existe una transacción con este ID, agregar este pedido al grupo
              const existing = posTransactionsMap.get(transactionId);
              existing.orders.push(order);
              existing.total += order.total;
              existing.itemsCount += order.itemsCount;
              existing.orderIds.push(order.id);
            } else {
              // Primera vez que vemos esta transacción POS
              posTransactionsMap.set(transactionId, {
                ...order,
                orders: [order],
                orderIds: [order.id],
                // Mantener la información de la primera transacción POS
                posTransactionId: order.posTransactionId,
                posTransactionIdString: order.posTransactionIdString,
                posTransactionDateTime: order.posTransactionDateTime,
                posResponse: order.posResponse,
                posRefundTransactionId: order.posRefundTransactionId,
                posRefundTransactionIdString: order.posRefundTransactionIdString,
                posRefundTransactionDateTime: order.posRefundTransactionDateTime,
                posRefundResponse: order.posRefundResponse,
                posRefundedAt: order.posRefundedAt,
                // Usar la fecha más antigua
                createdAt: order.createdAt,
                // Combinar información de clientes/mesas
                customerNames: order.customerName ? [order.customerName] : [],
                tableIds: order.tableId ? [order.tableId] : []
              });
            }
          } else {
            // Pedidos que no son POS, agregarlos directamente
            nonPosOrders.push(order);
          }
        });

        // Convertir el mapa a array y agregar los pedidos no POS
        groupedOrders.push(...Array.from(posTransactionsMap.values()));
        groupedOrders.push(...nonPosOrders);
        
        // Ordenar por fecha (más reciente primero)
        groupedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        movements.orders = groupedOrders;
      }
      
      setCashRegisterMovements(movements);
    } catch (error) {
      showToast('Error al cargar los movimientos de la caja', 'error');
      console.error(error);
      setIsCashRegisterMovementsModalOpen(false);
    } finally {
      setLoadingMovements(false);
    }
  };

  const handlePOSVoid = async (order: any) => {
    if (!order.posTransactionId && !order.posTransactionIdString) {
      showToast('No hay información de transacción POS para este pedido', 'error');
      return;
    }

    // Si hay múltiples pedidos agrupados, usar el primero para obtener la información
    const firstOrder = order.orders && order.orders.length > 0 ? order.orders[0] : order;
    const orderIds = order.orderIds || [order.id];
    const orderCount = order.orders ? order.orders.length : 1;

    const confirmMessage = orderCount > 1
      ? `¿Está seguro que desea hacer la devolución de la transacción POS?\n\n${orderCount} pedidos agrupados (IDs: ${orderIds.join(', ')})\nMonto total: $${order.total.toFixed(2)}\nTransaction ID: ${order.posTransactionId || order.posTransactionIdString}`
      : `¿Está seguro que desea hacer la devolución de la transacción POS?\n\nPedido: #${order.id}\nMonto: $${order.total.toFixed(2)}\nTransaction ID: ${order.posTransactionId || order.posTransactionIdString}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Extraer TicketNumber del TransactionId (últimos 4 dígitos)
      let ticketNumber: string | undefined;
      if (order.posTransactionIdString) {
        const idStr = order.posTransactionIdString;
        ticketNumber = idStr.length >= 4 
          ? idStr.substring(idStr.length - 4).padStart(4, '0')
          : idStr.padStart(4, '0');
      } else if (order.posTransactionId) {
        const idStr = order.posTransactionId.toString();
        ticketNumber = idStr.length >= 4 
          ? idStr.substring(idStr.length - 4).padStart(4, '0')
          : idStr.padStart(4, '0');
      }

      // Enviar devolución con el monto total y la información de la primera transacción
      const result = await api.sendPOSVoid(
        order.total, // Monto total de todos los pedidos agrupados
        order.posTransactionDateTime || firstOrder.posTransactionDateTime,
        firstOrder.id, // OrderId del primer pedido para que el backend pueda obtener más información
        ticketNumber
      );

      if (result.success) {
        showToast(`Devolución POS procesada exitosamente${orderCount > 1 ? ` para ${orderCount} pedidos` : ''}`, 'success');
        // Recargar movimientos para actualizar la vista
        if (cashRegisterMovements?.cashRegister?.id) {
          const movements = await api.getCashRegisterMovements(cashRegisterMovements.cashRegister.id);
          // Re-aplicar el agrupamiento
          if (movements.orders) {
            const groupedOrders: any[] = [];
            const posTransactionsMap = new Map<string, any>();
            const nonPosOrders: any[] = [];

            movements.orders.forEach((o: any) => {
              if (o.paymentMethod?.toLowerCase() === 'pos' && (o.posTransactionId || o.posTransactionIdString)) {
                const transactionId = o.posTransactionId?.toString() || o.posTransactionIdString || '';
                
                if (posTransactionsMap.has(transactionId)) {
                  const existing = posTransactionsMap.get(transactionId);
                  existing.orders.push(o);
                  existing.total += o.total;
                  existing.itemsCount += o.itemsCount;
                  existing.orderIds.push(o.id);
                } else {
                  posTransactionsMap.set(transactionId, {
                    ...o,
                    orders: [o],
                    orderIds: [o.id],
                    posTransactionId: o.posTransactionId,
                    posTransactionIdString: o.posTransactionIdString,
                    posTransactionDateTime: o.posTransactionDateTime,
                    posResponse: o.posResponse,
                    posRefundTransactionId: o.posRefundTransactionId,
                    posRefundTransactionIdString: o.posRefundTransactionIdString,
                    posRefundTransactionDateTime: o.posRefundTransactionDateTime,
                    posRefundResponse: o.posRefundResponse,
                    posRefundedAt: o.posRefundedAt,
                    createdAt: o.createdAt,
                    customerNames: o.customerName ? [o.customerName] : [],
                    tableIds: o.tableId ? [o.tableId] : []
                  });
                }
              } else {
                nonPosOrders.push(o);
              }
            });

            groupedOrders.push(...Array.from(posTransactionsMap.values()));
            groupedOrders.push(...nonPosOrders);
            groupedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            movements.orders = groupedOrders;
          }
          setCashRegisterMovements(movements);
        }
      } else {
        showToast(`Devolución POS: ${result.message}`, result.responseCode === -100 ? 'error' : 'warning');
      }
    } catch (error: any) {
      showToast(`Error al procesar devolución POS: ${error.message}`, 'error');
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const data = await api.getExportData(period);
      
      // Crear workbook
      const wb = XLSX.utils.book_new();
      
      // Hoja de pedidos
      const ordersSheet = XLSX.utils.json_to_sheet(data.map(order => ({
        'ID': order.id,
        'Fecha': new Date(order.createdAt).toLocaleString('es-ES'),
        'Cliente': order.customerName,
        'Teléfono': order.customerPhone || '',
        'Dirección': order.customerAddress,
        'Estado': order.status,
        'Método de Pago': order.paymentMethod,
        'Total': order.total,
        'Repartidor': order.deliveryPerson || '',
        'Productos': order.items
      })));
      XLSX.utils.book_append_sheet(wb, ordersSheet, 'Pedidos');
      
      // Hoja de resumen
      if (stats) {
        const summarySheet = XLSX.utils.json_to_sheet([{
          'Período': period,
          'Total Pedidos': stats.totalOrders,
          'Completados': stats.completedOrders,
          'Cancelados': stats.cancelledOrders,
          'Ingresos Totales': stats.totalRevenue,
          'Ticket Promedio': stats.averageOrderValue,
          'Tasa Completados': `${stats.completionRate.toFixed(1)}%`,
          'Tasa Cancelación': `${stats.cancellationRate.toFixed(1)}%`
        }]);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen');
      }
      
      // Hoja de productos
      if (topProducts.length > 0) {
        const productsSheet = XLSX.utils.json_to_sheet(topProducts.map(p => ({
          'Producto': p.productName,
          'Cantidad Vendida': p.quantitySold,
          'Ingresos': p.revenue
        })));
        XLSX.utils.book_append_sheet(wb, productsSheet, 'Productos');
      }
      
      // Generar archivo
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `reporte_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      showToast('Reporte exportado correctamente', 'success');
    } catch (error) {
      showToast('Error al exportar reporte', 'error');
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const periodLabels: Record<Period, string> = {
    today: 'Hoy',
    week: 'Última semana',
    month: 'Último mes',
    year: 'Último año',
  };

  const formatCurrency = (value: number) => {
    // Formatear como pesos uruguayos (UYU) - usar formato simple para consistencia
    // El símbolo $ puede confundirse con dólares, así que usamos formato numérico con "UYU"
    return `UYU ${value.toLocaleString('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      'cash': '💵 Efectivo',
      'transfer': '🏦 Transferencia',
      'card': '💳 Tarjeta',
      'mercadopago': '📱 Mercado Pago',
    };
    return labels[method?.toLowerCase()] || method;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
              <BarChart3 size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Reportes y Análisis</h1>
              <p className="text-gray-500">Estadísticas y métricas de tu negocio</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Selector de período */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {(['today', 'week', 'month', 'year'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    period === p
                      ? 'bg-white shadow text-primary-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            
            {/* Botón exportar */}
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={18} />
              )}
              Exportar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Comparativa cards */}
      {comparison && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign size={20} className="text-green-600" />
              </div>
              <ChangeIndicator value={comparison.changes.revenuePercent} />
            </div>
            <p className="text-sm text-gray-500 mb-1">Ingresos</p>
            <p className="text-2xl font-bold text-gray-800">
              <AnimatedNumber value={comparison.current.revenue} prefix="$" decimals={0} />
            </p>
            <p className="text-xs text-gray-400 mt-1">
              vs {formatCurrency(comparison.previous.revenue)} anterior
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart size={20} className="text-blue-600" />
              </div>
              <ChangeIndicator value={comparison.changes.ordersPercent} />
            </div>
            <p className="text-sm text-gray-500 mb-1">Pedidos</p>
            <p className="text-2xl font-bold text-gray-800">
              <AnimatedNumber value={comparison.current.orders} decimals={0} />
            </p>
            <p className="text-xs text-gray-400 mt-1">
              vs {comparison.previous.orders} anterior
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp size={20} className="text-purple-600" />
              </div>
              <ChangeIndicator value={comparison.changes.averagePercent} />
            </div>
            <p className="text-sm text-gray-500 mb-1">Ticket Promedio</p>
            <p className="text-2xl font-bold text-gray-800">
              <AnimatedNumber value={comparison.current.averageOrder} prefix="$" decimals={0} />
            </p>
            <p className="text-xs text-gray-400 mt-1">
              vs {formatCurrency(comparison.previous.averageOrder)} anterior
            </p>
          </div>
        </div>
      )}

      {/* Gráfico de ingresos por día */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-primary-500" />
          Ingresos por Día
        </h2>
        
        {!revenueData || revenueData.revenueByDay.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData.revenueByDay.map(d => ({
              ...d,
              date: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip 
                formatter={(value: number | undefined) => [value !== undefined ? formatCurrency(value) : '$0', 'Ingresos']}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#6366f1" 
                strokeWidth={3}
                dot={{ fill: '#6366f1', strokeWidth: 2 }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Productos */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package size={20} className="text-primary-500" />
            Productos Más Vendidos
          </h2>
          
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((product, index) => {
                const maxQty = topProducts[0]?.quantitySold || 1;
                const percentage = (product.quantitySold / maxQty) * 100;
                
                return (
                  <div key={product.productId} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-600' :
                          index === 2 ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="font-medium text-gray-800">{product.productName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-800">{product.quantitySold} uds</span>
                        <span className="text-xs text-gray-500 ml-2">{formatCurrency(product.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                          index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-400' :
                          index === 2 ? 'bg-gradient-to-r from-amber-300 to-amber-400' :
                          'bg-gradient-to-r from-primary-300 to-primary-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ingresos por método de pago (Pie Chart) */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CreditCard size={20} className="text-primary-500" />
            Ingresos por Método de Pago
          </h2>
          iego senisa 
          {revenueByPayment.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={revenueByPayment.map(m => ({
                    ...m,
                    name: getPaymentMethodLabel(m.paymentMethod)
                  }))}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {revenueByPayment.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value !== undefined ? formatCurrency(value) : '$0'} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Horas Pico */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-primary-500" />
            Horas Pico de Pedidos
            {peakHours && (
              <span className="ml-auto text-sm bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                🔥 Pico: {peakHours.peakHour}:00 ({peakHours.peakOrders} pedidos)
              </span>
            )}
          </h2>
          
          {!peakHours || peakHours.hourlyData.every(h => h.ordersCount === 0) ? (
            <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHours.hourlyData.filter(h => h.hour >= 8 && h.hour <= 23)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}h`} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: number | undefined, name?: string) => [value ?? 0, name === 'ordersCount' ? 'Pedidos' : 'Ingresos']}
                  labelFormatter={(h) => `${h}:00 - ${h}:59`}
                />
                <Bar dataKey="ordersCount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Clientes */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users size={20} className="text-primary-500" />
            Top Clientes VIP
          </h2>
          
          {topCustomers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-amber-600' :
                    'bg-primary-400'
                  }`}>
                    {index === 0 ? '👑' : index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{customer.customerName}</p>
                    <p className="text-xs text-gray-500">{customer.ordersCount} pedidos</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{formatCurrency(customer.totalSpent)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rendimiento de Repartidores */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Truck size={20} className="text-primary-500" />
          Rendimiento de Repartidores
        </h2>
        
        {deliveryPerformance.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay datos para este período</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Repartidor</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Entregas</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Completadas</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Canceladas</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Tasa Éxito</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Ingresos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = startIndex + itemsPerPage;
                    const paginatedPerformance = deliveryPerformance.slice(startIndex, endIndex);
                    
                    return paginatedPerformance.map((dp, index) => {
                      const originalIndex = startIndex + index;
                      return (
                        <tr key={dp.deliveryPersonId} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {originalIndex === 0 && <Award size={16} className="text-yellow-500" />}
                              <span className="font-medium text-gray-800">{dp.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-gray-600">{dp.totalDeliveries}</td>
                          <td className="px-4 py-3 text-center text-green-600 font-medium">{dp.completedDeliveries}</td>
                          <td className="px-4 py-3 text-center text-red-600">{dp.cancelledDeliveries}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              dp.completionRate >= 90 ? 'bg-green-100 text-green-700' :
                              dp.completionRate >= 70 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {dp.completionRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(dp.totalRevenue)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
            {deliveryPerformance.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(deliveryPerformance.length / itemsPerPage)}
                totalItems={deliveryPerformance.length}
                itemsPerPage={itemsPerPage}
                startIndex={(currentPage - 1) * itemsPerPage}
                endIndex={Math.min((currentPage - 1) * itemsPerPage + itemsPerPage, deliveryPerformance.length)}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </div>

      {/* Reporte de Cajas */}
      {cashRegistersReport && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-primary-500" />
            Reporte de Cajas
          </h2>
          
          {cashRegistersReport.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-gray-800">{cashRegistersReport.summary.totalCashRegisters}</div>
                <div className="text-sm text-gray-500">Total Cajas</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{cashRegistersReport.summary.openCashRegisters}</div>
                <div className="text-sm text-gray-500">Cajas Abiertas</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(cashRegistersReport.summary.totalSales)}</div>
                <div className="text-sm text-gray-500">Total Ventas</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(cashRegistersReport.summary.totalCash)}</div>
                <div className="text-sm text-gray-500">Total Efectivo</div>
              </div>
            </div>
          )}

          {cashRegistersReport.cashRegisters && cashRegistersReport.cashRegisters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Apertura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha Cierre</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto Inicial</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Ventas</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Efectivo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">POS</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Transferencias</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto Final</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cashRegistersReport.cashRegisters.map((cashRegister) => (
                    <tr 
                      key={cashRegister.id} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleViewCashRegisterMovements(cashRegister.id)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(cashRegister.openedAt).toLocaleString('es-ES')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {cashRegister.closedAt ? new Date(cashRegister.closedAt).toLocaleString('es-ES') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                        {formatCurrency(cashRegister.initialAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">
                        {formatCurrency(cashRegister.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-green-600">
                        {formatCurrency(cashRegister.totalCash)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-blue-600">
                        {formatCurrency(cashRegister.totalPOS)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-purple-600">
                        {formatCurrency(cashRegister.totalTransfer)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-primary-600">
                        {formatCurrency(cashRegister.finalAmount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          cashRegister.isOpen 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {cashRegister.isOpen ? 'Abierta' : 'Cerrada'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No hay cajas registradas para este período</p>
          )}
        </div>
      )}

      {/* Resumen de estados */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className="text-3xl font-bold text-gray-800">{stats.totalOrders}</div>
            <div className="text-sm text-gray-500">Total Pedidos</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completedOrders}</div>
            <div className="text-sm text-gray-500">Completados</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.cancelledOrders}</div>
            <div className="text-sm text-gray-500">Cancelados</div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-4 text-center">
            <div className={`text-3xl font-bold ${
              stats.completionRate >= 80 ? 'text-green-600' : 
              stats.completionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.completionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500">Tasa de Éxito</div>
          </div>
        </div>
      )}

      {/* Modal de Movimientos de Caja */}
      <Modal
        isOpen={isCashRegisterMovementsModalOpen}
        onClose={() => {
          setIsCashRegisterMovementsModalOpen(false);
          setCashRegisterMovements(null);
        }}
        title="Movimientos de Caja"
        size="xl"
      >
        {loadingMovements ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : cashRegisterMovements ? (
          <div className="space-y-6">
            {/* Información de la Caja */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Apertura:</span>
                  <p className="font-medium text-gray-800">
                    {new Date(cashRegisterMovements.cashRegister.openedAt).toLocaleString('es-ES')}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Cierre:</span>
                  <p className="font-medium text-gray-800">
                    {cashRegisterMovements.cashRegister.closedAt 
                      ? new Date(cashRegisterMovements.cashRegister.closedAt).toLocaleString('es-ES')
                      : 'Abierta'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Monto Inicial:</span>
                  <p className="font-medium text-gray-800">
                    {formatCurrency(cashRegisterMovements.cashRegister.initialAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Monto Final:</span>
                  <p className="font-medium text-gray-800">
                    {cashRegisterMovements.cashRegister.finalAmount 
                      ? formatCurrency(cashRegisterMovements.cashRegister.finalAmount)
                      : '-'}
                  </p>
                </div>
                {cashRegisterMovements.cashRegister.createdBy && (
                  <div>
                    <span className="text-sm text-gray-500">Abierta por:</span>
                    <p className="font-medium text-gray-800">{cashRegisterMovements.cashRegister.createdBy}</p>
                  </div>
                )}
                {cashRegisterMovements.cashRegister.closedBy && (
                  <div>
                    <span className="text-sm text-gray-500">Cerrada por:</span>
                    <p className="font-medium text-gray-800">{cashRegisterMovements.cashRegister.closedBy}</p>
                  </div>
                )}
              </div>
              {cashRegisterMovements.cashRegister.notes && (
                <div>
                  <span className="text-sm text-gray-500">Notas:</span>
                  <p className="font-medium text-gray-800">{cashRegisterMovements.cashRegister.notes}</p>
                </div>
              )}
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{cashRegisterMovements.summary.totalOrders}</div>
                <div className="text-sm text-gray-600">Total Pedidos</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(cashRegisterMovements.summary.totalSales)}
                </div>
                <div className="text-sm text-gray-600">Total Ventas</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(cashRegisterMovements.summary.totalCash)}
                </div>
                <div className="text-sm text-gray-600">Efectivo</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(cashRegisterMovements.summary.totalPOS + cashRegisterMovements.summary.totalTransfer)}
                </div>
                <div className="text-sm text-gray-600">POS + Transfer</div>
              </div>
            </div>

            {/* Desglose por Método de Pago */}
            {cashRegisterMovements.summary.byPaymentMethod && cashRegisterMovements.summary.byPaymentMethod.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Desglose por Método de Pago</h3>
                <div className="space-y-2">
                  {cashRegisterMovements.summary.byPaymentMethod.map((method: any, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {method.paymentMethod === 'cash' ? 'Efectivo' :
                         method.paymentMethod === 'pos' ? 'POS' :
                         method.paymentMethod === 'transfer' ? 'Transferencia' :
                         method.paymentMethod}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-800">{method.count} pedidos</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {formatCurrency(method.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Pedidos */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Pedidos ({cashRegisterMovements.orders.length})</h3>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {cashRegisterMovements.orders.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No hay pedidos registrados para esta caja
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente/Mesa</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Info POS</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cashRegisterMovements.orders.map((order: any) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleString('es-ES')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.orders && order.orders.length > 1 ? (
                              // Múltiples pedidos agrupados por transacción POS
                              <div>
                                <div className="font-medium text-gray-800">
                                  {order.orders.length} pedido{order.orders.length > 1 ? 's' : ''} agrupados
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {order.customerNames && order.customerNames.length > 0 && (
                                    <div>Clientes: {order.customerNames.join(', ')}</div>
                                  )}
                                  {order.tableIds && order.tableIds.length > 0 && (
                                    <div>Mesas: {order.tableIds.map((id: number) => `#${id}`).join(', ')}</div>
                                  )}
                                </div>
                              </div>
                            ) : order.customerName ? (
                              <div>
                                <div className="font-medium text-gray-800">{order.customerName}</div>
                                {order.customerPhone && (
                                  <div className="text-xs text-gray-500">{order.customerPhone}</div>
                                )}
                              </div>
                            ) : order.tableId ? (
                              <span className="text-gray-600">Mesa #{order.tableId}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {order.itemsCount} {order.itemsCount === 1 ? 'item' : 'items'}
                            {order.orders && order.orders.length > 1 && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                ({order.orders.length} pedido{order.orders.length > 1 ? 's' : ''})
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              order.paymentMethod?.toLowerCase() === 'cash' ? 'bg-green-100 text-green-700' :
                              order.paymentMethod?.toLowerCase() === 'pos' ? 'bg-blue-100 text-blue-700' :
                              order.paymentMethod?.toLowerCase() === 'transfer' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {order.paymentMethod === 'cash' ? 'Efectivo' :
                               order.paymentMethod === 'pos' ? 'POS' :
                               order.paymentMethod === 'transfer' ? 'Transferencia' :
                               order.paymentMethod || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {order.paymentMethod?.toLowerCase() === 'pos' && (order.posTransactionId || order.posTransactionIdString) ? (
                              <div className="space-y-1">
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">ID:</span> {order.posTransactionId || order.posTransactionIdString}
                                </div>
                                {order.posTransactionDateTime && (
                                  <div className="text-xs text-gray-500">
                                    {(() => {
                                      try {
                                        // Formato: yyyyMMddHHmmssfff
                                        const dt = order.posTransactionDateTime;
                                        if (dt.length >= 14) {
                                          const year = dt.substring(0, 4);
                                          const month = dt.substring(4, 6);
                                          const day = dt.substring(6, 8);
                                          const hour = dt.substring(8, 10);
                                          const minute = dt.substring(10, 12);
                                          const second = dt.substring(12, 14);
                                          return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
                                        }
                                        return dt;
                                      } catch {
                                        return order.posTransactionDateTime;
                                      }
                                    })()}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-gray-800">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {order.paymentMethod?.toLowerCase() === 'pos' && (order.posTransactionId || order.posTransactionIdString) ? (
                              <div className="flex items-center justify-center gap-2">
                                {order.posRefundTransactionId || order.posRefundTransactionIdString ? (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedRefundOrder(order);
                                        setIsRefundTicketModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                                      title="Ver ticket de devolución"
                                    >
                                      <Receipt size={14} />
                                      Ver Ticket
                                    </button>
                                    <span className="text-green-600 text-xs flex items-center gap-1" title="Devolución procesada">
                                      <CheckCircle2 size={14} />
                                    </span>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handlePOSVoid(order)}
                                    className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1.5"
                                    title="Hacer devolución de transacción POS"
                                  >
                                    <RotateCcw size={14} />
                                    Devolver
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No se pudieron cargar los movimientos
          </div>
        )}
      </Modal>

      {/* Modal de Ticket de Devolución */}
      <Modal
        isOpen={isRefundTicketModalOpen}
        onClose={() => {
          setIsRefundTicketModalOpen(false);
          setSelectedRefundOrder(null);
        }}
        title="Ticket de Devolución POS"
        size="lg"
      >
        {selectedRefundOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-800 mb-3">Información del Pedido Original</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Pedido #:</span>
                  <span className="ml-2 font-medium">{selectedRefundOrder.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Monto:</span>
                  <span className="ml-2 font-medium">{formatCurrency(selectedRefundOrder.total)}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha del Pedido:</span>
                  <span className="ml-2 font-medium">
                    {new Date(selectedRefundOrder.createdAt).toLocaleString('es-ES')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Transacción Original:</span>
                  <span className="ml-2 font-medium">
                    {selectedRefundOrder.posTransactionId || selectedRefundOrder.posTransactionIdString || '-'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 space-y-3 border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <CheckCircle2 size={18} />
                Información de la Devolución
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="ml-2 font-medium text-blue-700">
                    {selectedRefundOrder.posRefundTransactionId || selectedRefundOrder.posRefundTransactionIdString || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Fecha de Devolución:</span>
                  <span className="ml-2 font-medium">
                    {selectedRefundOrder.posRefundedAt 
                      ? new Date(selectedRefundOrder.posRefundedAt).toLocaleString('es-ES')
                      : selectedRefundOrder.posRefundTransactionDateTime 
                        ? (() => {
                            try {
                              const dt = selectedRefundOrder.posRefundTransactionDateTime;
                              if (dt.length >= 14) {
                                const year = dt.substring(0, 4);
                                const month = dt.substring(4, 6);
                                const day = dt.substring(6, 8);
                                const hour = dt.substring(8, 10);
                                const minute = dt.substring(10, 12);
                                const second = dt.substring(12, 14);
                                return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
                              }
                              return dt;
                            } catch {
                              return selectedRefundOrder.posRefundTransactionDateTime;
                            }
                          })()
                        : '-'}
                  </span>
                </div>
                {selectedRefundOrder.posRefundTransactionDateTime && (
                  <div className="col-span-2">
                    <span className="text-gray-600">Transaction DateTime:</span>
                    <span className="ml-2 font-mono text-xs">
                      {selectedRefundOrder.posRefundTransactionDateTime}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {selectedRefundOrder.posRefundResponse && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2 text-sm">Respuesta Completa del POS</h3>
                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-40 font-mono">
                  {(() => {
                    try {
                      const response = JSON.parse(selectedRefundOrder.posRefundResponse);
                      return JSON.stringify(response, null, 2);
                    } catch {
                      return selectedRefundOrder.posRefundResponse;
                    }
                  })()}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => {
                  setIsRefundTicketModalOpen(false);
                  setSelectedRefundOrder(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

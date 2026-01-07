import { useState, useEffect } from 'react';
import {
    Banknote,
    Eye,
    CheckCircle2,
    AlertTriangle,
    Calendar,
    User,
    ExternalLink
} from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import Pagination from '../components/Pagination/Pagination';
import type { Order } from '../types';

export default function PaymentVerificationPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const { showToast } = useToast();

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            // Usar getOrders() en lugar de getActiveOrders() para incluir todos los pedidos
            // (incluyendo completados y cancelados) que tengan transferencia
            const ordersResponse = await api.getOrders({ showArchived: false });
            const ordersArray = Array.isArray(ordersResponse)
                ? ordersResponse
                : (ordersResponse as any)?.data || [];

            // Filtrar solo pedidos por transferencia
            // Buscar tanto "transfer" (nombre interno) como "transferencia" (nombre para mostrar)
            const transfers = ordersArray
                .filter((o: Order) => {
                    const method = o.paymentMethod?.toLowerCase() || '';
                    const isTransfer = method.includes('transfer') || method.includes('transferencia');
                    // Debug: mostrar pedido 1035 si existe
                    if (o.id === 1035) {
                        console.log('Pedido 1035 encontrado:', {
                            id: o.id,
                            paymentMethod: o.paymentMethod,
                            methodLower: method,
                            isTransfer,
                            hasReceipt: !!o.transferReceiptImage,
                            isVerified: o.isReceiptVerified
                        });
                    }
                    return isTransfer;
                });

            console.log(`Total pedidos cargados: ${ordersArray.length}, Pedidos con transferencia: ${transfers.length}`);
            setOrders(transfers);
        } catch (error) {
            console.error('Error loading orders:', error);
            showToast('Error al cargar pedidos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyReceipt = async (orderId: number) => {
        try {
            await api.verifyReceipt(orderId, true);
            showToast('Comprobante verificado correctamente', 'success');

            // Actualizar lista localmente
            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, isReceiptVerified: true, receiptVerifiedAt: new Date().toISOString() } : o
            ));

            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, isReceiptVerified: true } : null);
            }
        } catch (error) {
            showToast('Error al verificar comprobante', 'error');
        }
    };

    const handleUnverifyReceipt = async (orderId: number) => {
        try {
            await api.verifyReceipt(orderId, false);
            showToast('Verificación removida', 'info');

            setOrders(prev => prev.map(o =>
                o.id === orderId ? { ...o, isReceiptVerified: false, receiptVerifiedAt: undefined } : o
            ));

            if (selectedOrder?.id === orderId) {
                setSelectedOrder(prev => prev ? { ...prev, isReceiptVerified: false } : null);
            }
        } catch (error) {
            showToast('Error al remover verificación', 'error');
        }
    };

    // Filtrar pendientes primero
    const sortedOrders = [...orders].sort((a, b) => {
        // Pendientes primero
        if (!a.isReceiptVerified && b.isReceiptVerified) return -1;
        if (a.isReceiptVerified && !b.isReceiptVerified) return 1;
        // Luego por fecha más reciente
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const pendingCount = orders.filter(o => !o.isReceiptVerified).length;

    // Pagination
    const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedOrders = sortedOrders.slice(startIndex, startIndex + itemsPerPage);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-UY', {
            style: 'currency',
            currency: 'UYU'
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                        <Banknote size={32} className="text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Verificación de Pagos</h1>
                        <p className="text-gray-500">Gestión de comprobantes de transferencia</p>
                    </div>
                    <div className="ml-auto flex gap-4">
                        <div className="bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-100 text-center">
                            <span className="block text-2xl font-bold text-yellow-600">{pendingCount}</span>
                            <span className="text-xs text-yellow-700 font-medium">Pendientes</span>
                        </div>
                        <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-100 text-center">
                            <span className="block text-2xl font-bold text-green-600">{orders.length - pendingCount}</span>
                            <span className="text-xs text-green-700 font-medium">Verificados</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pedido</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Comprobante</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedOrders.map((order) => {

                                return (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-900">#{order.id}</span>
                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Calendar size={10} />
                                                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900 flex items-center gap-1">
                                                    <User size={14} className="text-gray-400" />
                                                    {order.customerName}
                                                </span>
                                                {order.customerPhone && <span className="text-xs text-gray-500 ml-5">{order.customerPhone}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-bold text-gray-900">{formatCurrency(order.total)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {order.isReceiptVerified ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <CheckCircle2 size={12} />
                                                    Verificado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 animate-pulse">
                                                    <AlertTriangle size={12} />
                                                    Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {order.transferReceiptImage ? (
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="flex items-center gap-2 text-primary-600 hover:text-primary-800 font-medium text-sm"
                                                >
                                                    <Eye size={16} />
                                                    Ver Imagen
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 text-sm italic">Sin imagen</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {!order.isReceiptVerified ? (
                                                <button
                                                    onClick={() => handleVerifyReceipt(order.id)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm hover:shadow"
                                                >
                                                    <CheckCircle2 size={16} />
                                                    Verificar
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleUnverifyReceipt(order.id)}
                                                    className="text-gray-400 hover:text-red-500 text-sm font-medium transition-colors"
                                                    title="Desmarcar verificado"
                                                >
                                                    Deshacer
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {paginatedOrders.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="bg-gray-100 p-4 rounded-full mb-4">
                                                <Banknote size={32} className="text-gray-400" />
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">No se encontraron pagos por transferencia</p>
                                            <p className="text-sm">Los pedidos con pago por transferencia aparecerán aquí.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                            itemsPerPage={10}
                            totalItems={sortedOrders.length}
                            startIndex={startIndex}
                            endIndex={startIndex + paginatedOrders.length}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Imagen */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={`Comprobante - Pedido #${selectedOrder?.id}`}
            >
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-gray-500">Cliente</dt>
                                <dd className="font-medium text-gray-900">{selectedOrder?.customerName}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">Total a Pagar</dt>
                                <dd className="font-bold text-green-600 text-lg">{selectedOrder && formatCurrency(selectedOrder.total)}</dd>
                            </div>
                            {selectedOrder?.isReceiptVerified && (
                                <div className="col-span-2 bg-green-50 p-2 rounded border border-green-100 flex items-center gap-2 text-green-700">
                                    <CheckCircle2 size={16} />
                                    <span className="font-medium">Este comprobante ya fue verificado</span>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div className="relative aspect-[3/4] sm:aspect-video w-full overflow-hidden rounded-lg bg-gray-900 flex items-center justify-center group">
                        {selectedOrder?.transferReceiptImage ? (
                            <img
                                src={selectedOrder.transferReceiptImage.startsWith('data:') 
                                    ? selectedOrder.transferReceiptImage 
                                    : `data:image/jpeg;base64,${selectedOrder.transferReceiptImage}`}
                                alt="Comprobante de transferencia"
                                className="max-w-full max-h-[60vh] object-contain transition-transform group-hover:scale-105"
                            />
                        ) : (
                            <div className="text-white flex flex-col items-center gap-2">
                                <AlertTriangle size={32} />
                                <p>No hay imagen disponible</p>
                            </div>
                        )}

                        {/* Overlay button to open full size */}
                        {selectedOrder?.transferReceiptImage && (
                            <a
                                href={selectedOrder.transferReceiptImage.startsWith('data:') 
                                    ? selectedOrder.transferReceiptImage 
                                    : `data:image/jpeg;base64,${selectedOrder.transferReceiptImage}`}
                                download={`comprobante-pedido-${selectedOrder.id}.jpg`}
                                target="_blank"
                                rel="noreferrer"
                                className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-900 px-4 py-2 rounded-full shadow-lg font-medium text-sm flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
                            >
                                <ExternalLink size={14} />
                                Abrir original
                            </a>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                        <button
                            onClick={() => setSelectedOrder(null)}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            Cerrar
                        </button>
                        {selectedOrder && !selectedOrder.isReceiptVerified && (
                            <button
                                onClick={() => {
                                    handleVerifyReceipt(selectedOrder.id);
                                    setSelectedOrder(null);
                                }}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm hover:shadow flex items-center gap-2"
                            >
                                <CheckCircle2 size={18} />
                                Verificar Comprobante
                            </button>
                        )}
                    </div>
                </div>
            </Modal>
        </div>
    );
}

import { useState, useEffect } from 'react';
import {
    Plus,
    Edit2,
    Trash2,
    Gift,
    Search,
    Loader2,
    Trophy,
    Star,
    Info
} from 'lucide-react';
import { useToast } from '../../components/Toast/ToastContext';
import api from '../../api/client';
import Modal from '../../components/Modal/Modal';
import ConfirmModal from '../../components/Modal/ConfirmModal';
import type { Reward, CreateRewardRequest } from '../../types';

export default function SettingsRewardsPage() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [deleteReward, setDeleteReward] = useState<Reward | null>(null);

    // Form state
    const [formData, setFormData] = useState<CreateRewardRequest>({
        name: '',
        description: '',
        pointsRequired: 10,
        isActive: true,
        discountPercentage: undefined
    });
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        loadRewards();
    }, []);

    const loadRewards = async () => {
        try {
            setLoading(true);
            const data = await api.getAdminRewards();
            setRewards(data);
        } catch (error) {
            showToast('Error al cargar premios', 'error');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingReward(null);
        setFormData({
            name: '',
            description: '',
            pointsRequired: 10,
            isActive: true,
            discountPercentage: undefined
        });
        setIsFormModalOpen(true);
    };

    const openEditModal = (reward: Reward) => {
        setEditingReward(reward);
        setFormData({
            name: reward.name,
            description: reward.description || '',
            pointsRequired: reward.pointsRequired,
            isActive: reward.isActive,
            discountPercentage: reward.discountPercentage
        });
        setIsFormModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            showToast('El nombre es requerido', 'error');
            return;
        }

        try {
            setFormLoading(true);
            if (editingReward) {
                await api.updateReward(editingReward.id, formData);
                showToast('Premio actualizado correctamente');
            } else {
                await api.createReward(formData);
                showToast('Premio creado correctamente');
            }
            setIsFormModalOpen(false);
            loadRewards();
        } catch (error) {
            showToast(editingReward ? 'Error al actualizar premio' : 'Error al crear premio', 'error');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteReward) return;
        try {
            await api.deleteReward(deleteReward.id);
            showToast('Premio eliminado correctamente');
            setDeleteReward(null);
            loadRewards();
        } catch (error) {
            showToast('Error al eliminar premio', 'error');
        }
    };

    const filteredRewards = rewards.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                            <Gift size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Premios y Canjes</h1>
                            <p className="text-gray-500">Administra los beneficios para tus clientes frecuentes</p>
                        </div>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus size={20} />
                        Nuevo Premio
                    </button>
                </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-700">
                <Info size={20} className="shrink-0 mt-0.5" />
                <div className="text-sm">
                    <p className="font-semibold">¿Cómo funciona?</p>
                    <p>Los clientes acumulan puntos por cada pedido completado (configurable en Configuración General). Los premios activos aparecerán automáticamente en la app móvil de los clientes cuando tengan los puntos suficientes.</p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar premios por nombre o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
                    />
                </div>
            </div>

            {/* Rewards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRewards.length === 0 ? (
                    <div className="col-span-full bg-white rounded-xl shadow-sm p-12 text-center border border-dashed border-gray-300">
                        <Trophy size={48} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-500 font-medium">No se encontraron premios</p>
                    </div>
                ) : (
                    filteredRewards.map((reward) => (
                        <div
                            key={reward.id}
                            className={`bg-white rounded-2xl shadow-md overflow-hidden border transition-all hover:shadow-lg ${!reward.isActive ? 'border-gray-200 opacity-75' : 'border-purple-100'
                                }`}
                        >
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-2 rounded-lg ${reward.isActive ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {reward.discountPercentage ? <Star size={24} /> : <Gift size={24} />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${reward.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {reward.isActive ? 'Activo' : 'Pausado'}
                                        </span>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-800 mb-1">{reward.name}</h3>
                                <p className="text-sm text-gray-500 mb-4 min-h-[40px] line-clamp-2">{reward.description || 'Sin descripción'}</p>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs ring-2 ring-white shadow-sm">
                                            P
                                        </div>
                                        <span className="font-bold text-amber-600">{reward.pointsRequired} puntos</span>
                                    </div>

                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => openEditModal(reward)}
                                            className="p-2 hover:bg-purple-50 text-purple-600 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteReward(reward)}
                                            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Form Modal */}
            <Modal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                title={editingReward ? '✏️ Editar Premio' : '🎁 Nuevo Premio'}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Premio *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Ej: Pizza Grande Gratis"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ej: Una pizza clásica a elección por tus puntos."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Puntos Necesarios *</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={formData.pointsRequired}
                                onChange={(e) => setFormData(prev => ({ ...prev, pointsRequired: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descuento % (Opcional)</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={formData.discountPercentage || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, discountPercentage: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                placeholder="Ej: 15"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                        />
                        <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Premio Activo y Disponible</label>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsFormModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={formLoading}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {formLoading && <Loader2 size={18} className="animate-spin" />}
                            {editingReward ? 'Guardar Cambios' : 'Crear Premio'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={!!deleteReward}
                onClose={() => setDeleteReward(null)}
                onConfirm={handleDelete}
                title="Eliminar Premio"
                message={`¿Estás seguro de que deseas eliminar el premio "${deleteReward?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                type="danger"
            />
        </div>
    );
}

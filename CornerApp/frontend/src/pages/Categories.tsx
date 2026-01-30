import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FolderOpen } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import Pagination from '../components/Pagination/Pagination';
import type { Category, CreateCategoryRequest } from '../types';

const iconOptions = ['📦', '🍕', '🍔', '🌭', '🍟', '🥤', '🍺', '🍷', '🍰', '🍦', '🥗', '🥪', '🌮', '🍣', '🍝', '☕'];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateCategoryRequest & { displayOrder?: number; isActive?: boolean }>({
    name: '',
    description: '',
    icon: '📦',
    displayOrder: 0,
    isActive: true,
  });
  const [formLoading, setFormLoading] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getCategories();
      setCategories(data);
    } catch (error) {
      showToast('Error al cargar categorías', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '📦',
      displayOrder: 0,
      isActive: true,
    });
    setIsFormModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '📦',
      displayOrder: category.displayOrder,
      isActive: category.isActive,
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
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { 
          ...formData, 
          id: editingCategory.id 
        });
        showToast('Categoría actualizada correctamente');
      } else {
        await api.createCategory(formData);
        showToast('Categoría creada correctamente');
      }
      setIsFormModalOpen(false);
      // Pequeño delay para asegurar que el servidor haya procesado la creación
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadData();
    } catch (error) {
      showToast(editingCategory ? 'Error al actualizar categoría' : 'Error al crear categoría', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;
    try {
      await api.deleteCategory(deleteCategory.id);
      showToast('Categoría eliminada/desactivada correctamente');
      setDeleteCategory(null);
      loadData();
    } catch (error) {
      showToast('Error al eliminar categoría', 'error');
    }
  };

  // Paginación
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = categories.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">📁 Gestión de Categorías</h1>
            <p className="text-sm text-gray-500">{categories.length} categorías registradas</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            Nueva Categoría
          </button>
        </div>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Orden</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Icono</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Descripción</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Productos</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
                    No hay categorías registradas
                  </td>
                </tr>
              ) : (
                paginatedCategories.map((category) => (
                  <tr 
                    key={category.id} 
                    className={`hover:bg-gray-50 transition-colors ${!category.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-bold text-primary-600">#{category.id}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-primary-500">{category.displayOrder}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-2xl">
                      {category.icon || '📦'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800">{category.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {category.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {category.products?.length || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        category.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {category.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(category)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteCategory(category)}
                          className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={categories.length}
          itemsPerPage={itemsPerPage}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingCategory ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="categoryName" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              id="categoryName"
              name="categoryName"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nombre de la categoría"
              required
            />
          </div>

          <div>
            <label htmlFor="categoryDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              id="categoryDescription"
              name="categoryDescription"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Descripción de la categoría"
              rows={3}
            />
          </div>

          {editingCategory && (
            <div>
              <label htmlFor="categoryDisplayOrder" className="block text-sm font-medium text-gray-700 mb-1">Orden de aparición</label>
              <input
                type="number"
                id="categoryDisplayOrder"
                name="categoryDisplayOrder"
                value={formData.displayOrder}
                onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                min="0"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Icono</label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, icon }))}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-all ${
                    formData.icon === icon 
                      ? 'border-primary-500 bg-primary-50 scale-110' 
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {editingCategory && (
            <div>
              <label htmlFor="categoryIsActive" className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="categoryIsActive"
                  name="categoryIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Categoría activa</span>
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="flex-1 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {formLoading ? 'Guardando...' : (editingCategory ? 'Guardar Cambios' : 'Crear Categoría')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteCategory}
        onClose={() => setDeleteCategory(null)}
        onConfirm={handleDelete}
        title="Eliminar Categoría"
        message={
          deleteCategory?.products?.length 
            ? `La categoría "${deleteCategory?.name}" tiene ${deleteCategory?.products?.length} productos. Se desactivará en lugar de eliminarse.`
            : `¿Estás seguro de eliminar "${deleteCategory?.name}"? Esta acción no se puede deshacer.`
        }
        confirmText={deleteCategory?.products?.length ? "Desactivar" : "Eliminar"}
        type="danger"
      />
    </div>
  );
}


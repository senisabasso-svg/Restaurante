import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Package, List, X } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast/ToastContext';
import Modal from '../components/Modal/Modal';
import ConfirmModal from '../components/Modal/ConfirmModal';
import Pagination from '../components/Pagination/Pagination';
import HelpIcon from '../components/HelpIcon/HelpIcon';
import type { Product, Category, CreateProductRequest, SubProduct, CreateSubProductRequest } from '../types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  
  // SubProducts modal states
  const [isSubProductsModalOpen, setIsSubProductsModalOpen] = useState(false);
  const [productForSubProducts, setProductForSubProducts] = useState<Product | null>(null);
  const [subProducts, setSubProducts] = useState<SubProduct[]>([]);
  const [isSubProductFormModalOpen, setIsSubProductFormModalOpen] = useState(false);
  const [editingSubProduct, setEditingSubProduct] = useState<SubProduct | null>(null);
  const [deleteSubProduct, setDeleteSubProduct] = useState<SubProduct | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateProductRequest>({
    name: '',
    description: '',
    price: 0,
    image: '',
    categoryId: 0,
    displayOrder: 0,
    isAvailable: true,
    isRecommended: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // SubProduct form state
  const [subProductFormData, setSubProductFormData] = useState<CreateSubProductRequest>({
    name: '',
    description: '',
    price: 0,
    productId: 0,
    displayOrder: 0,
    isAvailable: true,
  });
  const [subProductFormLoading, setSubProductFormLoading] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      // Agregar timestamp para evitar caché del navegador cuando se fuerza recarga
      const timestamp = forceRefresh ? `?t=${Date.now()}` : '';
      const [productsData, categoriesData] = await Promise.all([
        api.getProducts(),
        api.getCategories(timestamp),
      ]);
      
      // Cargar subproductos para cada producto
      const productsWithSubProducts = await Promise.all(
        productsData.map(async (product) => {
          try {
            const subProducts = await api.getSubProductsByProduct(product.id);
            return { ...product, subProducts };
          } catch (error) {
            return { ...product, subProducts: [] };
          }
        })
      );
      
      setProducts(productsWithSubProducts);
      setCategories(categoriesData);
    } catch (error) {
      showToast('Error al cargar productos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = async () => {
    setEditingProduct(null);
    // Recargar categorías antes de abrir el modal para asegurar que tenemos las más recientes
    let freshCategories = categories;
    try {
      freshCategories = await api.getCategories(`?t=${Date.now()}`);
      setCategories(freshCategories);
    } catch (error) {
      console.error('Error al recargar categorías:', error);
    }
    setFormData({
      name: '',
      description: '',
      price: 0,
      image: '',
      categoryId: freshCategories[0]?.id || 0,
      displayOrder: 0,
      isAvailable: true,
      isRecommended: false,
    });
    setImageFile(null);
    setImagePreview(null);
    setIsFormModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      image: product.image || '',
      categoryId: product.categoryId,
      displayOrder: product.displayOrder,
      isAvailable: product.isAvailable,
      isRecommended: product.isRecommended || false,
    });
    setImageFile(null);
    setImagePreview(product.image || null);
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (formData.price <= 0) {
      showToast('El precio debe ser mayor a 0', 'error');
      return;
    }
    if (!formData.categoryId) {
      showToast('Debes seleccionar una categoría', 'error');
      return;
    }

    try {
      setFormLoading(true);
      
      // Si hay una imagen nueva para subir, subirla primero
      let imageUrl = formData.image;
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const uploadResult = await api.uploadProductImage(imageFile);
          imageUrl = uploadResult.url;
          showToast('Imagen subida exitosamente', 'success');
        } catch (uploadError: any) {
          showToast(uploadError.message || 'Error al subir imagen', 'error');
          setIsUploadingImage(false);
          return;
        } finally {
          setIsUploadingImage(false);
        }
      }
      
      const productData = { ...formData, image: imageUrl };
      
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, { ...productData, id: editingProduct.id });
        showToast('Producto actualizado correctamente', 'success');
      } else {
        const newProduct = await api.createProduct(productData);
        showToast('Producto creado correctamente', 'success');
        // Resetear filtros para mostrar el nuevo producto
        setSearchTerm('');
        setCategoryFilter('');
        setCurrentPage(1);
      }
      setIsFormModalOpen(false);
      setImageFile(null);
      setImagePreview(null);
      // Recargar datos después de un pequeño delay para asegurar que el backend haya guardado
      await new Promise(resolve => setTimeout(resolve, 300));
      await loadData();
    } catch (error: any) {
      const errorMessage = error?.message || (editingProduct ? 'Error al actualizar producto' : 'Error al crear producto');
      showToast(errorMessage, 'error');
      console.error('Error al guardar producto:', error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProduct) return;
    try {
      await api.deleteProduct(deleteProduct.id);
      showToast('Producto eliminado correctamente');
      setDeleteProduct(null);
      loadData();
    } catch (error) {
      showToast('Error al eliminar producto', 'error');
    }
  };


  // SubProducts management
  const openSubProductsModal = async (product: Product) => {
    setProductForSubProducts(product);
    setIsSubProductsModalOpen(true);
    await loadSubProducts(product.id);
  };

  const loadSubProducts = async (productId: number) => {
    try {
      const subProductsData = await api.getSubProductsByProduct(productId);
      setSubProducts(subProductsData);
    } catch (error) {
      showToast('Error al cargar subproductos', 'error');
    }
  };

  const openCreateSubProductModal = (product: Product) => {
    setEditingSubProduct(null);
    setSubProductFormData({
      name: '',
      description: '',
      price: 0,
      productId: product.id,
      displayOrder: 0,
      isAvailable: true,
    });
    setIsSubProductFormModalOpen(true);
  };

  const openEditSubProductModal = (subProduct: SubProduct) => {
    setEditingSubProduct(subProduct);
    setSubProductFormData({
      name: subProduct.name,
      description: subProduct.description || '',
      price: subProduct.price,
      productId: subProduct.productId,
      displayOrder: subProduct.displayOrder,
      isAvailable: subProduct.isAvailable,
    });
    setIsSubProductFormModalOpen(true);
  };

  const handleSubProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subProductFormData.name.trim()) {
      showToast('El nombre es requerido', 'error');
      return;
    }
    if (subProductFormData.price < 0) {
      showToast('El precio no puede ser negativo', 'error');
      return;
    }
    if (!subProductFormData.productId) {
      showToast('Debes asociar el subproducto a un producto', 'error');
      return;
    }

    try {
      setSubProductFormLoading(true);
      if (editingSubProduct) {
        await api.updateSubProduct(editingSubProduct.id, subProductFormData);
        showToast('Subproducto actualizado correctamente', 'success');
      } else {
        await api.createSubProduct(subProductFormData);
        showToast('Subproducto creado correctamente', 'success');
      }
      setIsSubProductFormModalOpen(false);
      if (productForSubProducts) {
        await loadSubProducts(productForSubProducts.id);
      }
    } catch (error: any) {
      const errorMessage = error?.message || (editingSubProduct ? 'Error al actualizar subproducto' : 'Error al crear subproducto');
      showToast(errorMessage, 'error');
    } finally {
      setSubProductFormLoading(false);
    }
  };

  const handleDeleteSubProduct = async () => {
    if (!deleteSubProduct) return;
    try {
      await api.deleteSubProduct(deleteSubProduct.id);
      showToast('Subproducto eliminado correctamente');
      setDeleteSubProduct(null);
      if (productForSubProducts) {
        await loadSubProducts(productForSubProducts.id);
      }
    } catch (error) {
      showToast('Error al eliminar subproducto', 'error');
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Resetear página cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-800">🛒 Gestión de Productos</h1>
              <HelpIcon
                title="Manual de Productos"
                content={
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">📦 Gestión de Productos</h3>
                      <p className="mb-2">En esta sección puedes crear, editar y gestionar los productos de tu menú.</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">➕ Crear Producto</h4>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Haz clic en el botón "Nuevo Producto".</li>
                        <li>Completa los campos:
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li><strong>Nombre:</strong> Nombre del producto (ej: "Hamburguesa Clásica").</li>
                            <li><strong>Descripción:</strong> Descripción detallada del producto (opcional).</li>
                            <li><strong>Precio:</strong> Precio base del producto.</li>
                            <li><strong>Categoría:</strong> Selecciona la categoría a la que pertenece.</li>
                            <li><strong>Imagen:</strong> URL de la imagen del producto (opcional).</li>
                            <li><strong>Orden de Visualización:</strong> Número que determina el orden en el menú (menor = primero).</li>
                            <li><strong>Disponible:</strong> Marca si el producto está disponible para la venta.</li>
                          </ul>
                        </li>
                        <li>Guarda el producto.</li>
                      </ol>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">✏️ Editar Producto</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Haz clic en el ícono de editar (lápiz) junto al producto.</li>
                        <li>Modifica los campos que necesites.</li>
                        <li>Guarda los cambios.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">🗑️ Eliminar Producto</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Haz clic en el ícono de eliminar (papelera) junto al producto.</li>
                        <li>Confirma la eliminación.</li>
                        <li><strong>Nota:</strong> No podrás eliminar productos que tengan pedidos asociados.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">🍽️ Subproductos (Guarniciones)</h4>
                      <p className="text-sm mb-2">Los subproductos son opciones adicionales para un producto (ej: tamaños, extras, guarniciones).</p>
                      <ol className="list-decimal list-inside space-y-1 text-sm">
                        <li>Haz clic en el botón "Guarniciones" junto al producto.</li>
                        <li>En el modal, haz clic en "Nueva Guarnición".</li>
                        <li>Completa:
                          <ul className="list-disc list-inside ml-4 mt-1">
                            <li><strong>Nombre:</strong> Nombre del subproducto (ej: "Papas Fritas", "Bebida Grande").</li>
                            <li><strong>Precio:</strong> Precio adicional del subproducto (puede ser 0).</li>
                            <li><strong>Descripción:</strong> Descripción opcional.</li>
                            <li><strong>Orden:</strong> Orden de visualización.</li>
                            <li><strong>Disponible:</strong> Si está disponible o no.</li>
                          </ul>
                        </li>
                        <li>Guarda el subproducto.</li>
                      </ol>
                      <p className="text-sm mt-2"><strong>Ejemplo:</strong> Para una hamburguesa, puedes crear subproductos como "Papas Fritas", "Aros de Cebolla", "Bebida Grande", etc.</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">🔍 Buscar y Filtrar</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><strong>Buscar:</strong> Usa el campo de búsqueda para encontrar productos por nombre.</li>
                        <li><strong>Filtrar por Categoría:</strong> Selecciona una categoría para ver solo productos de esa categoría.</li>
                        <li><strong>Paginación:</strong> Si tienes muchos productos, usa los controles de paginación para navegar.</li>
                      </ul>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> Organiza tus productos por categorías para facilitar la búsqueda. Los subproductos permiten ofrecer opciones personalizables sin crear múltiples productos.
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
            <p className="text-sm text-gray-500">{products.length} productos registrados</p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={20} />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              id="searchProducts"
              name="searchProducts"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <select
            id="categoryFilter"
            name="categoryFilter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value ? Number(e.target.value) : '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Todas las categorías</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-primary-500 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Orden</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Imagen</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Categoría</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Precio</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Guarniciones</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Estado</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <Package size={48} className="mx-auto mb-4 text-gray-300" />
                    No hay productos para mostrar
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-primary-600">#{product.id}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-primary-500">{product.displayOrder}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">{product.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {product.category?.icon} {product.category?.name || 'Sin categoría'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-bold text-green-600">${product.price.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openSubProductsModal(product)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                        title="Gestionar guarniciones"
                      >
                        <List size={14} />
                        {product.subProducts?.length || 0}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        product.isAvailable 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {product.isAvailable ? 'Disponible' : 'No disponible'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteProduct(product)}
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
          totalItems={filteredProducts.length}
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
        title={editingProduct ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              id="productName"
              name="productName"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nombre del producto"
              required
            />
          </div>

          <div>
            <label htmlFor="productDescription" className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              id="productDescription"
              name="productDescription"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Descripción del producto"
              rows={3}
            />
          </div>

          <div>
            <label htmlFor="productPrice" className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
            <input
              type="number"
              id="productPrice"
              name="productPrice"
              value={formData.price}
              onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
            />
          </div>

          <div>
            <label htmlFor="productCategory" className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
            <select
              id="productCategory"
              name="productCategory"
              value={formData.categoryId}
              onChange={(e) => setFormData(prev => ({ ...prev, categoryId: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">Seleccionar categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Image Upload */}
          <div>
            <label htmlFor="productImage" className="block text-sm font-medium text-gray-700 mb-1">Imagen del Producto</label>
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Vista previa"
                  className="w-full h-48 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setFormData(prev => ({ ...prev, image: '' }));
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  title="Eliminar imagen"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                <input
                  type="file"
                  id="productImage"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImageFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <label
                  htmlFor="productImage"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Package size={32} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Haz clic para subir imagen
                  </span>
                  <span className="text-xs text-gray-500">
                    JPG, PNG o GIF (máx. 5MB)
                  </span>
                </label>
              </div>
            )}
            {formData.image && !imagePreview && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">URL actual: {formData.image}</p>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                  className="text-xs text-red-600 hover:text-red-800 mt-1"
                >
                  Limpiar URL
                </button>
              </div>
            )}
          </div>

          {/* URL alternativa para imagen */}
          {!imageFile && !imagePreview && (
            <div>
              <label htmlFor="productImageUrl" className="block text-sm font-medium text-gray-700 mb-1">URL de Imagen (alternativa)</label>
              <input
                type="text"
                id="productImageUrl"
                name="productImageUrl"
                value={formData.image}
                onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>
          )}

          <div>
            <label htmlFor="productIsRecommended" className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="productIsRecommended"
                name="productIsRecommended"
                checked={formData.isRecommended || false}
                onChange={(e) => setFormData(prev => ({ ...prev, isRecommended: e.target.checked }))}
                className="w-4 h-4 accent-yellow-500"
              />
              <span className="text-sm font-medium text-gray-700">⭐ Producto Recomendado</span>
            </label>
          </div>

          <div>
            <label htmlFor="productIsAvailable" className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="productIsAvailable"
                name="productIsAvailable"
                checked={formData.isAvailable}
                onChange={(e) => setFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                className="w-4 h-4 accent-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Producto disponible</span>
            </label>
          </div>

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
              {formLoading ? 'Guardando...' : (editingProduct ? 'Guardar Cambios' : 'Crear Producto')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={handleDelete}
        title="Eliminar Producto"
        message={`¿Estás seguro de eliminar "${deleteProduct?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />

      {/* SubProducts Management Modal */}
      <Modal
        isOpen={isSubProductsModalOpen}
        onClose={() => {
          setIsSubProductsModalOpen(false);
          setProductForSubProducts(null);
          setSubProducts([]);
        }}
        title={`Guarniciones - ${productForSubProducts?.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Gestiona las guarniciones asociadas a este producto
            </p>
            <button
              onClick={() => productForSubProducts && openCreateSubProductModal(productForSubProducts)}
              className="flex items-center gap-2 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Nueva Guarnición
            </button>
          </div>

          {subProducts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <List size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No hay guarniciones para este producto</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y max-h-96 overflow-y-auto">
              {subProducts.map((subProduct) => (
                <div key={subProduct.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{subProduct.name}</div>
                    {subProduct.description && (
                      <div className="text-sm text-gray-500 mt-1">{subProduct.description}</div>
                    )}
                    <div className="text-sm text-primary-600 mt-1 font-medium">
                      +${subProduct.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      subProduct.isAvailable 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {subProduct.isAvailable ? 'Disponible' : 'No disponible'}
                    </span>
                    <button
                      onClick={() => openEditSubProductModal(subProduct)}
                      className="p-2 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteSubProduct(subProduct)}
                      className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Create/Edit SubProduct Modal */}
      <Modal
        isOpen={isSubProductFormModalOpen}
        onClose={() => setIsSubProductFormModalOpen(false)}
        title={editingSubProduct ? '✏️ Editar Guarnición' : '➕ Nueva Guarnición'}
        size="md"
      >
        <form onSubmit={handleSubProductSubmit} className="space-y-4">
          <div>
            <label htmlFor="subProductName" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre *
            </label>
            <input
              type="text"
              id="subProductName"
              value={subProductFormData.name}
              onChange={(e) => setSubProductFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Nombre de la guarnición"
              required
            />
          </div>

          <div>
            <label htmlFor="subProductDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Descripción
            </label>
            <textarea
              id="subProductDescription"
              value={subProductFormData.description || ''}
              onChange={(e) => setSubProductFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="Descripción de la guarnición"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="subProductPrice" className="block text-sm font-medium text-gray-700 mb-1">
                Precio Adicional *
              </label>
              <input
                type="number"
                id="subProductPrice"
                value={subProductFormData.price}
                onChange={(e) => setSubProductFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label htmlFor="subProductDisplayOrder" className="block text-sm font-medium text-gray-700 mb-1">
                Orden
              </label>
              <input
                type="number"
                id="subProductDisplayOrder"
                value={subProductFormData.displayOrder}
                onChange={(e) => setSubProductFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div>
            <label htmlFor="subProductIsAvailable" className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="subProductIsAvailable"
                checked={subProductFormData.isAvailable}
                onChange={(e) => setSubProductFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                className="w-4 h-4 accent-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Guarnición disponible</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsSubProductFormModalOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={subProductFormLoading || !subProductFormData.productId}
              className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subProductFormLoading ? 'Guardando...' : (editingSubProduct ? 'Guardar Cambios' : 'Crear Guarnición')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete SubProduct Confirmation */}
      <ConfirmModal
        isOpen={!!deleteSubProduct}
        onClose={() => setDeleteSubProduct(null)}
        onConfirm={handleDeleteSubProduct}
        title="Eliminar Guarnición"
        message={`¿Estás seguro de eliminar "${deleteSubProduct?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        type="danger"
      />
    </div>
  );
}


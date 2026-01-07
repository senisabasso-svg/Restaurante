import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Animated, RefreshControl, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { addToCart } from '../redux/slices/cartSlice';
import { getProducts, getCategories } from '../services/api';
import ProductCard from '../components/product/ProductCard';

const MenuScreen = ({ showToast }) => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const cartItems = useSelector(state => state.cart.items);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [imageRefreshKey, setImageRefreshKey] = useState(Date.now());
  
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    loadData();
  }, []);

  // Recargar datos cuando la pantalla recibe foco
  useFocusEffect(
    React.useCallback(() => {
      loadData(true); // true = carga silenciosa (sin mostrar loading)
    }, [])
  );

  const loadData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      // Simular delay de carga solo si no es silencioso
      if (!silent) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Cargar categorías y productos en paralelo
      const [categoriesResponse, productsResponse] = await Promise.all([
        getCategories(),
        getProducts()
      ]);
      
      setCategories(categoriesResponse.data);
      setProducts(productsResponse.data);
      // Actualizar refreshKey para forzar recarga de imágenes
      setImageRefreshKey(Date.now());
      console.log('✅ Categorías cargadas:', categoriesResponse.data.length);
      console.log('✅ Productos cargados:', productsResponse.data.length);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  const handleAddToCart = (product) => {
    dispatch(addToCart(product));
    if (showToast) {
      showToast(`${product.name} agregado al carrito`, 'success');
    }
  };

  // Función para verificar si el icono es una URL
  const isIconUrl = (icon) => {
    if (!icon) return false;
    return icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('/');
  };

  // Función para obtener la URL absoluta del icono
  const getIconUrl = (icon) => {
    if (!icon) return null;
    // Si ya es una URL absoluta, devolverla tal cual
    if (icon.startsWith('http://') || icon.startsWith('https://')) {
      return icon;
    }
    // Si es una URL relativa, convertirla a absoluta
    // Usar la misma IP que api.js (se puede mejorar para detectar automáticamente)
    const API_BASE_URL = __DEV__ 
      ? 'http://192.168.1.7:5000' // Cambia esta IP por la de tu servidor local
      : 'https://tu-backend.com';
    const relativePath = icon.startsWith('/') ? icon : `/${icon}`;
    return `${API_BASE_URL}${relativePath}`;
  };

  // Función para obtener el nombre del icono de Ionicons
  const getIconName = (icon) => {
    if (!icon) return 'restaurant';
    // Si es una URL, no es un nombre de icono
    if (isIconUrl(icon)) return null;
    // Si es un emoji, mapear a icono
    if (icon.length === 1 || icon.match(/[\u{1F300}-\u{1F9FF}]/u)) {
      // Mapear algunos emojis comunes a iconos
      const emojiMap = {
        '🍕': 'pizza',
        '🥤': 'water',
        '🍰': 'ice-cream',
        '🥗': 'leaf',
        '🍔': 'fast-food',
        '🌮': 'restaurant',
      };
      return emojiMap[icon] || 'restaurant';
    }
    // Si es un nombre de icono, usarlo directamente
    return icon;
  };

  // Crear lista de categorías sin "Todos"
  const categoriesList = (categories || [])
    .filter(cat => cat.isActive !== false) // Solo categorías activas
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)) // Ordenar por DisplayOrder
    .map(cat => ({
      id: cat.name.toLowerCase(),
      name: cat.name.toLowerCase(),
      displayName: cat.name.charAt(0).toUpperCase() + cat.name.slice(1),
      icon: cat.icon, // Guardar el icono original (puede ser URL, emoji o nombre)
      iconName: getIconName(cat.icon), // Nombre de Ionicons si aplica
      iconUrl: isIconUrl(cat.icon) ? getIconUrl(cat.icon) : null, // URL si es imagen
      originalCategory: cat
    }));

  // Si no hay categoría seleccionada y hay categorías, seleccionar la primera automáticamente
  useEffect(() => {
    if (selectedCategory === null && categoriesList && categoriesList.length > 0) {
      setSelectedCategory(categoriesList[0].id);
    }
  }, [categoriesList.length, selectedCategory]);

  // Normalizar estructura de datos del backend (Category object) a formato esperado
  const normalizedProducts = products.map(p => ({
    ...p,
    category: p.category || (p.Category?.name || p.categoryName || '') // Soporta ambos formatos
  }));

  const filteredProducts = selectedCategory === null || selectedCategory === 'all'
    ? normalizedProducts 
    : normalizedProducts.filter(p => p.category?.toLowerCase() === selectedCategory);

  // Agrupar productos dinámicamente por categorías reales
  const groupedProducts = categories.reduce((acc, cat) => {
    if (cat.isActive !== false) {
      const categoryName = cat.name.toLowerCase();
      acc[categoryName] = filteredProducts.filter(p => p.category?.toLowerCase() === categoryName);
    }
    return acc;
  }, {});

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando menú...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    header: { backgroundColor: colors.background },
    headerTitle: { color: colors.text },
    cartButton: { backgroundColor: colors.primary },
    categoryFilter: { backgroundColor: colors.background },
    categoryButton: (active) => ({ 
      backgroundColor: active ? colors.primary : colors.cardBackground,
    }),
    categoryButtonText: (active) => ({ color: active ? '#ffffff' : colors.cardText || colors.text }),
    scrollView: { backgroundColor: colors.background },
    content: { backgroundColor: colors.background },
    categoryTitle: { color: colors.text },
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <View style={[styles.header, dynamicStyles.header]}>
        <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Nuestro Menú</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('Cart')}
          style={[styles.cartButton, dynamicStyles.cartButton]}
        >
          <Ionicons name="cart" size={20} color="#ffffff" />
          {cartItemCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartItemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={[styles.categoryFilter, dynamicStyles.categoryFilter]}
        contentContainerStyle={styles.categoryFilterContent}
        scrollEnabled={true}
        bounces={false}
      >
        {categoriesList.map((category) => {
          const isSelected = selectedCategory === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              style={[styles.categoryButton, dynamicStyles.categoryButton(isSelected)]}
            >
              {category.iconUrl ? (
                <View style={{ 
                  width: 20, 
                  height: 20, 
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 6,
                  borderRadius: 10,
                  backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  padding: isSelected ? 1 : 0
                }}>
                  <Image 
                    source={{ uri: category.iconUrl }} 
                    style={{ 
                      width: isSelected ? 16 : 18, 
                      height: isSelected ? 16 : 18,
                      opacity: isSelected ? 1 : 0.7
                    }}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <Ionicons 
                  name={category.iconName || 'restaurant'} 
                  size={18} 
                  color={isSelected ? '#ffffff' : (colors.cardText || colors.text)} 
                />
              )}
              <Text style={[styles.categoryButtonText, dynamicStyles.categoryButtonText(isSelected)]}>
                {category.displayName || category.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView 
        style={[styles.scrollView, dynamicStyles.scrollView]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressViewOffset={0}
            enabled={true}
          />
        }
      >
        <View style={[styles.content, dynamicStyles.content]}>
          {selectedCategory === null || selectedCategory === 'all' ? (
            <>
              {categories
                .filter(cat => cat.isActive !== false)
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map((cat, catIndex, filteredCategories) => {
                  const categoryName = cat.name.toLowerCase();
                  const categoryProducts = groupedProducts[categoryName] || [];
                  if (categoryProducts.length === 0) return null;
                  
                  // Calcular delay acumulado
                  let delayOffset = 0;
                  for (let i = 0; i < catIndex; i++) {
                    const prevCatName = filteredCategories[i].name.toLowerCase();
                    delayOffset += (groupedProducts[prevCatName] || []).length;
                  }
                  
                  const catIconUrl = isIconUrl(cat.icon) ? getIconUrl(cat.icon) : null;
                  const catIconName = getIconName(cat.icon);
                  
                  return (
                    <View key={cat.id || cat.name} style={styles.category}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        {catIconUrl ? (
                          <Image 
                            source={{ uri: catIconUrl }} 
                            style={{ width: 20, height: 20, marginRight: 8 }}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons 
                            name={catIconName || 'restaurant'} 
                            size={20} 
                            color={colors.primary}
                            style={{ marginRight: 8 }}
                          />
                        )}
                        <Text style={[styles.categoryTitle, dynamicStyles.categoryTitle]}>
                          {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                        </Text>
                      </View>
                      {categoryProducts.map((product, index) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAddToCart={handleAddToCart}
                          delay={(delayOffset + index) * 100}
                          imageRefreshKey={imageRefreshKey}
                        />
                      ))}
                    </View>
                  );
                })}
            </>
          ) : (
            <View style={styles.category}>
              {filteredProducts.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  delay={index * 100}
                  imageRefreshKey={imageRefreshKey}
                />
              ))}
              {filteredProducts.length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No hay productos en esta categoría
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  cartButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryFilter: {
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  category: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
});

export default MenuScreen;
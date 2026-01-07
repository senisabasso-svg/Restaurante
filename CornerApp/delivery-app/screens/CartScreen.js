import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { removeFromCart, updateQuantity } from '../redux/slices/cartSlice';
import CartItem from '../components/cart/CartItem';

const CartScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const cartItems = useSelector(state => state.cart.items);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Calcular total (productos gratis tienen price = 0)
  const total = cartItems.reduce((sum, item) => {
    const itemPrice = item.isFreeReward ? 0 : (item.price || 0);
    return sum + (itemPrice * item.quantity);
  }, 0);

  const handleRemove = (productId) => {
    dispatch(removeFromCart(productId));
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    dispatch(updateQuantity({ id: productId, quantity: newQuantity }));
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    emptyContainer: { backgroundColor: colors.background },
    emptyIcon: { color: colors.textSecondary },
    emptyTitle: { color: colors.text },
    emptyText: { color: colors.textSecondary },
    emptyButton: { backgroundColor: colors.primary },
    scrollView: { backgroundColor: colors.background },
    header: { backgroundColor: colors.background },
    title: { color: colors.text },
    footer: { 
      backgroundColor: colors.cardBackground,
      borderTopColor: colors.border,
    },
    totalLabel: { color: colors.cardText || '#000000' },
    totalAmount: { color: colors.cardText || '#000000' },
    checkoutButton: { backgroundColor: colors.primary },
  };

  if (cartItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Ionicons name="cart-outline" size={80} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>Tu carrito está vacío</Text>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
            Agrega productos desde el menú para comenzar tu pedido
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Menu')}
            style={[styles.emptyButton, dynamicStyles.emptyButton]}
            activeOpacity={0.8}
          >
            <Ionicons name="restaurant" size={20} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Ver Menú</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <ScrollView style={styles.scrollView}>
        <Animated.View style={[styles.header, dynamicStyles.header, { opacity: fadeAnim }]}>
          <Text style={[styles.title, dynamicStyles.title]}>Tu Carrito</Text>
        </Animated.View>
        
        {cartItems.map((item, index) => (
          <CartItem
            key={item.id}
            item={item}
            onRemove={handleRemove}
            onUpdateQuantity={handleUpdateQuantity}
            delay={index * 100}
          />
        ))}
      </ScrollView>

      <View style={[styles.footer, dynamicStyles.footer]}>
        <View style={styles.totalContainer}>
          <Text style={[styles.totalLabel, dynamicStyles.totalLabel]}>Total:</Text>
          <Text style={[styles.totalAmount, dynamicStyles.totalAmount]}>${total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Checkout')}
          style={[styles.checkoutButton, dynamicStyles.checkoutButton]}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          <Text style={styles.checkoutButtonText}>Confirmar Pedido</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  footer: {
    borderTopWidth: 1,
    padding: 24,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CartScreen;
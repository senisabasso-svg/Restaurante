import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { getOrder } from '../services/api';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const [lastOrderId, setLastOrderId] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Cargar último pedido cuando la pantalla está enfocada
      const loadLastOrder = async () => {
        try {
          const savedOrderId = await AsyncStorage.getItem('lastOrderId');
          if (savedOrderId) {
            // Verificar que el pedido existe antes de mostrarlo
            try {
              const orderId = parseInt(savedOrderId);
              await getOrder(orderId);
              // Si el pedido existe, mostrarlo
              setLastOrderId(savedOrderId);
            } catch (error) {
              // Si el pedido no existe (404), limpiar de AsyncStorage
              if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('no encontrado')) {
                console.log('ℹ️ Pedido eliminado, limpiando de AsyncStorage...');
                await AsyncStorage.removeItem('lastOrderId');
                setLastOrderId(null);
              } else {
                // Si es otro error, mostrar el botón de todas formas
                setLastOrderId(savedOrderId);
              }
            }
          } else {
            setLastOrderId(null);
          }
        } catch (error) {
          console.error('Error loading last order:', error);
          setLastOrderId(null);
        }
      };
      loadLastOrder();
    }, [])
  );

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    title: { color: colors.primary },
    subtitle: { color: colors.textSecondary },
    button: { backgroundColor: colors.primary },
    themeButton: { backgroundColor: colors.cardBackground },
  };

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TouchableOpacity
          onPress={() => navigation.navigate('Menu')}
          style={[styles.button, dynamicStyles.button]}
          activeOpacity={0.8}
        >
          <Ionicons name="restaurant" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>Ver Menú</Text>
        </TouchableOpacity>

        {lastOrderId && (
          <TouchableOpacity
            onPress={() => navigation.navigate('OrderTracking', { orderId: parseInt(lastOrderId) })}
            style={[styles.trackingButton, { backgroundColor: colors.cardBackground, borderColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons name="location" size={20} color="#000000" />
            <Text style={[styles.trackingButtonText, { color: '#000000' }]}>Ver Mi Último Pedido</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 20,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 2,
    gap: 8,
  },
  trackingButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;
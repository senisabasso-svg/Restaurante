import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { clearCart } from '../redux/slices/cartSlice';
import { checkAuth } from '../redux/slices/authSlice';
import analytics from '../services/analytics';
import { createOrder, getBusinessStatus, getPaymentMethods } from '../services/api';
import { PAYMENT_METHODS } from '../constants/app';

const CheckoutScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { colors } = useTheme();
  const cartItems = useSelector(state => state.cart.items);
  const cartComments = useSelector(state => state.cart.comments || '');
  const { user } = useSelector(state => state.auth);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    paymentMethod: PAYMENT_METHODS.CASH,
  });
  const [errors, setErrors] = useState({});
  const [receiptImage, setReceiptImage] = useState(null);
  const [activeReward, setActiveReward] = useState(null);
  const [businessStatus, setBusinessStatus] = useState({ isOpen: true, isWithinHours: true });
  const [timeUntilOpen, setTimeUntilOpen] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethodsData, setPaymentMethodsData] = useState([]);

  useEffect(() => {
    analytics.trackScreenView('Checkout');
    loadFormData();
    loadActiveReward();
    loadBusinessStatus();
    loadPaymentMethods();
    // Solicitar permisos de ubicación al entrar a la pantalla de checkout
    requestLocationPermissionOnMount();
    
    // Verificar horario cada minuto
    const interval = setInterval(() => {
      loadBusinessStatus();
    }, 60000); // Cada minuto
    
    return () => clearInterval(interval);
  }, []);

  const requestLocationPermissionOnMount = async () => {
    try {
      // Verificar estado actual de permisos
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      console.log('📍 Estado de permisos de ubicación:', existingStatus);
      
      if (existingStatus !== 'granted') {
        console.log('📍 Solicitando permisos de ubicación...');
        // Solicitar permisos de forma explícita
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ Permiso de ubicación concedido en CheckoutScreen');
        } else {
          console.log('⚠️ Permiso de ubicación denegado en CheckoutScreen');
          // No mostrar alerta aquí, solo cuando se intente crear el pedido
        }
      } else {
        console.log('✅ Permiso de ubicación ya otorgado');
      }
    } catch (error) {
      console.error('Error solicitando permisos de ubicación:', error);
    }
  };

  const loadBusinessStatus = async () => {
    try {
      const status = await getBusinessStatus();
      setBusinessStatus(status);
      
      // Calcular tiempo hasta apertura si está cerrado
      if (status.timeUntilNextChange) {
        const minutes = Math.floor(status.timeUntilNextChange);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        setTimeUntilOpen({ hours, minutes: mins });
      } else {
        setTimeUntilOpen(null);
      }
    } catch (error) {
      console.error('Error loading business status:', error);
      // Si falla, asumir que está abierto
      setBusinessStatus({ isOpen: true, isWithinHours: true });
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const methods = await getPaymentMethods();
      setPaymentMethodsData(methods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadActiveReward = async () => {
    try {
      const rewardData = await AsyncStorage.getItem('activeReward');
      if (rewardData) {
        const reward = JSON.parse(rewardData);
        // Verificar que la recompensa no sea muy antigua (máximo 7 días)
        const redeemedAt = new Date(reward.redeemedAt);
        const daysSinceRedeem = (new Date() - redeemedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceRedeem <= 7) {
          setActiveReward(reward);
        } else {
          // Recompensa expirada, eliminarla
          await AsyncStorage.removeItem('activeReward');
        }
      }
    } catch (error) {
      console.error('Error loading active reward:', error);
    }
  };

  useEffect(() => {
    // Cargar datos del perfil del usuario si están disponibles
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone,
        address: user.defaultAddress || prev.address,
      }));
    }
  }, [user]);

  useEffect(() => {
    saveFormData();
  }, [formData]);

  const loadFormData = async () => {
    try {
      // Primero intentar cargar desde el perfil del usuario
      if (user) {
        setFormData(prev => ({
          ...prev,
          name: user.name || prev.name,
          phone: user.phone || prev.phone,
          address: user.defaultAddress || prev.address,
        }));
      }
      
      // Luego intentar cargar desde AsyncStorage como respaldo
      const saved = await AsyncStorage.getItem('checkoutForm');
      if (saved) {
        const savedData = JSON.parse(saved);
        // Solo usar datos guardados si no hay datos del perfil
        setFormData(prev => ({
          ...prev,
          name: prev.name || savedData.name || '',
          phone: prev.phone || savedData.phone || '',
          address: prev.address || savedData.address || '',
          paymentMethod: savedData.paymentMethod || prev.paymentMethod,
        }));
      }
    } catch (error) {
      console.error('Error loading form data:', error);
    }
  };

  const saveFormData = async () => {
    try {
      await AsyncStorage.setItem('checkoutForm', JSON.stringify(formData));
    } catch (error) {
      console.error('Error saving form data:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'El teléfono contiene caracteres inválidos';
    } else if (formData.phone.replace(/\D/g, '').length < 8) {
      newErrors.phone = 'El teléfono debe tener al menos 8 dígitos';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es requerida';
    } else if (formData.address.trim().length < 10) {
      newErrors.address = 'La dirección debe tener al menos 10 caracteres';
    }

    // Validar comprobante si el método de pago es transferencia
    if (formData.paymentMethod === PAYMENT_METHODS.TRANSFER && !receiptImage) {
      newErrors.receipt = 'Debes adjuntar el comprobante de transferencia';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Calcular subtotal sin descuento (productos gratis tienen price = 0)
  const subtotal = cartItems.reduce((sum, item) => {
    const itemPrice = item.isFreeReward ? 0 : (item.price || 0);
    return sum + (itemPrice * item.quantity);
  }, 0);
  
  // Aplicar descuento si hay una recompensa activa
  let discount = 0;
  let discountPercentage = 0;
  if (activeReward) {
    if (activeReward.name.includes('10%')) {
      discountPercentage = 10;
      discount = subtotal * 0.10;
    } else if (activeReward.name.includes('20%')) {
      discountPercentage = 20;
      discount = subtotal * 0.20;
    }
  }
  
  const total = Math.max(0, subtotal - discount);

  const pickReceiptImage = async () => {
    try {
      // Solicitar permisos
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos necesarios', 'Necesitamos acceso a tus fotos para adjuntar el comprobante.');
        return;
      }

      // Abrir selector de imágenes
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setReceiptImage(base64Image);
        if (errors.receipt) {
          setErrors({ ...errors, receipt: null });
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen. Intenta nuevamente.');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Verificar horario antes de validar el formulario
    if (!businessStatus.isOpen || !businessStatus.isWithinHours) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message = businessStatus.hoursMessage || businessStatus.message || 'El negocio está cerrado en este momento.';
      Alert.alert('Fuera de Horario', message);
      return;
    }

    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error de Validación', 'Por favor corrige los errores en el formulario');
      return;
    }

    setIsSubmitting(true);

    try {
      // Haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Obtener ubicación GPS del usuario
      let userLocation = null;
      try {
        // Verificar permisos primero
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        console.log('📍 Verificando permisos antes de crear pedido:', existingStatus);
        
        let status = existingStatus;
        
        // Si no tiene permisos, solicitarlos explícitamente
        if (existingStatus !== 'granted') {
          console.log('📍 Solicitando permisos de ubicación para crear pedido...');
          const permissionResult = await Location.requestForegroundPermissionsAsync();
          status = permissionResult.status;
          
          if (status !== 'granted') {
            console.warn('⚠️ Permiso de ubicación denegado. El pedido se creará sin coordenadas GPS.');
            Alert.alert(
              'Ubicación no disponible',
              'No se pudo obtener tu ubicación GPS. El pedido se creará usando la dirección que ingresaste. Para un tiempo estimado más preciso, permite el acceso a tu ubicación en la configuración del dispositivo.',
              [{ text: 'Entendido' }]
            );
          }
        }
        
        if (status === 'granted') {
          console.log('📍 Obteniendo ubicación GPS (forzando GPS, no red)...');
          
          // Intentar obtener ubicación con máxima precisión (GPS)
          let location;
          let attempts = 0;
          const maxAttempts = 3;
          
          while (attempts < maxAttempts) {
            try {
              location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest, // Máxima precisión para forzar GPS
                timeout: 30000, // 30 segundos para dar tiempo al GPS (aumentado)
                maximumAge: 0, // No usar caché, obtener siempre la ubicación más reciente
              });
              
              const accuracy = location.coords.accuracy;
              
              // Si la precisión es buena (< 100m), es GPS real
              if (accuracy && accuracy < 100) {
                console.log('✅ GPS detectado (precisión alta:', accuracy.toFixed(0), 'metros)');
                break;
              }
              
              // Si la precisión es mala (> 500m), es probablemente red/WiFi - RECHAZAR
              if (accuracy && accuracy > 500) {
                console.warn('⚠️ Precisión muy baja (' + accuracy.toFixed(0) + 'm). Probablemente ubicación basada en red/WiFi, no GPS.');
                console.warn('📍 Esta ubicación será rechazada. Se necesita GPS activo.');
                
                if (attempts < maxAttempts - 1) {
                  console.log('🔄 Reintentando obtener ubicación GPS... (intento ' + (attempts + 2) + '/' + maxAttempts + ')');
                  attempts++;
                  // Esperar más tiempo para que el GPS se active (5 segundos)
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  continue;
                } else {
                  // Si después de todos los intentos sigue siendo baja precisión, rechazar
                  throw new Error('PRECISION_BAJA');
                }
              }
              
              break;
            } catch (error) {
              console.warn('⚠️ Error obteniendo ubicación (intento ' + (attempts + 1) + '/' + maxAttempts + '):', error.message);
              if (error.message === 'PRECISION_BAJA') {
                // Si es error de precisión baja, no reintentar más
                throw error;
              }
              if (attempts < maxAttempts - 1) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 3000));
                continue;
              } else {
                throw error;
              }
            }
          }
          
          if (!location) {
            throw new Error('No se pudo obtener ubicación después de ' + maxAttempts + ' intentos');
          }
          
          const latitude = location.coords.latitude;
          const longitude = location.coords.longitude;
          const accuracy = location.coords.accuracy;
          
          console.log('📍 Ubicación obtenida:', { 
            latitude: latitude.toFixed(6), 
            longitude: longitude.toFixed(6), 
            accuracy: accuracy ? accuracy.toFixed(0) + ' metros' : 'desconocida',
            source: accuracy && accuracy < 100 ? 'GPS' : accuracy && accuracy > 1000 ? 'Red/WiFi' : 'Desconocido'
          });
          
          // Validar que las coordenadas estén dentro de Salto, Uruguay
          const isWithinSalto = latitude >= -31.8 && latitude <= -31.0 && 
                                longitude >= -58.3 && longitude <= -57.5;
          
          if (!isWithinSalto) {
            // Detectar ciudad basada en coordenadas
            let detectedCity = 'Ubicación desconocida';
            if (latitude < -34 && longitude > -56.5) {
              detectedCity = 'Montevideo/Las Piedras';
            } else if (latitude < -34) {
              detectedCity = 'Montevideo';
            }
            
            console.warn('⚠️ Coordenadas fuera de Salto, Uruguay:', latitude.toFixed(6), longitude.toFixed(6));
            console.warn('📍 Estas coordenadas corresponden a:', detectedCity);
            console.warn('💡 SOLUCIÓN:');
            console.warn('   1. Ve a Configuración > Ubicación en tu celular');
            console.warn('   2. Activa "Alta precisión" o "GPS, Wi‑Fi y redes móviles"');
            console.warn('   3. Desactiva "Ahorro de batería" o "Solo dispositivo"');
            console.warn('   4. Sal al aire libre para mejor señal GPS');
            console.warn('   5. Espera 10-15 segundos para que el GPS se active');
            
            Alert.alert(
              'Ubicación incorrecta detectada',
              `Tu celular detectó que estás en ${detectedCity}, pero deberías estar en Salto, Uruguay.\n\nEsto ocurre porque el GPS no está activado y se está usando ubicación basada en red/WiFi.\n\n🔧 SOLUCIÓN:\n\n1. Ve a Configuración > Ubicación\n2. Activa "Alta precisión" (GPS + Wi‑Fi + Redes)\n3. Desactiva "Ahorro de batería"\n4. Sal al aire libre\n5. Espera 10-15 segundos\n6. Intenta crear el pedido nuevamente\n\nEl GPS puede tardar unos segundos en activarse.`,
              [
                { text: 'Entendido', style: 'cancel' }
              ]
            );
            
            // No usar estas coordenadas, el pedido se creará sin coordenadas GPS
            userLocation = null;
          } else {
            // Verificar precisión - advertir si es baja pero aceptar si está dentro de Salto
            if (accuracy && accuracy > 1000) {
              console.warn('⚠️ Precisión muy baja (' + accuracy.toFixed(0) + 'm). Probablemente ubicación basada en red, no GPS.');
              
              Alert.alert(
                'Precisión baja detectada',
                `La ubicación tiene baja precisión (${accuracy.toFixed(0)} metros). Esto indica que se está usando ubicación basada en red/WiFi en lugar de GPS.\n\nPara mejor precisión:\n• Activa GPS en Configuración > Ubicación\n• Selecciona "Alta precisión"\n• Sal al aire libre\n• Espera 10-15 segundos\n\nEl pedido se creará con esta ubicación, pero el tiempo estimado puede ser menos preciso.`,
                [{ text: 'Entendido' }]
              );
            }
            
            // Aceptar las coordenadas si están dentro de Salto (aunque la precisión sea baja)
            userLocation = {
              latitude,
              longitude,
            };
            console.log('✅ Coordenadas validadas dentro de Salto, Uruguay');
          }
          
          // Intentar obtener la dirección real de las coordenadas GPS (geocodificación inversa)
          try {
            const reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.latitude}&lon=${userLocation.longitude}&zoom=18&addressdetails=1`;
            const reverseResponse = await fetch(reverseGeocodeUrl, {
              headers: {
                'User-Agent': 'CornerApp-Mobile/1.0',
              },
            });
            
            if (reverseResponse.ok) {
              const reverseData = await reverseResponse.json();
              const addressFromGPS = reverseData.display_name || reverseData.address?.road || 'Dirección no disponible';
              console.log('📍 Dirección obtenida de coordenadas GPS:', addressFromGPS);
              console.log('📍 Detalles completos:', JSON.stringify(reverseData.address, null, 2));
              
              // Si la dirección del formulario está vacía o es diferente, sugerir usar la dirección GPS
              if (!formData.address || formData.address.trim() === '') {
                // Extraer dirección más legible
                const addressParts = [];
                if (reverseData.address?.road) addressParts.push(reverseData.address.road);
                if (reverseData.address?.house_number) addressParts.push(reverseData.address.house_number);
                if (reverseData.address?.suburb || reverseData.address?.neighbourhood) {
                  addressParts.push(reverseData.address.suburb || reverseData.address.neighbourhood);
                }
                
                const suggestedAddress = addressParts.length > 0 
                  ? addressParts.join(', ') + ', Salto, Uruguay'
                  : addressFromGPS;
                
                console.log('📍 Dirección sugerida desde GPS:', suggestedAddress);
              }
            }
          } catch (reverseError) {
            console.warn('⚠️ No se pudo obtener la dirección de las coordenadas GPS:', reverseError);
          }
        } else {
          console.log('⚠️ Permisos de ubicación no otorgados');
        }
      } catch (locationError) {
        console.warn('⚠️ Error al obtener ubicación GPS:', locationError);
        
        // Si es error de precisión baja, mostrar alerta específica
        if (locationError.message === 'PRECISION_BAJA') {
          Alert.alert(
            'GPS no disponible',
            'Tu celular está usando ubicación basada en red/WiFi en lugar de GPS.\n\nPara obtener tu ubicación correcta en Salto:\n\n1. Ve a Configuración > Ubicación\n2. Activa "Alta precisión" (GPS + Wi‑Fi + Redes)\n3. Desactiva "Ahorro de batería"\n4. Sal al aire libre\n5. Espera 10-15 segundos\n6. Intenta crear el pedido nuevamente\n\nEl pedido se creará sin coordenadas GPS por ahora.',
            [{ text: 'Entendido' }]
          );
        } else {
          // Para otros errores, mostrar mensaje genérico
          Alert.alert(
            'Ubicación no disponible',
            'No se pudo obtener tu ubicación GPS. El pedido se creará usando la dirección que ingresaste. Para un tiempo estimado más preciso, permite el acceso a tu ubicación en la configuración del dispositivo.',
            [{ text: 'Entendido' }]
          );
        }
        
        // Continuar sin ubicación, el backend intentará geocodificar la dirección
      }

      // Combinar comentarios de items
      const itemComments = cartItems
        .filter(item => item.comment && item.comment.trim())
        .map(item => `${item.name}: ${item.comment.trim()}`)
        .join('\n');
      
      const allComments = itemComments || null;

      // Preparar datos del pedido
      const orderData = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        paymentMethod: formData.paymentMethod,
        items: cartItems,
        comments: allComments,
      };

      // Agregar coordenadas GPS si están disponibles
      if (userLocation) {
        orderData.customerLatitude = userLocation.latitude;
        orderData.customerLongitude = userLocation.longitude;
      }

      // Si hay comprobante, agregarlo como base64
      if (receiptImage) {
        orderData.receiptImage = receiptImage;
      }

      // Crear pedido en el backend
      const order = await createOrder(orderData);

      // Analytics
      analytics.trackPurchase(total, cartItems);

      // Limpiar formulario guardado
      AsyncStorage.removeItem('checkoutForm');

      // Limpiar recompensa activa después de usarla
      if (activeReward) {
        await AsyncStorage.removeItem('activeReward');
        setActiveReward(null);
      }

      // Limpiar carrito
      dispatch(clearCart());

      // Actualizar puntos del usuario (se suman automáticamente en el backend)
      dispatch(checkAuth());

      // Limpiar comprobante
      setReceiptImage(null);

      // Todos los métodos de pago van directamente a seguimiento
      // Guardar orderId y navegar a seguimiento
      try {
        const orderId = typeof order.id === 'number' ? order.id : parseInt(order.id);
        await AsyncStorage.setItem('lastOrderId', orderId.toString());
        
        // Guardar también en la lista de pedidos
        const savedOrderIds = await AsyncStorage.getItem('savedOrderIds');
        const orderIds = savedOrderIds ? JSON.parse(savedOrderIds) : [];
        
        // Normalizar todos los IDs a números para comparación consistente
        const normalizedOrderIds = orderIds.map(id => typeof id === 'number' ? id : parseInt(id));
        
        if (!normalizedOrderIds.includes(orderId)) {
          normalizedOrderIds.push(orderId);
          await AsyncStorage.setItem('savedOrderIds', JSON.stringify(normalizedOrderIds));
          console.log('✅ Pedido guardado:', orderId, 'Total pedidos:', normalizedOrderIds.length);
        } else {
          console.log('⚠️ Pedido ya existe en la lista:', orderId);
        }
      } catch (err) {
        console.error('Error saving order ID:', err);
      }
      
      // Navegar directamente a la pantalla de seguimiento
      navigation.navigate('OrderTracking', { orderId: order.id });
    } catch (error) {
      console.error('Error al crear pedido:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Obtener mensaje de error específico del backend o usar mensaje genérico
      let errorMessage = 'No se pudo procesar tu pedido. Verifica que el backend esté corriendo o intenta nuevamente.';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert(
        'Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    title: { color: colors.text },
    summaryCard: { backgroundColor: colors.cardBackground },
    formCard: { backgroundColor: colors.cardBackground },
    summaryTitle: { color: colors.cardText || colors.text },
    summaryText: { color: colors.cardTextSecondary || colors.textSecondary },
    summaryPrice: { color: colors.cardText || colors.text },
    totalLabel: { color: colors.cardText || colors.text },
    totalPrice: { color: colors.cardText || '#1a202c' },
    formTitle: { color: colors.cardText || colors.text },
    label: { color: colors.cardText || colors.text },
    input: { 
      backgroundColor: '#f3f4f6',
      color: colors.cardText || colors.text,
      borderColor: errors.name || errors.phone || errors.address ? colors.error : colors.border,
      borderWidth: 1,
    },
    errorText: { color: colors.error },
    paymentOption: { backgroundColor: colors.cardBackground },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      <View style={styles.content}>
        <Text style={[styles.title, dynamicStyles.title]}>Confirmar Pedido</Text>

        <View style={[styles.summaryCard, dynamicStyles.summaryCard]}>
          <Text style={[styles.summaryTitle, dynamicStyles.summaryTitle]}>Resumen del Pedido</Text>
          {cartItems.map(item => (
            <View key={item.id} style={styles.summaryItem}>
              <Text style={[styles.summaryText, dynamicStyles.summaryText]}>
                {item.name} x{item.quantity}
              </Text>
              <Text style={[styles.summaryPrice, dynamicStyles.summaryPrice]}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          {activeReward && discount > 0 && (
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryText, dynamicStyles.summaryText, { color: colors.success || '#4CAF50' }]}>
                🎁 {activeReward.name} (-{discountPercentage}%)
              </Text>
              <Text style={[styles.summaryPrice, { color: colors.success || '#4CAF50' }]}>
                -${discount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text style={[styles.totalLabel, dynamicStyles.totalLabel]}>Subtotal:</Text>
            <Text style={[styles.summaryPrice, dynamicStyles.summaryPrice]}>${subtotal.toFixed(2)}</Text>
          </View>
          {activeReward && discount > 0 && (
            <View style={styles.summaryTotal}>
              <Text style={[styles.totalLabel, dynamicStyles.totalLabel]}>Descuento:</Text>
              <Text style={[styles.summaryPrice, { color: colors.success || '#4CAF50' }]}>
                -${discount.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text style={[styles.totalLabel, dynamicStyles.totalLabel]}>Total:</Text>
            <Text style={[styles.totalPrice, { color: colors.cardText || '#1a202c' }]}>${total.toFixed(2)}</Text>
          </View>
          <View style={styles.deliveryTime}>
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <Text style={[styles.deliveryTimeText, { color: colors.cardText || '#1a202c' }]}>
              El tiempo estimado se calculará automáticamente según tu ubicación
            </Text>
          </View>
        </View>

        <View style={[styles.formCard, dynamicStyles.formCard]}>
          <Text style={[styles.formTitle, dynamicStyles.formTitle]}>Información de Entrega</Text>

          <Text style={[styles.label, dynamicStyles.label]}>Nombre completo</Text>
          <TextInput
            style={[styles.input, dynamicStyles.input, errors.name && styles.inputError]}
            placeholder="Ingresa tu nombre"
            placeholderTextColor={colors.textSecondary}
            value={formData.name}
            onChangeText={(text) => {
              setFormData({ ...formData, name: text });
              if (errors.name) setErrors({ ...errors, name: null });
            }}
          />
          {errors.name && <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.name}</Text>}

          <Text style={[styles.label, dynamicStyles.label]}>Teléfono</Text>
          <TextInput
            style={[styles.input, dynamicStyles.input, errors.phone && styles.inputError]}
            placeholder="Ingresa tu teléfono"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(text) => {
              setFormData({ ...formData, phone: text });
              if (errors.phone) setErrors({ ...errors, phone: null });
            }}
          />
          {errors.phone && <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.phone}</Text>}

          <Text style={[styles.label, dynamicStyles.label]}>Dirección de entrega</Text>
          <TextInput
            style={[styles.input, styles.textArea, dynamicStyles.input, errors.address && styles.inputError]}
            placeholder="Ingresa tu dirección"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={formData.address}
            onChangeText={(text) => {
              setFormData({ ...formData, address: text });
              if (errors.address) setErrors({ ...errors, address: null });
            }}
          />
          {errors.address && <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.address}</Text>}

          <View style={styles.paymentSection}>
            <Text style={[styles.label, dynamicStyles.label]}>Método de pago</Text>
            
            <TouchableOpacity
              onPress={() => {
                setFormData({ ...formData, paymentMethod: PAYMENT_METHODS.CASH });
                setReceiptImage(null);
              }}
              style={[
                styles.paymentOption,
                dynamicStyles.paymentOption,
                formData.paymentMethod === PAYMENT_METHODS.CASH && styles.paymentOptionSelected,
                formData.paymentMethod === PAYMENT_METHODS.CASH && { borderColor: colors.primary, borderWidth: 2 }
              ]}
            >
              <View style={styles.paymentOptionContent}>
                <View style={styles.paymentOptionLeft}>
                  <Ionicons 
                    name={formData.paymentMethod === PAYMENT_METHODS.CASH ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={formData.paymentMethod === PAYMENT_METHODS.CASH ? colors.primary : '#64748b'} 
                  />
                  <Ionicons name="cash" size={24} color={colors.primary} style={styles.paymentIcon} />
                  <View>
                    <Text style={[styles.paymentOptionTitle, { color: colors.cardText || '#1a202c' }]}>Efectivo</Text>
                    <Text style={[styles.paymentOptionSubtitle, { color: colors.cardTextSecondary || '#64748b' }]}>Pago al entregar</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFormData({ ...formData, paymentMethod: PAYMENT_METHODS.POS });
                setReceiptImage(null);
              }}
              style={[
                styles.paymentOption,
                dynamicStyles.paymentOption,
                formData.paymentMethod === PAYMENT_METHODS.POS && styles.paymentOptionSelected,
                formData.paymentMethod === PAYMENT_METHODS.POS && { borderColor: colors.primary, borderWidth: 2 }
              ]}
            >
              <View style={styles.paymentOptionContent}>
                <View style={styles.paymentOptionLeft}>
                  <Ionicons 
                    name={formData.paymentMethod === PAYMENT_METHODS.POS ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={formData.paymentMethod === PAYMENT_METHODS.POS ? colors.primary : '#64748b'} 
                  />
                  <Ionicons name="card" size={24} color={colors.primary} style={styles.paymentIcon} />
                  <View>
                    <Text style={[styles.paymentOptionTitle, { color: colors.cardText || '#1a202c' }]}>POS a domicilio</Text>
                    <Text style={[styles.paymentOptionSubtitle, { color: colors.cardTextSecondary || '#64748b' }]}>Pago con tarjeta al entregar</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFormData({ ...formData, paymentMethod: PAYMENT_METHODS.TRANSFER })}
              style={[
                styles.paymentOption,
                dynamicStyles.paymentOption,
                formData.paymentMethod === PAYMENT_METHODS.TRANSFER && styles.paymentOptionSelected,
                formData.paymentMethod === PAYMENT_METHODS.TRANSFER && { borderColor: colors.primary, borderWidth: 2 }
              ]}
            >
              <View style={styles.paymentOptionContent}>
                <View style={styles.paymentOptionLeft}>
                  <Ionicons 
                    name={formData.paymentMethod === PAYMENT_METHODS.TRANSFER ? 'radio-button-on' : 'radio-button-off'} 
                    size={24} 
                    color={formData.paymentMethod === PAYMENT_METHODS.TRANSFER ? colors.primary : '#64748b'} 
                  />
                  <Ionicons name="swap-horizontal" size={24} color={colors.primary} style={styles.paymentIcon} />
                  <View>
                    <Text style={[styles.paymentOptionTitle, { color: colors.cardText || '#1a202c' }]}>Transferencia</Text>
                    <Text style={[styles.paymentOptionSubtitle, { color: colors.cardTextSecondary || '#64748b' }]}>Adjuntar comprobante</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>

                {(() => {
                  const selectedMethod = paymentMethodsData.find(m => 
                    (m.name?.toLowerCase() === formData.paymentMethod?.toLowerCase()) || 
                    (m.Name?.toLowerCase() === formData.paymentMethod?.toLowerCase())
                  );
                  
                  if (!selectedMethod) return null;
                  
                  const bankName = selectedMethod.bankName || selectedMethod.BankName;
                  const accountNumber = selectedMethod.accountNumber || selectedMethod.AccountNumber;
                  const accountHolder = selectedMethod.accountHolder || selectedMethod.AccountHolder;
                  const accountType = selectedMethod.accountType || selectedMethod.AccountType;
                  const accountAlias = selectedMethod.accountAlias || selectedMethod.AccountAlias;
                  
                  // Si tiene algún dato bancario, mostrar el cuadro
                  if (bankName || accountNumber || accountHolder || accountAlias) {
                      const boxBgColor = colors.cardBackground || '#ffffff';
                      const textColor = colors.cardText || '#1a202c';
                      const textSecondary = colors.cardTextSecondary || '#64748b';
                      const accentColor = colors.primary;
                      
                      return (
                        <View style={[styles.bankInfoContainer, { backgroundColor: boxBgColor, borderColor: accentColor }]}>
                          <View style={styles.bankInfoHeader}>
                            <Ionicons name="information-circle-outline" size={20} color={accentColor} />
                            <Text style={[styles.bankInfoTitle, { color: accentColor, fontWeight: 'bold' }]}>Datos para el pago</Text>
                          </View>
                          
                          <View style={styles.bankDetails}>
                            {bankName && (
                              <View style={styles.bankRow}>
                                <Text style={[styles.bankLabel, { color: textSecondary }]}>Banco:</Text>
                                <Text style={[styles.bankValue, { color: textColor }]}>{bankName}</Text>
                              </View>
                            )}
                            {accountNumber && (
                              <View style={styles.bankRow}>
                                <Text style={[styles.bankLabel, { color: textSecondary }]}>Nº Cuenta:</Text>
                                <Text style={[styles.bankValue, { color: textColor, fontWeight: 'bold' }]}>{accountNumber}</Text>
                              </View>
                            )}
                            {accountHolder && (
                              <View style={styles.bankRow}>
                                <Text style={[styles.bankLabel, { color: textSecondary }]}>Titular:</Text>
                                <Text style={[styles.bankValue, { color: textColor }]}>{accountHolder}</Text>
                              </View>
                            )}
                            {(accountType || bankName) && (
                              <View style={styles.bankRow}>
                                <Text style={[styles.bankLabel, { color: textSecondary }]}>Tipo:</Text>
                                <Text style={[styles.bankValue, { color: textColor }]}>{accountType || 'Caja de Ahorros'}</Text>
                              </View>
                            )}
                            {accountAlias && (
                              <View style={styles.bankRow}>
                                <Text style={[styles.bankLabel, { color: textSecondary }]}>Alias/CBU:</Text>
                                <Text style={[styles.bankValue, { color: textColor, fontWeight: 'bold' }]}>{accountAlias}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                  }
                  
                  // Si es transferencia pero no tiene datos, avisar (solo si estamos seguros que es transferencia)
                  if (formData.paymentMethod === PAYMENT_METHODS.TRANSFER) {
                    return (
                      <View style={[styles.bankInfoContainer, { backgroundColor: colors.error + '10', borderColor: colors.error }]}>
                        <Text style={[styles.bankLabel, { color: colors.error, fontStyle: 'italic' }]}>
                          ⚠️ No se encontraron datos bancarios configurados.
                        </Text>
                      </View>
                    );
                  }
                  
                  return null;
                })()}


            {formData.paymentMethod === PAYMENT_METHODS.TRANSFER && (
              <View style={styles.receiptSection}>
                <Text style={[styles.label, dynamicStyles.label]}>Comprobante de transferencia</Text>
                {receiptImage ? (
                  <View style={styles.receiptPreview}>
                    <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                    <TouchableOpacity
                      onPress={() => setReceiptImage(null)}
                      style={styles.removeReceiptButton}
                    >
                      <Ionicons name="close-circle" size={24} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={pickReceiptImage}
                    style={[styles.attachReceiptButton, { borderColor: colors.primary }]}
                  >
                    <Ionicons name="attach" size={20} color={colors.primary} />
                    <Text style={[styles.attachReceiptText, { color: colors.primary }]}>
                      Adjuntar comprobante
                    </Text>
                  </TouchableOpacity>
                )}
                {errors.receipt && (
                  <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.receipt}</Text>
                )}
              </View>
            )}
          </View>

          {/* Mensaje de horario */}
          {(!businessStatus.isOpen || !businessStatus.isWithinHours) && (
            <View style={[styles.hoursAlert, { backgroundColor: colors.error + '20', borderColor: colors.error }]}>
              <Ionicons name="time-outline" size={20} color={colors.error} />
              <View style={styles.hoursAlertContent}>
                <Text style={[styles.hoursAlertTitle, { color: colors.error }]}>
                  {businessStatus.hoursMessage || businessStatus.message || 'Cerrado'}
                </Text>
                {timeUntilOpen && (
                  <Text style={[styles.hoursAlertTime, { color: colors.textSecondary }]}>
                    Abrimos en {timeUntilOpen.hours > 0 ? `${timeUntilOpen.hours}h ` : ''}{timeUntilOpen.minutes}m
                  </Text>
                )}
              </View>
            </View>
          )}

          {businessStatus.isWithinHours && businessStatus.isOpen && (
            <View style={[styles.hoursAlert, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
              <Text style={[styles.hoursAlertTitle, { color: colors.success }]}>
                ✅ Estamos abiertos. Pedidos hasta las 12:00 AM
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={!businessStatus.isOpen || !businessStatus.isWithinHours || isSubmitting}
            style={[
              styles.submitButtonContainer,
              (!businessStatus.isOpen || !businessStatus.isWithinHours || isSubmitting) && styles.submitButtonDisabled
            ]}
          >
            <LinearGradient
              colors={(!businessStatus.isOpen || !businessStatus.isWithinHours || isSubmitting) 
                ? ['#9ca3af', '#6b7280'] 
                : ['#ea580c', '#f97316']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitButton}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons 
                    name={(!businessStatus.isOpen || !businessStatus.isWithinHours) ? "lock-closed" : "checkmark-circle"} 
                    size={24} 
                    color="#ffffff" 
                  />
                  <Text style={styles.submitButtonText}>
                    {(!businessStatus.isOpen || !businessStatus.isWithinHours) ? 'Cerrado' : 'Enviar Pedido'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  summaryCard: {
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 16,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  deliveryTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  deliveryTimeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formCard: {
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  label: {
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 2,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: -4,
  },
  paymentSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  paymentOption: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentOptionSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  paymentIcon: {
    marginHorizontal: 0,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  paymentOptionSubtitle: {
    fontSize: 14,
  },
  receiptSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  attachReceiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: 8,
  },
  attachReceiptText: {
    fontSize: 16,
    fontWeight: '500',
  },
  receiptPreview: {
    position: 'relative',
    marginTop: 8,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: '#f3f4f6',
  },
  removeReceiptButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 4,
  },
  submitButtonContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  hoursAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    gap: 12,
  },
  hoursAlertContent: {
    flex: 1,
  },
  hoursAlertTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hoursAlertTime: {
    fontSize: 14,
  },
  bankInfoContainer: {
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  bankInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  bankInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bankDetails: {
    marginTop: 4,
  },
  bankRow: {
    marginBottom: 12,
  },
  bankLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bankValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
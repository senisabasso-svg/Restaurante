import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { checkAuth } from '../redux/slices/authSlice';
import { LinearGradient } from 'expo-linear-gradient';
import { addToCart } from '../redux/slices/cartSlice';
import { getProducts } from '../services/api';
import apiClient from '../services/api';

const PointsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { user, isLoading } = useSelector((state) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [rewardsModalVisible, setRewardsModalVisible] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      // Recargar datos del usuario cuando la pantalla recibe foco (opcional)
      // dispatch(checkAuth());
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(checkAuth());
    setRefreshing(false);
  };

  const loadRewards = async () => {
    try {
      setLoadingRewards(true);
      console.log('Loading rewards...');
      
      // Verificar que el usuario esté autenticado
      if (!user) {
        Alert.alert('Error', 'Debes estar autenticado para ver las recompensas');
        setLoadingRewards(false);
        return;
      }
      
      const response = await apiClient.get('/api/points/rewards');
      console.log('Rewards response:', response.data);
      
      if (response.data && Array.isArray(response.data)) {
        setRewards(response.data);
      } else {
        console.error('Invalid rewards data format:', response.data);
        Alert.alert('Error', 'Formato de datos inválido');
      }
    } catch (error) {
      console.error('Error loading rewards:', error);
      console.error('Error details:', error.response?.data);
      console.error('Error status:', error.response?.status);
      console.error('Error message:', error.message);
      
      let errorMessage = 'No se pudieron cargar las recompensas';
      
      if (error.response?.status === 401) {
        errorMessage = 'Sesión expirada. Por favor inicia sesión nuevamente';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoadingRewards(false);
    }
  };

  const handleRedeem = async (reward) => {
    if (points < reward.pointsRequired) {
      Alert.alert('Puntos insuficientes', `Necesitas ${reward.pointsRequired} puntos para canjear esta recompensa.`);
      return;
    }

    Alert.alert(
      'Confirmar Canje',
      `¿Deseas canjear ${reward.pointsRequired} puntos por "${reward.name}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Canjear',
          onPress: async () => {
            try {
              setRedeeming(true);
              const response = await apiClient.post('/api/points/redeem', {
                rewardId: reward.id,
                rewardName: reward.name,
                pointsRequired: reward.pointsRequired,
              });

              // Manejar diferentes tipos de recompensas
              if (reward.name.includes('descuento')) {
                // Guardar descuento para aplicarlo en el checkout
                await AsyncStorage.setItem('activeReward', JSON.stringify({
                  id: reward.id,
                  name: reward.name,
                  pointsRequired: reward.pointsRequired,
                  redeemedAt: new Date().toISOString(),
                  type: 'discount',
                }));

                Alert.alert(
                  '¡Éxito!', 
                  `${response.data.message}\n\nEl descuento se aplicará automáticamente en tu próximo pedido.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setRewardsModalVisible(false);
                        dispatch(checkAuth()); // Actualizar puntos
                      },
                    },
                  ]
                );
              } else if (reward.name.includes('Pizza gratis') || reward.name.includes('Bebida gratis')) {
                // Agregar producto gratis automáticamente al carrito
                try {
                  const productsResponse = await getProducts();
                  const products = productsResponse.data;
                  
                  let freeProduct = null;
                  if (reward.name.includes('Pizza gratis')) {
                    // Buscar la primera pizza disponible
                    freeProduct = products.find(p => 
                      p.category?.toLowerCase() === 'pizza' || 
                      p.Category?.name?.toLowerCase() === 'pizza' ||
                      p.name?.toLowerCase().includes('pizza')
                    );
                  } else if (reward.name.includes('Bebida gratis')) {
                    // Buscar la primera bebida disponible
                    freeProduct = products.find(p => 
                      p.category?.toLowerCase() === 'bebida' || 
                      p.Category?.name?.toLowerCase() === 'bebida' ||
                      p.name?.toLowerCase().includes('bebida') ||
                      p.name?.toLowerCase().includes('coca') ||
                      p.name?.toLowerCase().includes('agua') ||
                      p.name?.toLowerCase().includes('jugo')
                    );
                  }

                  if (freeProduct) {
                    // Agregar producto gratis al carrito con precio 0
                    const freeProductWithZeroPrice = {
                      ...freeProduct,
                      price: 0, // Producto gratis
                      isFreeReward: true,
                      rewardName: reward.name,
                    };
                    dispatch(addToCart(freeProductWithZeroPrice));

                    // Guardar información de la recompensa
                    await AsyncStorage.setItem('activeReward', JSON.stringify({
                      id: reward.id,
                      name: reward.name,
                      pointsRequired: reward.pointsRequired,
                      redeemedAt: new Date().toISOString(),
                      type: 'freeProduct',
                      productId: freeProduct.id,
                    }));

                    Alert.alert(
                      '¡Éxito!', 
                      `${response.data.message}\n\n${freeProduct.name} ha sido agregada automáticamente a tu carrito.`,
                      [
                        {
                          text: 'Ver Carrito',
                          onPress: () => {
                            setRewardsModalVisible(false);
                            dispatch(checkAuth()); // Actualizar puntos
                            navigation.navigate('Cart');
                          },
                        },
                        {
                          text: 'OK',
                          style: 'cancel',
                          onPress: () => {
                            setRewardsModalVisible(false);
                            dispatch(checkAuth()); // Actualizar puntos
                          },
                        },
                      ]
                    );
                  } else {
                    // Si no se encuentra el producto, guardar como descuento genérico
                    await AsyncStorage.setItem('activeReward', JSON.stringify({
                      id: reward.id,
                      name: reward.name,
                      pointsRequired: reward.pointsRequired,
                      redeemedAt: new Date().toISOString(),
                      type: 'freeProduct',
                    }));

                    Alert.alert(
                      '¡Éxito!', 
                      `${response.data.message}\n\nLa recompensa se aplicará en tu próximo pedido.`,
                      [
                        {
                          text: 'OK',
                          onPress: () => {
                            setRewardsModalVisible(false);
                            dispatch(checkAuth()); // Actualizar puntos
                          },
                        },
                      ]
                    );
                  }
                } catch (error) {
                  console.error('Error adding free product to cart:', error);
                  Alert.alert(
                    '¡Éxito!', 
                    `${response.data.message}\n\nLa recompensa se aplicará en tu próximo pedido.`,
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          setRewardsModalVisible(false);
                          dispatch(checkAuth()); // Actualizar puntos
                        },
                      },
                    ]
                  );
                }
              } else {
                // Otras recompensas
                await AsyncStorage.setItem('activeReward', JSON.stringify({
                  id: reward.id,
                  name: reward.name,
                  pointsRequired: reward.pointsRequired,
                  redeemedAt: new Date().toISOString(),
                }));

                Alert.alert(
                  '¡Éxito!', 
                  `${response.data.message}\n\nLa recompensa se aplicará automáticamente en tu próximo pedido.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setRewardsModalVisible(false);
                        dispatch(checkAuth()); // Actualizar puntos
                      },
                    },
                  ]
                );
              }
            } catch (error) {
              console.error('Error redeeming points:', error);
              Alert.alert(
                'Error',
                error.response?.data?.error || 'No se pudo canjear la recompensa'
              );
            } finally {
              setRedeeming(false);
            }
          },
        },
      ]
    );
  };

  const points = user?.points ?? 0;

  // Debug: mostrar información del usuario
  React.useEffect(() => {
    console.log('PointsScreen - User data:', user);
    console.log('PointsScreen - Points:', points);
    console.log('PointsScreen - Screen mounted');
    console.log('PointsScreen - isLoading:', isLoading);
  }, [user, points, isLoading]);

  console.log('PointsScreen - Rendering, user:', !!user, 'points:', points);

  // Solo mostrar loading si no hay usuario y está cargando
  if (isLoading && !user) {
    console.log('PointsScreen - Showing loading');
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando...</Text>
      </View>
    );
  }

  // Si no hay usuario, mostrar mensaje
  if (!user) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>No se pudo cargar la información</Text>
      </View>
    );
  }

  console.log('PointsScreen - Rendering main content');
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.header}>
        <View style={[styles.pointsCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="trophy" size={64} color="#fff" />
        </View>
        <Text style={[styles.pointsLabel, { color: colors.textSecondary }]}>Tus Puntos</Text>
        <Text style={[styles.pointsValue, { color: colors.text }]}>{points}</Text>
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={24} color="#000000" />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: '#000000' }]}>¿Cómo ganar puntos?</Text>
            <Text style={[styles.infoText, { color: '#4b5563' }]}>
              Ganas 1 punto por cada pedido que realizas. ¡Mientras más pedidos hagas, más puntos acumulas!
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
        <Text style={[styles.statsTitle, { color: '#000000' }]}>Estadísticas</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={32} color="#000000" />
            <Text style={[styles.statValue, { color: '#000000' }]}>{points}</Text>
            <Text style={[styles.statLabel, { color: '#4b5563' }]}>Pedidos realizados</Text>
          </View>
        </View>
      </View>

      {points === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <Ionicons name="pizza-outline" size={48} color="#4b5563" />
          <Text style={[styles.emptyText, { color: '#000000' }]}>
            Aún no tienes puntos
          </Text>
          <Text style={[styles.emptySubtext, { color: '#4b5563' }]}>
            Realiza tu primer pedido para comenzar a acumular puntos
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.redeemButton}
          onPress={() => {
            setRewardsModalVisible(true);
            loadRewards();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.gradientButton, { backgroundColor: '#001219' }]}>
            <Ionicons name="gift-outline" size={24} color="#ffffff" />
            <Text style={[styles.redeemButtonText, { color: '#ffffff', fontSize: 18, fontWeight: 'bold' }]}>Canjear Puntos</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal de Recompensas */}
      <Modal
        visible={rewardsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRewardsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#720026' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#ffffff', fontWeight: 'bold' }]}>Canjear Puntos</Text>
              <TouchableOpacity
                onPress={() => setRewardsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={28} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: '#ffffff', fontSize: 16, fontWeight: '500' }]}>
              Tienes {points} puntos disponibles
            </Text>

            {loadingRewards ? (
              <View style={styles.loadingRewards}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={styles.rewardsList}>
                {rewards.map((reward) => (
                  <TouchableOpacity
                    key={reward.id}
                    style={[
                      styles.rewardCard,
                      {
                        backgroundColor: '#ffffff',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        opacity: points >= reward.pointsRequired ? 1 : 0.6,
                      },
                    ]}
                    onPress={() => handleRedeem(reward)}
                    disabled={points < reward.pointsRequired || redeeming}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rewardInfo}>
                      <Text style={[styles.rewardName, { color: '#000000', fontWeight: '600', fontSize: 18 }]}>
                        {reward.name}
                      </Text>
                      <Text style={[styles.rewardDescription, { color: '#374151', fontSize: 14, lineHeight: 20 }]}>
                        {reward.description}
                      </Text>
                    </View>
                    <View style={styles.rewardPoints}>
                      <Ionicons
                        name="trophy"
                        size={22}
                        color={points >= reward.pointsRequired ? '#720026' : '#9ca3af'}
                      />
                      <Text
                        style={[
                          styles.rewardPointsText,
                          {
                            color: points >= reward.pointsRequired ? '#000000' : '#6b7280',
                            fontWeight: 'bold',
                            fontSize: 18,
                          },
                        ]}
                      >
                        {reward.pointsRequired}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 20,
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  pointsCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  actions: {
    padding: 20,
    paddingTop: 0,
  },
  redeemButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  redeemButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
    backgroundColor: '#720026',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  loadingRewards: {
    padding: 40,
    alignItems: 'center',
  },
  rewardsList: {
    maxHeight: 400,
  },
  rewardCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  rewardInfo: {
    flex: 1,
    marginRight: 12,
  },
  rewardName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
  },
  rewardPoints: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardPointsText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default PointsScreen;


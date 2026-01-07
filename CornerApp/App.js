import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme as useAppTheme } from './context/ThemeContext';
import { store } from './redux/store';
import { initializeCart, clearCart } from './redux/slices/cartSlice';
import { checkAuth, logoutUser } from './redux/slices/authSlice';
import Toast from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import analytics from './services/analytics';
import './services/locationTask'; // Registrar tarea de ubicación en segundo plano
import HomeScreen from './screens/HomeScreen';
import MenuScreen from './screens/MenuScreen';
import CartScreen from './screens/CartScreen';
import CheckoutScreen from './screens/CheckoutScreen';
import OrderTrackingScreen from './screens/OrderTrackingScreen';
import MyOrdersScreen from './screens/MyOrdersScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import PointsScreen from './screens/PointsScreen';
import ProfileMenu from './components/ProfileMenu';
import DeliveryOrdersScreen from './screens/DeliveryOrdersScreen';
import DeliveryOrderDetailScreen from './screens/DeliveryOrderDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tabs para clientes
const CustomerTabs = ({ onOpenProfileMenu }) => {
  const { colors } = useAppTheme();
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const { user } = useSelector(state => state.auth);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const showToast = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#cccccc',
          tabBarStyle: {
            backgroundColor: '#001219',
            borderTopColor: '#001219',
          },
          headerStyle: {
            backgroundColor: '#001219',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          statusBarStyle: 'light',
          statusBarBackgroundColor: '#001219',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => onOpenProfileMenu && onOpenProfileMenu()}
              style={{ marginRight: 16, padding: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={28} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Inicio',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Menu"
          options={{
            title: 'Menú',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant" size={size} color={color} />
            ),
          }}
        >
          {(props) => <MenuScreen {...props} showToast={showToast} />}
        </Tab.Screen>
        <Tab.Screen
          name="Cart"
          component={CartScreen}
          options={{
            title: 'Carrito',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
            tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
          }}
        />
        <Tab.Screen
          name="MyOrders"
          component={MyOrdersScreen}
          options={{
            title: 'Mis Pedidos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </>
  );
};

// Tabs para repartidores
const DeliveryPersonTabs = ({ onOpenProfileMenu }) => {
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#cccccc',
        tabBarStyle: {
          backgroundColor: '#001219',
          borderTopColor: '#001219',
        },
        headerStyle: {
          backgroundColor: '#001219',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={() => onOpenProfileMenu && onOpenProfileMenu()}
            style={{ marginRight: 16, padding: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-circle-outline" size={28} color="#fff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tab.Screen
        name="DeliveryOrders"
        component={DeliveryOrdersScreen}
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { isAuthenticated, isLoading, role } = useSelector((state) => state.auth);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  useEffect(() => {
    dispatch(initializeCart());
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      analytics.trackScreenView('HomeTabs');
      // Solicitar permiso de ubicación cuando el usuario está autenticado
      requestLocationPermission();
    }
  }, [isAuthenticated]);

  const requestLocationPermission = async () => {
    try {
      // Verificar si ya tiene permisos
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus !== 'granted') {
        // Solicitar permiso de ubicación en primer plano
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          console.log('✅ Permiso de ubicación concedido');
          
          // Intentar solicitar permiso de ubicación en segundo plano (opcional)
          try {
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus === 'granted') {
              console.log('✅ Permiso de ubicación en segundo plano concedido');
            } else {
              console.log('ℹ️ Permiso de ubicación en segundo plano denegado, pero funcionará en primer plano');
            }
          } catch (error) {
            console.log('ℹ️ No se pudo solicitar permiso de segundo plano (puede no estar disponible en esta plataforma)');
          }
        } else {
          console.log('⚠️ Permiso de ubicación denegado');
        }
      } else {
        console.log('✅ Permiso de ubicación ya concedido');
      }
    } catch (error) {
      console.error('Error solicitando permiso de ubicación:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navTheme = {
    dark: false,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.cardBackground,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  if (!isAuthenticated) {
    return (
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#001219',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Registro' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Componente interno que tiene acceso al navigation
  const AuthenticatedStack = () => {
    const navigation = useNavigation();
    const isDeliveryPerson = role === 'deliveryPerson';
    
    return (
      <>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#001219',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          {isDeliveryPerson ? (
            // Navegación para repartidores
            <>
              <Stack.Screen
                name="DeliveryTabs"
                options={{ headerShown: false }}
              >
                {(props) => (
                  <DeliveryPersonTabs
                    {...props}
                    onOpenProfileMenu={() => setProfileMenuVisible(true)}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen
                name="DeliveryOrderDetail"
                component={DeliveryOrderDetailScreen}
                options={{ title: 'Detalle del Pedido' }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Mi Perfil' }}
              />
              <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{ title: 'Editar Perfil' }}
              />
            </>
          ) : (
            // Navegación para clientes
            <>
              <Stack.Screen
                name="HomeTabs"
                options={{ headerShown: false }}
              >
                {(props) => (
                  <CustomerTabs
                    {...props}
                    onOpenProfileMenu={() => setProfileMenuVisible(true)}
                  />
                )}
              </Stack.Screen>
              <Stack.Screen
                name="Checkout"
                component={CheckoutScreen}
                options={{ title: 'Confirmar Pedido' }}
              />
              <Stack.Screen
                name="OrderTracking"
                component={OrderTrackingScreen}
                options={{ title: 'Seguimiento de Pedido' }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Mi Perfil' }}
              />
              <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{ title: 'Editar Perfil' }}
              />
              <Stack.Screen
                name="Points"
                component={PointsScreen}
                options={{ title: 'Mis Puntos' }}
              />
            </>
          )}
        </Stack.Navigator>
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          stackNavigation={navigation}
        />
      </>
    );
  };

  return (
    <NavigationContainer theme={navTheme}>
      <AuthenticatedStack />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <ThemeProvider>
          <StatusBar barStyle="light-content" backgroundColor="#001219" />
          <AppNavigator />
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}
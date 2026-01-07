import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { View, ActivityIndicator, StyleSheet, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme as useAppTheme } from './context/ThemeContext';
import { store } from './redux/store';
import { checkAuth, logoutUser } from './redux/slices/authSlice';
import Toast from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import analytics from './services/analytics';
import './services/locationTask'; // Registrar tarea de ubicación en segundo plano
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ProfileScreen from './screens/ProfileScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import ProfileMenu from './components/ProfileMenu';
import DeliveryOrdersScreen from './screens/DeliveryOrdersScreen';
import DeliveryOrderDetailScreen from './screens/DeliveryOrderDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      // Check if the user is authorized (must be deliveryPerson)
      if (role && role !== 'deliveryPerson') {
         Alert.alert(
            'Acceso Denegado',
            'Esta aplicación es solo para repartidores.',
            [
              { text: 'Cerrar Sesión', onPress: () => dispatch(logoutUser()) }
            ]
         );
         return;
      }

      analytics.trackScreenView('DeliveryHome');
      requestLocationPermission();
    }
  }, [isAuthenticated, role]);

  const requestLocationPermission = async () => {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          try {
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            if (backgroundStatus === 'granted') {
              console.log('✅ Permiso de ubicación en segundo plano concedido');
            }
          } catch (error) {
            console.log('ℹ️ No se pudo solicitar permiso de segundo plano');
          }
        }
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
            headerStyle: { backgroundColor: '#001219' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          {/* Register might be hidden for pure delivery app if they are created by admin, but keeping it just in case */}
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Registro' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Pure Delivery Stack
  const AuthenticatedStack = () => {
    const navigation = useNavigation();
    
    // Safety check just in case, though handled by useEffect above
    if (role !== 'deliveryPerson') {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );  
    }

    return (
      <>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: '#001219' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
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
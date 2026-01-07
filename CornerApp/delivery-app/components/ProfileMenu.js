import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { logoutUser } from '../redux/slices/authSlice';
import { clearCart } from '../redux/slices/cartSlice';
import { Alert } from 'react-native';

const ProfileMenu = ({ visible, onClose, stackNavigation }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const { user, role } = useSelector((state) => state.auth);
  const isDeliveryPerson = role === 'deliveryPerson';
  
  // Usar directamente el stackNavigation que se pasa como prop
  const nav = stackNavigation;

  const handleLogout = () => {
    onClose();
    dispatch(clearCart());
    dispatch(logoutUser());
  };

  const menuOptions = [
    {
      id: 'profile',
      label: 'Ver Mi Perfil',
      icon: 'person-outline',
      onPress: () => {
        onClose();
        // Pequeño delay para asegurar que el modal se cierre antes de navegar
        setTimeout(() => {
          if (nav && nav.navigate) {
            console.log('Navigating to Profile');
            nav.navigate('Profile');
          } else {
            console.error('Navigation not available for Profile');
          }
        }, 300);
      },
    },
    // Solo mostrar puntos para clientes
    ...(isDeliveryPerson ? [] : [{
      id: 'points',
      label: 'Mis Puntos',
      icon: 'trophy-outline',
      onPress: () => {
        console.log('Points button pressed, closing menu first');
        onClose();
        // Pequeño delay para asegurar que el modal se cierre antes de navegar
        setTimeout(() => {
          if (nav && nav.navigate) {
            console.log('Navigating to Points');
            nav.navigate('Points');
          } else {
            console.error('Navigation not available for Points');
          }
        }, 300);
      },
    }]),
    {
      id: 'logout',
      label: 'Cerrar Sesión',
      icon: 'log-out-outline',
      onPress: handleLogout,
      destructive: true,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.menuHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Ionicons name="person" size={24} color="#fff" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: '#000000' }]}>
                    {user?.name || 'Usuario'}
                  </Text>
                  <Text style={[styles.userEmail, { color: '#4b5563' }]}>
                    {user?.email || user?.username || ''}
                  </Text>
                  {isDeliveryPerson && (
                    <Text style={[styles.userRole, { color: '#000000' }]}>
                      Repartidor
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              {menuOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.menuItem}
                  onPress={option.onPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={option.destructive ? colors.error : '#000000'}
                  />
                  <Text
                    style={[
                      styles.menuItemText,
                      {
                        color: option.destructive ? colors.error : '#000000',
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#4b5563"
                    style={styles.chevron}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: 16,
  },
  menu: {
    width: 280,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  menuItemText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
});

export default ProfileMenu;


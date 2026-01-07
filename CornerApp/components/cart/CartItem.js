import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch } from 'react-redux';
import { setItemComment } from '../../redux/slices/cartSlice';
import LazyImage from '../product/LazyImage';

const CartItem = React.memo(({ item, onRemove, onUpdateQuantity, delay = 0 }) => {
  const { colors } = useTheme();
  const dispatch = useDispatch();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [tempComment, setTempComment] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay: delay,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dynamicStyles = {
    card: { backgroundColor: colors.cardBackground },
    name: { color: colors.cardText || '#000000' },
    priceUnit: { color: colors.cardTextSecondary || '#666666' },
    subtotal: { color: colors.cardText || '#000000' },
    removeText: { color: colors.error || '#f44336' },
    quantityButton: { backgroundColor: '#e5e7eb' },
    quantityButtonText: { color: colors.cardText || '#000000' },
    quantity: { color: colors.cardText || '#000000' },
  };

  const handleDecrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    } else {
      onRemove(item.id);
    }
  };

  const handleIncrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  const handleRemovePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove(item.id);
  };

  return (
    <Animated.View
      style={[
        styles.card,
        dynamicStyles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      <LazyImage
        source={{ uri: item.image }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, dynamicStyles.name]}>{item.name}</Text>
          {item.isFreeReward && (
            <View style={[styles.freeBadge, { backgroundColor: colors.success || '#4CAF50' }]}>
              <Text style={styles.freeBadgeText}>🎁 GRATIS</Text>
            </View>
          )}
        </View>
        <Text style={[styles.priceUnit, dynamicStyles.priceUnit]}>
          {item.isFreeReward ? 'Gratis' : `$${item.price.toFixed(2)} c/u`}
        </Text>
        
        <View style={styles.controls}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              onPress={handleDecrease}
              style={[styles.quantityButton, dynamicStyles.quantityButton]}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={18} color={colors.cardText || '#000000'} />
            </TouchableOpacity>
            <Text style={[styles.quantity, dynamicStyles.quantity]}>{item.quantity}</Text>
            <TouchableOpacity
              onPress={handleIncrease}
              style={[styles.quantityButton, dynamicStyles.quantityButton]}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={colors.cardText || '#000000'} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.rightSection}>
            <Text style={[styles.subtotal, dynamicStyles.subtotal]}>
              {item.isFreeReward ? 'Gratis' : `$${(item.price * item.quantity).toFixed(2)}`}
            </Text>
            <TouchableOpacity
              onPress={handleRemovePress}
              style={styles.removeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[styles.removeText, dynamicStyles.removeText]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Botón de comentarios */}
        <TouchableOpacity
          style={styles.commentButton}
          onPress={() => {
            setTempComment(item.comment || '');
            setShowCommentsModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={16} color="#666666" />
          <Text style={styles.commentButtonText}>
            {item.comment ? 'Editar nota' : 'Agregar nota'}
          </Text>
          {item.comment && (
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de comentarios */}
      <Modal
        visible={showCommentsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground || '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: '#000000' }]}>
                📝 Nota para {item.name}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCommentsModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalLabel, { color: '#666666' }]}>
              Ej: Sin mayonesa, extra queso, etc.
            </Text>
            
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: '#ffffff',
                  borderColor: colors.border || '#e0e0e0',
                  color: '#000000',
                },
              ]}
              placeholder="Escribe una nota para este producto..."
              placeholderTextColor="#999999"
              multiline
              numberOfLines={4}
              value={tempComment}
              onChangeText={setTempComment}
              textAlignVertical="top"
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => {
                  setTempComment(item.comment || '');
                  setShowCommentsModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#666666' }]}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  dispatch(setItemComment({ productId: item.id, comment: tempComment }));
                  setShowCommentsModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    marginBottom: 16,
    padding: 16,
    flexDirection: 'row',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 8,
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  priceUnit: {
    fontSize: 14,
    marginBottom: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    marginHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  rightSection: {
    alignItems: 'flex-end',
    flex: 1,
  },
  subtotal: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  removeText: {
    fontSize: 12,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  commentButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  modalInput: {
    minHeight: 120,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  saveButton: {
    // backgroundColor se aplica dinámicamente
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

CartItem.displayName = 'CartItem';

export default CartItem;
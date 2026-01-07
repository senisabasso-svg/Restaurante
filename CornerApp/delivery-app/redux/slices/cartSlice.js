import { createSlice } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const loadCartDataFromStorage = async () => {
  try {
    const cartData = await AsyncStorage.getItem('cart');
    return cartData ? JSON.parse(cartData) : [];
  } catch (error) {
    console.error('Error loading cart from storage:', error);
    return [];
  }
};

const saveCartToStorage = async (cart) => {
  try {
    await AsyncStorage.setItem('cart', JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart to storage:', error);
  }
};

const initialState = {
  items: [],
  comments: '',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const product = action.payload;
      const existingItem = state.items.find(item => item.id === product.id);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...product, quantity: 1 });
      }
      
      saveCartToStorage(state.items);
    },
    removeFromCart: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter(item => item.id !== productId);
      saveCartToStorage(state.items);
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const item = state.items.find(item => item.id === id);
      
      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter(item => item.id !== id);
        } else {
          item.quantity = quantity;
        }
      }
      
      saveCartToStorage(state.items);
    },
    clearCart: (state) => {
      state.items = [];
      state.comments = '';
      saveCartToStorage([]);
    },
    setComments: (state, action) => {
      state.comments = action.payload;
    },
    setItemComment: (state, action) => {
      const { productId, comment } = action.payload;
      const item = state.items.find(item => item.id === productId);
      if (item) {
        item.comment = comment;
        saveCartToStorage(state.items);
      }
    },
    loadCartFromStorage: (state, action) => {
      state.items = action.payload;
    },
  },
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, setComments, setItemComment, loadCartFromStorage } = cartSlice.actions;

// Función para inicializar el carrito desde AsyncStorage
export const initializeCart = () => {
  return async (dispatch) => {
    const cartData = await loadCartDataFromStorage();
    dispatch(loadCartFromStorage(cartData));
  };
};

export default cartSlice.reducer;

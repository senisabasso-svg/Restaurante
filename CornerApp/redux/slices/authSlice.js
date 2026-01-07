import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { secureStorage } from '../../services/secureStorage';
import { login, register, verifyToken, updateProfile, loginDeliveryPerson as loginDeliveryPersonService, verifyDeliveryPersonToken } from '../../services/auth';

// Thunk para login de clientes
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      console.log('🔄 Redux: Iniciando login para:', email);
      const response = await login(email, password);
      console.log('✅ Redux: Login exitoso, guardando token y usuario');
      await secureStorage.setToken(response.token);
      await secureStorage.setUser(response.user);
      await secureStorage.setRole('customer');
      return { ...response, role: 'customer' };
    } catch (error) {
      console.error('❌ Redux: Error en login:', error);
      console.error('❌ Redux: Detalles completos del error:', {
        message: error.message,
        status: error.status,
        response: error.response?.data,
        responseStatus: error.response?.status,
      });
      
      // Manejar errores de conexión
      if (error.message === 'BACKEND_UNAVAILABLE' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('timeout')) {
        const errorMsg = 'No se puede conectar al servidor. Verifica tu conexión a internet y que el backend esté corriendo.';
        console.error('❌ Error de conexión:', errorMsg);
        return rejectWithValue(errorMsg);
      }
      
      // Manejar errores del backend (puede venir de error.response o directamente del error)
      let errorMessage = 'Error al iniciar sesión';
      
      if (error.response?.data) {
        // Intentar extraer el mensaje de error de diferentes formatos posibles
        errorMessage = error.response.data.error || 
                      error.response.data.message || 
                      error.response.data.title ||
                      JSON.stringify(error.response.data);
        console.error('❌ Error del backend (400):', error.response.data);
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('❌ Error final a mostrar:', errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Thunk para login de repartidores
export const loginDeliveryPerson = createAsyncThunk(
  'auth/loginDeliveryPerson',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const response = await loginDeliveryPersonService(username, password);
      await secureStorage.setToken(response.token);
      await secureStorage.setUser(response.deliveryPerson);
      await secureStorage.setRole('deliveryPerson');
      return { ...response, role: 'deliveryPerson', user: response.deliveryPerson };
    } catch (error) {
      // Manejar errores de conexión
      if (error.message === 'BACKEND_UNAVAILABLE' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        return rejectWithValue('No se puede conectar al servidor. Verifica tu conexión a internet y que el backend esté corriendo.');
      }
      // Manejar errores del backend
      if (error.response?.data?.error) {
        return rejectWithValue(error.response.data.error);
      }
      // Error genérico
      return rejectWithValue(error.message || 'Error al iniciar sesión');
    }
  }
);

// Thunk para registro
export const registerUser = createAsyncThunk(
  'auth/register',
  async ({ name, email, password, phone, defaultAddress }, { rejectWithValue }) => {
    try {
      const response = await register(name, email, password, phone, defaultAddress);
      await secureStorage.setToken(response.token);
      await secureStorage.setUser(response.user);
      await secureStorage.setRole('customer');
      return { ...response, role: 'customer' };
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al registrarse');
    }
  }
);

// Thunk para verificar token al iniciar la app
export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const token = await secureStorage.getToken();
      const user = await secureStorage.getUser();
      const role = await secureStorage.getRole();
      
      if (!token || !user || !role) {
        return null;
      }

      // Verificar token con el backend según el rol
      let verifiedUser;
      if (role === 'deliveryPerson') {
        verifiedUser = await verifyDeliveryPersonToken(token);
      } else {
        verifiedUser = await verifyToken(token);
      }
      
      // Guardar usuario actualizado en SecureStore
      await secureStorage.setUser(verifiedUser);
      return { token, user: verifiedUser, role };
    } catch (error) {
      // Si el token es inválido, limpiar storage
      await secureStorage.clearAll();
      return null;
    }
  }
);

// Thunk para logout
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async () => {
    await secureStorage.clearAll();
  }
);

// Thunk para actualizar perfil
export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const updatedUser = await updateProfile(profileData);
      await secureStorage.setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || 'Error al actualizar el perfil');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    role: null, // 'customer' o 'deliveryPerson'
    isAuthenticated: false,
    isLoading: true,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.role = action.payload.role || 'customer';
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.role = action.payload.role || 'customer';
        state.error = null;
      })
      // Login Delivery Person
      .addCase(loginDeliveryPerson.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginDeliveryPerson.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.role = action.payload.role || 'deliveryPerson';
        state.error = null;
      })
      .addCase(loginDeliveryPerson.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.error = action.payload;
      })
      // Check Auth
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.role = action.payload.role || 'customer';
        } else {
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.role = null;
        }
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.role = null;
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.role = null;
        state.error = null;
      })
      // Update Profile
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;


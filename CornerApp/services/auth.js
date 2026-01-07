import apiClient from './api';

export const login = async (email, password) => {
  try {
    console.log('🔐 Intentando login con email:', email);
    const requestData = {
      Email: email, // Usar mayúscula para coincidir con el DTO de C#
      Password: password,
    };
    console.log('📤 Datos enviados al backend:', { Email: email, Password: '***' });
    const response = await apiClient.post('/api/auth/login', requestData);
    console.log('✅ Login exitoso, respuesta:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error en login:', error);
    console.error('❌ Detalles del error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code,
    });
    
    // Extraer mensaje de error del backend si está disponible
    if (error.response?.data?.error) {
      const backendError = new Error(error.response.data.error);
      backendError.status = error.response.status;
      throw backendError;
    }
    
    // Si es un error 400, puede ser un problema de validación
    if (error.response?.status === 400) {
      const validationError = error.response?.data?.error || 
                             error.response?.data?.message || 
                             'Datos inválidos. Verifica tu email y contraseña.';
      const backendError = new Error(validationError);
      backendError.status = 400;
      throw backendError;
    }
    
    // Re-lanzar el error para que el interceptor lo maneje
    throw error;
  }
};

export const register = async (name, email, password, phone, defaultAddress) => {
  const response = await apiClient.post('/api/auth/register', {
    name,
    email,
    password,
    phone: phone || '',
    defaultAddress: defaultAddress || '',
  });
  return response.data;
};

export const verifyToken = async (token) => {
  const response = await apiClient.post(
    '/api/auth/verify',
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.user;
};

export const updateProfile = async (profileData) => {
  const response = await apiClient.put('/api/auth/profile', profileData);
  return response.data.user;
};

// Funciones para repartidores
export const loginDeliveryPerson = async (username, password) => {
  const response = await apiClient.post('/api/DeliveryPerson/login', {
    username,
    password,
  });
  return response.data;
};

export const verifyDeliveryPersonToken = async (token) => {
  const response = await apiClient.post(
    '/api/DeliveryPerson/verify',
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data.deliveryPerson;
};


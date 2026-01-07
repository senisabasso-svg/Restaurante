import React, { useState, useEffect, useRef } from 'react';
import { Image, View, ActivityIndicator, StyleSheet, Animated, Platform } from 'react-native';

// Función para convertir URL relativa a absoluta
const getAbsoluteImageUrl = (uri) => {
  if (!uri) return uri;
  
  // Si ya es una URL absoluta (http/https), devolverla tal cual
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }
  
  // Si es una URL relativa, convertirla a absoluta
  // Usar la misma IP que api.js (se puede mejorar para detectar automáticamente)
  // Para desarrollo local, ajusta esta IP según tu configuración
  const API_BASE_URL = __DEV__ 
    ? 'http://192.168.1.7:5000' // Cambia esta IP por la de tu servidor local
    : 'https://tu-backend.com';
  
  // Si la URL relativa no empieza con /, agregarla
  const relativePath = uri.startsWith('/') ? uri : `/${uri}`;
  return `${API_BASE_URL}${relativePath}`;
};

const LazyImage = ({ source, style, resizeMode = 'cover', refreshKey, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loaded]);

  // Resetear estado cuando cambia la imagen o refreshKey
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [source?.uri, refreshKey]);

  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = (error) => {
    console.error('Error cargando imagen:', source?.uri, error);
    setError(true);
    setLoaded(true); // Mostrar placeholder
  };

  // Agregar parámetro de caché a la URL para forzar actualización
  const getImageSource = () => {
    if (!source || !source.uri) return source;
    
    // Convertir URL relativa a absoluta si es necesario
    let uri = getAbsoluteImageUrl(source.uri);
    
    const separator = uri.includes('?') ? '&' : '?';
    // Usar refreshKey si está disponible, sino usar timestamp que cambia cada minuto
    const cacheBuster = refreshKey !== undefined ? refreshKey : Math.floor(Date.now() / (1000 * 60));
    return {
      ...source,
      uri: `${uri}${separator}_t=${cacheBuster}`,
    };
  };

  return (
    <View style={[style, styles.container]}>
      {!loaded && !error && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <ActivityIndicator size="small" color="#ea580c" />
        </View>
      )}
      {error && (
        <View style={[StyleSheet.absoluteFill, styles.errorPlaceholder]}>
          <View style={styles.placeholderIcon} />
        </View>
      )}
      <Animated.Image
        source={getImageSource()}
        style={[style, { opacity: fadeAnim }]}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPlaceholder: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#d1d5db',
    borderRadius: 4,
  },
});

export default LazyImage;

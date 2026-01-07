/**
 * Servicio de geocodificación para convertir direcciones a coordenadas
 * Usa OpenStreetMap Nominatim API (gratuita, sin API key requerida)
 */

/**
 * Geocodifica una dirección a coordenadas (lat, lng)
 * @param {string} address - Dirección a geocodificar (ej: "Uruguay 1223, Salto, Uruguay")
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export const geocodeAddress = async (address) => {
  try {
    // Agregar "Salto, Uruguay" si no está incluido para mejorar la precisión
    let searchQuery = address.trim();
    const lowerAddress = searchQuery.toLowerCase();
    
    // Si no menciona Salto ni Uruguay, agregar ambos
    if (!lowerAddress.includes('salto') && !lowerAddress.includes('uruguay')) {
      searchQuery = `${searchQuery}, Salto, Uruguay`;
    }
    // Si menciona Uruguay pero no Salto, agregar Salto
    else if (lowerAddress.includes('uruguay') && !lowerAddress.includes('salto')) {
      // Insertar Salto antes de Uruguay
      const parts = searchQuery.split(',');
      const lastPart = parts[parts.length - 1].trim();
      if (lastPart.toLowerCase().includes('uruguay')) {
        searchQuery = `${parts.slice(0, -1).join(',').trim()}, Salto, ${lastPart}`.replace(/^,\s*/, '');
      } else {
        searchQuery = `${searchQuery}, Salto, Uruguay`;
      }
    }
    
    const encodedAddress = encodeURIComponent(searchQuery);
    
    // Usar OpenStreetMap Nominatim (API gratuita)
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CornerApp-Delivery/1.0', // Requerido por Nominatim
      },
    });
    
    if (!response.ok) {
      console.error('Error en geocodificación:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.warn('No se encontraron resultados para la dirección:', address);
      return null;
    }
    
    const result = data[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      console.error('Coordenadas inválidas:', result);
      return null;
    }
    
    console.log(`Dirección geocodificada: "${address}" -> (${latitude}, ${longitude})`);
    
    return {
      latitude,
      longitude,
    };
  } catch (error) {
    console.error('Error al geocodificar dirección:', error);
    return null;
  }
};

/**
 * Geocodifica múltiples direcciones
 * @param {string[]} addresses - Array de direcciones
 * @returns {Promise<Array<{address: string, coordinates: {latitude: number, longitude: number} | null}>>}
 */
export const geocodeAddresses = async (addresses) => {
  const results = await Promise.all(
    addresses.map(async (address) => {
      const coordinates = await geocodeAddress(address);
      return {
        address,
        coordinates,
      };
    })
  );
  
  return results;
};


/**
 * Datos mock hardcodeados para demostración
 * Se usan cuando el backend no está disponible
 */

export const MOCK_USER = {
  id: 1,
  restaurantId: 12,
  restaurantName: "Corner Restaurant",
  username: "corner",
  email: "corner@cornerapp.com",
  name: "Corner Admin",
  role: "Admin",
  isSuperAdmin: false
};

export const MOCK_TOKEN = "mock-jwt-token-for-demo-purposes-only";

export const MOCK_RESTAURANT = {
  id: 12,
  name: "Corner Restaurant",
  identifier: "corner",
  address: "Dirección de demostración",
  phone: "123456789",
  email: "corner@cornerapp.com",
  isActive: true
};

export const MOCK_CATEGORY = {
  id: 1,
  restaurantId: 12,
  name: "Bebidas",
  description: "Categoría de bebidas",
  displayOrder: 1,
  isActive: true
};

export const MOCK_PRODUCT = {
  id: 1,
  restaurantId: 12,
  name: "Coca Cola",
  description: "Bebida gaseosa",
  price: 500,
  categoryId: 1,
  displayOrder: 1,
  isAvailable: true,
  image: ""
};

export const MOCK_SUBPRODUCT = {
  id: 1,
  productId: 1,
  name: "Tamaño Grande",
  description: "Vaso grande de 500ml",
  price: 100,
  displayOrder: 1,
  isAvailable: true
};

export const MOCK_SPACE = {
  id: 1,
  restaurantId: 12,
  name: "Sala Principal",
  description: "Área principal del restaurante",
  isActive: true
};

export const MOCK_TABLES = [
  {
    id: 1,
    restaurantId: 12,
    number: "1",
    capacity: 4,
    location: "Frente",
    status: "Available",
    spaceId: 1,
    isActive: true
  },
  {
    id: 2,
    restaurantId: 12,
    number: "2",
    capacity: 2,
    location: "Fondo",
    status: "Available",
    spaceId: 1,
    isActive: true
  }
];

export const MOCK_PRODUCTS = [MOCK_PRODUCT];
export const MOCK_SUBPRODUCTS = [MOCK_SUBPRODUCT];
export const MOCK_SPACES = [MOCK_SPACE];

// Función para simular delay de red
export const mockDelay = (ms: number = 500) => new Promise(resolve => setTimeout(resolve, ms));

# 📋 Checklist de Testing - CornerApp

## 🎯 Objetivo
Testing exhaustivo antes de lanzar a producción

---

## 1. ✅ AUTENTICACIÓN Y REGISTRO

### Login
- [ ] Login con email y contraseña correctos
- [ ] Login con credenciales incorrectas (mostrar error)
- [ ] Validación de campos vacíos
- [ ] Validación de formato de email
- [ ] Botón "Recordarme" funciona
- [ ] Navegación a pantalla de registro
- [ ] Sesión persiste al cerrar y abrir la app

### Registro
- [ ] Registro con datos válidos
- [ ] Validación de campos requeridos
- [ ] Validación de formato de email
- [ ] Validación de contraseña (mínimo caracteres)
- [ ] Confirmación de contraseña coincide
- [ ] Selección de tipo de usuario (Cliente/Repartidor)
- [ ] Manejo de errores del servidor
- [ ] Redirección automática después del registro

### Logout
- [ ] Logout desde el menú de perfil
- [ ] Limpieza de datos de sesión
- [ ] Redirección a pantalla de login
- [ ] Carrito se limpia al hacer logout

---

## 2. 👤 PERFIL DE USUARIO

### Ver Perfil
- [ ] Muestra nombre, email, teléfono correctamente
- [ ] Muestra rol del usuario
- [ ] Muestra foto de perfil (si existe)
- [ ] Navegación a "Editar Perfil"
- [ ] Navegación a "Mis Puntos"
- [ ] Navegación a "Mis Pedidos"

### Editar Perfil
- [ ] Editar nombre
- [ ] Editar teléfono
- [ ] Editar email
- [ ] Cambiar foto de perfil
- [ ] Validación de campos
- [ ] Guardar cambios exitosamente
- [ ] Mensaje de confirmación
- [ ] Actualización reflejada en pantalla de perfil

### Cambiar Contraseña
- [ ] Validación de contraseña actual
- [ ] Validación de nueva contraseña
- [ ] Confirmación de nueva contraseña
- [ ] Mensaje de éxito/error

---

## 3. 🍕 PRODUCTOS Y MENÚ

### Listar Productos
- [ ] Carga de productos desde el servidor
- [ ] Mostrar imagen, nombre, precio, descripción
- [ ] Indicador de carga mientras carga
- [ ] Manejo de error si falla la carga
- [ ] Scroll fluido con muchos productos

### Buscar Productos
- [ ] Búsqueda por nombre
- [ ] Búsqueda en tiempo real
- [ ] Resultados filtrados correctamente
- [ ] Mensaje cuando no hay resultados
- [ ] Limpiar búsqueda

### Ver Detalles de Producto
- [ ] Ver imagen completa
- [ ] Ver descripción completa
- [ ] Ver precio
- [ ] Agregar al carrito desde detalles
- [ ] Seleccionar cantidad antes de agregar

### Filtros y Categorías
- [ ] Filtrar por categoría
- [ ] Mostrar todos los productos
- [ ] UI de filtros funciona correctamente

---

## 4. 🛒 CARRITO DE COMPRAS

### Agregar Productos
- [ ] Agregar producto desde menú
- [ ] Agregar producto desde detalles
- [ ] Actualizar cantidad en carrito
- [ ] Badge en tab muestra cantidad correcta
- [ ] Total se calcula correctamente

### Modificar Carrito
- [ ] Aumentar cantidad de producto
- [ ] Disminuir cantidad de producto
- [ ] Eliminar producto del carrito
- [ ] Vaciar carrito completo
- [ ] Total se actualiza en tiempo real

### Persistencia
- [ ] Carrito persiste al cerrar app
- [ ] Carrito persiste al cambiar de pantalla
- [ ] Carrito se limpia después de orden completada

### Validaciones
- [ ] No permitir cantidad 0 o negativa
- [ ] Mostrar mensaje si carrito está vacío
- [ ] Botón "Ir a Checkout" deshabilitado si carrito vacío

---

## 5. 💳 CHECKOUT Y PEDIDOS

### Formulario de Checkout
- [ ] Mostrar resumen de productos
- [ ] Mostrar total correcto
- [ ] Seleccionar método de pago (Efectivo/Tarjeta)
- [ ] Ingresar dirección de entrega
- [ ] Validación de campos requeridos
- [ ] Campo de comentarios (opcional)

### Crear Pedido
- [ ] Crear pedido exitosamente
- [ ] Mostrar confirmación
- [ ] Redirección a seguimiento de pedido
- [ ] Carrito se limpia después de crear pedido
- [ ] Manejo de errores (sin conexión, servidor, etc.)

### Métodos de Pago
- [ ] Selección de efectivo funciona
- [ ] Selección de tarjeta funciona
- [ ] UI muestra método seleccionado

---

## 6. 📦 SEGUIMIENTO DE PEDIDOS

### Ver Mis Pedidos
- [ ] Lista todos los pedidos del usuario
- [ ] Muestra estado de cada pedido
- [ ] Muestra fecha y hora
- [ ] Muestra total
- [ ] Ordenados por fecha (más recientes primero)
- [ ] Pull to refresh funciona

### Detalles del Pedido
- [ ] Ver todos los productos del pedido
- [ ] Ver información del cliente
- [ ] Ver dirección de entrega
- [ ] Ver método de pago
- [ ] Ver comentarios (si existen)
- [ ] Ver estado actual

### Seguimiento en Tiempo Real
- [ ] Actualización automática de estado
- [ ] Mapa muestra ubicación (si aplica)
- [ ] Estados: Pendiente → Confirmado → En Preparación → En Camino → Completado
- [ ] Tiempo estimado de entrega
- [ ] Notificaciones de cambio de estado

---

## 7. 🚴 FUNCIONALIDAD DE REPARTIDOR

### Ver Pedidos Asignados
- [ ] Lista solo pedidos asignados al repartidor
- [ ] Muestra estado de cada pedido
- [ ] Badge muestra cantidad de pedidos
- [ ] Actualización en tiempo real

### Detalles del Pedido (Repartidor)
- [ ] Ver información completa del cliente
- [ ] Ver dirección de entrega
- [ ] Ver productos del pedido
- [ ] Ver comentarios
- [ ] Ver mapa con ubicación
- [ ] Navegación GPS funciona

### Actualizar Estado
- [ ] Cambiar estado a "En Camino"
- [ ] Cambiar estado a "Completado"
- [ ] Actualización se refleja en tiempo real
- [ ] Cliente ve actualización

---

## 8. 🎁 SISTEMA DE PUNTOS

### Ver Puntos
- [ ] Muestra puntos acumulados correctamente
- [ ] Muestra historial de puntos
- [ ] Cálculo correcto de puntos ganados

### Canjear Recompensas
- [ ] Lista de recompensas disponibles
- [ ] Muestra puntos requeridos
- [ ] Validar puntos suficientes
- [ ] Canjear recompensa exitosamente
- [ ] Puntos se descuentan correctamente
- [ ] Mensaje de confirmación

---

## 9. 🎛️ ADMIN DASHBOARD

### Acceso
- [ ] Login como admin funciona
- [ ] Dashboard solo accesible para admins
- [ ] Redirección si no es admin

### Ver Pedidos
- [ ] Lista todos los pedidos
- [ ] Filtros por estado funcionan
- [ ] Búsqueda de pedidos
- [ ] Ordenar por fecha
- [ ] Paginación funciona
- [ ] Vista de tabla y vista de tarjetas

### Crear Pedido Manual
- [ ] Abrir modal de creación
- [ ] Ingresar datos del cliente
- [ ] Buscar y seleccionar productos
- [ ] Modificar cantidades
- [ ] Agregar comentarios
- [ ] Calcular total correctamente
- [ ] Crear pedido exitosamente
- [ ] Autocompletar en teléfono, email, dirección

### Gestionar Pedidos
- [ ] Cambiar estado de pedido
- [ ] Asignar repartidor
- [ ] Actualizar tiempo estimado
- [ ] Ver comentarios del pedido
- [ ] Archivar pedido
- [ ] Restaurar pedido archivado
- [ ] Eliminar pedido permanentemente

### Reportes
- [ ] Ver ingresos por período
- [ ] Ver productos más vendidos
- [ ] Ver estadísticas generales
- [ ] Filtros de fecha funcionan
- [ ] Tabla de productos vendidos
- [ ] Totales correctos
- [ ] Alineación de números correcta

### Sección de Pedidos Activos
- [ ] Muestra solo pedidos activos (no completados/cancelados)
- [ ] Cards horizontales compactas
- [ ] Actualización en tiempo real
- [ ] Navegación desde dashboard principal

---

## 10. 🔧 BACKEND Y APIs

### Endpoints de Autenticación
- [ ] POST /api/auth/login
- [ ] POST /api/auth/register
- [ ] POST /api/auth/logout
- [ ] GET /api/auth/me

### Endpoints de Productos
- [ ] GET /api/products
- [ ] GET /api/products/:id

### Endpoints de Pedidos
- [ ] POST /api/orders
- [ ] GET /api/orders
- [ ] GET /api/orders/:id
- [ ] PUT /api/orders/:id/status
- [ ] POST /admin/api/orders/create

### Endpoints de Repartidor
- [ ] GET /api/delivery/orders
- [ ] GET /api/delivery/orders/:id
- [ ] PUT /api/delivery/orders/:id/status

### Validaciones
- [ ] Validación de datos de entrada
- [ ] Manejo de errores 400, 401, 403, 404, 500
- [ ] Mensajes de error claros

### Base de Datos
- [ ] Migraciones aplicadas correctamente
- [ ] Relaciones entre tablas funcionan
- [ ] Constraints funcionan
- [ ] Índices optimizados

---

## 11. 🚨 CASOS EDGE Y ERRORES

### Sin Conexión
- [ ] Mensaje cuando no hay internet
- [ ] Datos en caché se muestran
- [ ] Sincronización al recuperar conexión
- [ ] No crashea la app

### Datos Inválidos
- [ ] Email inválido
- [ ] Teléfono inválido
- [ ] Campos vacíos
- [ ] Caracteres especiales
- [ ] Límites de caracteres

### Límites
- [ ] Cantidad máxima de productos
- [ ] Tamaño máximo de imagen
- [ ] Límite de caracteres en comentarios
- [ ] Timeout de requests

### Estados Inesperados
- [ ] Pedido cancelado mientras se ve
- [ ] Producto eliminado del menú
- [ ] Sesión expirada
- [ ] Permisos insuficientes

---

## 12. 🎨 UI/UX

### Colores y Tema
- [ ] Colores correctos según diseño
- [ ] Texto legible (contraste adecuado)
- [ ] Iconos visibles
- [ ] Botones con colores correctos (#ea580c, #f97316)
- [ ] Texto blanco en botones naranja

### Responsive Design
- [ ] Funciona en diferentes tamaños de pantalla
- [ ] Orientación vertical y horizontal
- [ ] Elementos no se superponen
- [ ] Scroll funciona correctamente

### Navegación
- [ ] Navegación intuitiva
- [ ] Botones de retroceso funcionan
- [ ] Tabs funcionan correctamente
- [ ] Deep linking (si aplica)

### Feedback Visual
- [ ] Loading indicators
- [ ] Mensajes de éxito
- [ ] Mensajes de error claros
- [ ] Toasts/notificaciones
- [ ] Animaciones suaves

### Accesibilidad
- [ ] Tamaños de fuente legibles
- [ ] Áreas táctiles adecuadas
- [ ] Contraste suficiente

---

## 13. ⚡ PERFORMANCE

### Tiempos de Carga
- [ ] Pantalla inicial carga rápido (< 2s)
- [ ] Lista de productos carga rápido
- [ ] Imágenes se cargan progresivamente
- [ ] No hay lag al hacer scroll

### Optimización
- [ ] Imágenes optimizadas
- [ ] Lazy loading donde aplica
- [ ] Memoria no aumenta constantemente
- [ ] No hay memory leaks

### Recursos
- [ ] Uso eficiente de batería
- [ ] Uso eficiente de datos
- [ ] Caché funciona correctamente

---

## 14. 🔒 SEGURIDAD

### Autenticación
- [ ] Tokens JWT funcionan
- [ ] Tokens expiran correctamente
- [ ] Refresh tokens (si aplica)
- [ ] Logout invalida tokens

### Autorización
- [ ] Clientes solo ven sus pedidos
- [ ] Repartidores solo ven sus pedidos asignados
- [ ] Admins tienen acceso completo
- [ ] Validación de roles en backend

### Datos Sensibles
- [ ] Contraseñas no se almacenan en texto plano
- [ ] Tokens no se exponen en logs
- [ ] HTTPS en producción
- [ ] Validación de entrada en servidor

### Validación
- [ ] SQL injection prevenido
- [ ] XSS prevenido
- [ ] CSRF tokens (si aplica)

---

## 15. 📱 DISPOSITIVOS Y PLATAFORMAS

### Android
- [ ] Funciona en Android 8+
- [ ] Permisos de ubicación
- [ ] Permisos de cámara (foto de perfil)
- [ ] Notificaciones push (si aplica)

### iOS
- [ ] Funciona en iOS 12+
- [ ] Permisos de ubicación
- [ ] Permisos de cámara
- [ ] Notificaciones push

### Diferentes Dispositivos
- [ ] Teléfonos pequeños
- [ ] Teléfonos grandes
- [ ] Tablets (si aplica)

---

## 16. 🧪 TESTING ADICIONAL

### Flujos Completos
- [ ] Flujo completo: Registro → Ver Menú → Agregar al Carrito → Checkout → Seguimiento
- [ ] Flujo repartidor: Login → Ver Pedidos → Actualizar Estado → Completar
- [ ] Flujo admin: Login → Ver Dashboard → Crear Pedido → Gestionar → Ver Reportes

### Integración
- [ ] Integración entre app móvil y dashboard web
- [ ] Actualizaciones en tiempo real funcionan
- [ ] Sincronización de datos

### Regresión
- [ ] Funcionalidades anteriores siguen funcionando
- [ ] No se rompió nada con nuevos cambios

---

## 📝 NOTAS DE TESTING

### Ambiente de Testing
- Backend: `http://localhost:5000` (desarrollo)
- Base de datos: SQL Server (local)
- App: Expo Go

### Usuarios de Prueba
- Cliente: [crear usuario de prueba]
- Repartidor: [crear usuario de prueba]
- Admin: [crear usuario de prueba]

### Bugs Encontrados
[Documentar aquí los bugs encontrados durante el testing]

---

## ✅ CRITERIOS DE APROBACIÓN PARA PRODUCCIÓN

- [ ] Todos los flujos críticos funcionan
- [ ] No hay bugs críticos o bloqueantes
- [ ] Performance es aceptable
- [ ] UI/UX es consistente
- [ ] Seguridad básica implementada
- [ ] Backend estable y probado
- [ ] Base de datos optimizada
- [ ] Documentación actualizada

---

**Fecha de Testing:** _______________
**Tester:** _______________
**Versión:** _______________


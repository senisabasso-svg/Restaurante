# 🧪 Guía Rápida de Testing - CornerApp

## 🚀 Configuración Inicial

### 1. Preparar Ambiente de Testing

```bash
# Asegúrate de tener el backend corriendo
cd backend-csharp/CornerApp.API
dotnet run

# En otra terminal, inicia la app móvil
cd D:\CornerApp
npm start
```

### 2. Crear Usuarios de Prueba

**Cliente de Prueba:**
- Email: `cliente@test.com`
- Contraseña: `Test123!`
- Rol: Cliente

**Repartidor de Prueba:**
- Email: `repartidor@test.com`
- Contraseña: `Test123!`
- Rol: Repartidor

**Admin de Prueba:**
- Email: `admin@test.com`
- Contraseña: `Admin123!`
- Rol: Admin

---

## 📱 Testing en Expo Go

### Conectar Dispositivo

1. Abre Expo Go en tu celular
2. Escanea el QR que aparece en la terminal
3. La app se cargará automáticamente

### Hot Reload

- Los cambios se reflejan automáticamente
- Presiona `r` en la terminal para recargar
- Presiona `m` para abrir el menú de desarrollador

---

## 🎯 Casos de Prueba Prioritarios

### 🔴 CRÍTICOS (Hacer Primero)

#### 1. Flujo de Pedido Completo
```
1. Login como cliente
2. Ir a Menú
3. Agregar 2-3 productos al carrito
4. Ir a Carrito, verificar totales
5. Ir a Checkout
6. Llenar formulario (dirección, método de pago)
7. Agregar comentario
8. Crear pedido
9. Verificar que aparece en "Mis Pedidos"
10. Ver seguimiento en tiempo real
```

#### 2. Admin - Crear Pedido Manual
```
1. Login como admin
2. Ir a Dashboard
3. Click en "➕ Crear"
4. Llenar datos del cliente
5. Buscar y agregar productos
6. Agregar comentarios
7. Crear pedido
8. Verificar que aparece en la lista
9. Verificar que se puede cambiar estado
10. Verificar que se puede asignar repartidor
```

#### 3. Repartidor - Gestionar Pedido
```
1. Login como repartidor
2. Ver pedidos asignados
3. Abrir detalle de un pedido
4. Ver mapa y ubicación
5. Cambiar estado a "En Camino"
6. Cambiar estado a "Completado"
7. Verificar que cliente ve actualización
```

#### 4. Verificación de Comentarios
```
1. Crear pedido con comentarios (desde app o dashboard)
2. Verificar que comentarios aparecen en:
   - Tabla de pedidos (columna "Comentarios")
   - Tarjetas de pedidos (cuadro destacado)
   - Detalle del pedido
3. Verificar que se muestran al confirmar pedido
```

---

### 🟡 IMPORTANTES (Hacer Segundo)

#### 5. Sistema de Puntos
```
1. Hacer un pedido
2. Verificar que se otorgan puntos
3. Ir a "Mis Puntos"
4. Ver historial
5. Intentar canjear una recompensa
```

#### 6. Perfil y Edición
```
1. Ver perfil
2. Editar nombre y teléfono
3. Cambiar foto de perfil
4. Guardar cambios
5. Verificar que se actualizó
```

#### 7. Reportes del Dashboard
```
1. Login como admin
2. Ir a "📊 Informes"
3. Verificar ingresos por período
4. Verificar productos más vendidos
5. Verificar que cuenta todos los pedidos completados
6. Verificar alineación de números
```

#### 8. Pedidos Activos
```
1. Login como admin
2. Click en "📋 Activos"
3. Verificar que solo muestra pedidos activos
4. Verificar que cards son horizontales y compactas
5. Verificar actualización en tiempo real
```

---

### 🟢 COMPLEMENTARIOS (Hacer Tercero)

#### 9. Búsqueda y Filtros
```
1. Buscar productos por nombre
2. Filtrar por categoría
3. Verificar resultados
```

#### 10. Carrito
```
1. Agregar productos
2. Modificar cantidades
3. Eliminar productos
4. Verificar totales
5. Vaciar carrito
```

#### 11. Casos Edge
```
1. Intentar checkout con carrito vacío
2. Intentar login con credenciales incorrectas
3. Perder conexión y ver comportamiento
4. Ingresar datos inválidos en formularios
```

---

## 🐛 Cómo Reportar Bugs

### Template de Bug Report

```
**Título:** [Descripción breve]

**Severidad:** 🔴 Crítico / 🟡 Medio / 🟢 Bajo

**Pasos para Reproducir:**
1. 
2. 
3. 

**Comportamiento Esperado:**
[Qué debería pasar]

**Comportamiento Actual:**
[Qué está pasando]

**Dispositivo:**
- Modelo: 
- OS: 
- Versión de Expo Go: 

**Screenshots:**
[Si aplica]

**Logs:**
[Errores de consola si hay]
```

---

## ✅ Checklist Rápido Pre-Producción

Antes de considerar listo para producción, verifica:

- [ ] ✅ Flujo completo de pedido funciona
- [ ] ✅ Admin puede crear pedidos manuales
- [ ] ✅ Comentarios se muestran correctamente
- [ ] ✅ Reportes cuentan todos los pedidos
- [ ] ✅ Repartidor puede gestionar pedidos
- [ ] ✅ No hay errores en consola
- [ ] ✅ Performance es aceptable
- [ ] ✅ UI se ve bien en diferentes pantallas
- [ ] ✅ Backend responde correctamente
- [ ] ✅ Base de datos funciona sin errores

---

## 🔍 Herramientas Útiles

### React Native Debugger
- Presiona `j` en la terminal para abrir debugger
- Útil para ver Redux state y logs

### Chrome DevTools
- Conecta para ver network requests
- Útil para debuggear APIs

### Backend Logs
- Revisa logs en la terminal del backend
- Útil para ver errores del servidor

---

## 📊 Métricas a Verificar

### Performance
- Tiempo de carga inicial: < 2 segundos
- Tiempo de carga de productos: < 1 segundo
- Scroll fluido sin lag

### Funcionalidad
- Tasa de éxito de pedidos: 100%
- Actualización de estados: < 2 segundos
- Sincronización: Funciona correctamente

---

## 🎯 Priorización

**Semana 1: Testing Crítico**
- Flujos principales
- Funcionalidades core
- Bugs bloqueantes

**Semana 2: Testing Completo**
- Todas las funcionalidades
- Casos edge
- UI/UX

**Semana 3: Testing Final**
- Regresión
- Performance
- Seguridad

---

## 💡 Tips de Testing

1. **Prueba como usuario real**: No solo como desarrollador
2. **Prueba en diferentes condiciones**: Con/sin internet, diferentes horas
3. **Prueba con datos reales**: No solo con datos de prueba simples
4. **Documenta todo**: Bugs, observaciones, mejoras
5. **Prueba en diferentes dispositivos**: Si es posible

---

**¡Buena suerte con el testing! 🚀**


# 🍕 Dashboard Web - CornerApp Pizzería

## 📋 Descripción

Dashboard web simple para que la pizzería pueda ver todos los pedidos en tiempo real desde cualquier navegador.

## 🚀 Cómo acceder

### Paso 1: Inicia el backend
```bash
cd backend-csharp\CornerApp.API
dotnet run
```

### Paso 2: Abre tu navegador
Navega a:
```
http://localhost:5000/admin
```

¡Listo! Ya puedes ver todos los pedidos.

---

## ✨ Características

### Dashboard Principal (`/admin`)
- **Estadísticas en tiempo real:**
  - ⏳ Pedidos Pendientes
  - 👨‍🍳 Pedidos En Preparación
  - 🚚 Pedidos En Camino
  - 💰 Ventas del Día

- **Lista de pedidos:**
  - Todos los pedidos ordenados por fecha (más recientes primero)
  - Tarjetas visuales con información clave
  - Estado del pedido con colores (Pendiente, Confirmado, etc.)
  - Botón para ver detalles completos

- **Auto-actualización:**
  - Se actualiza automáticamente cada 30 segundos
  - Botón de actualización manual disponible

### Vista de Detalles (`/admin/orders/{id}`)
- Información completa del cliente
- Lista detallada de todos los items
- Tabla con precios y subtotales
- Total del pedido
- Estado y método de pago
- Tiempo estimado de entrega

---

## 🎨 Diseño

El dashboard tiene un diseño moderno y responsivo:
- **Colores:** Gradiente púrpura/azul elegante
- **Tarjetas:** Información clara y organizada
- **Estados con colores:**
  - 🟡 **Amarillo** = Pendiente
  - 🟢 **Verde** = Confirmado
  - 🔵 **Azul** = En Preparación
  - 🟠 **Naranja** = En Camino
  - ⚫ **Gris** = Completado
  - 🔴 **Rojo** = Cancelado

---

## 📱 Uso en diferentes dispositivos

### Desde una computadora:
- Abre el navegador en `http://localhost:5000/admin`
- Ideal para tenerlo abierto en una tablet o computadora en la cocina

### Desde el celular de la pizzería:
1. Asegúrate de que el celular esté en la misma red Wi-Fi que la computadora donde corre el backend
2. Averigua la IP de tu computadora (Windows: `ipconfig`, buscar "IPv4")
3. Abre en el celular: `http://TU_IP:5000/admin`
   - Ejemplo: `http://192.168.1.7:5000/admin`

---

## 🔄 Actualización en tiempo real

El dashboard se actualiza automáticamente cada 30 segundos. Cuando un cliente haga un pedido desde la app móvil:
1. El pedido se guarda en la base de datos
2. En máximo 30 segundos aparecerá en el dashboard
3. O puedes hacer click en el botón "🔄 Actualizar" para verlo inmediatamente

---

## 📊 Información mostrada

Para cada pedido verás:

### En el dashboard:
- **ID del Pedido:** Número único
- **Estado:** Pendiente, Confirmado, En Preparación, etc.
- **Cliente:** Nombre completo
- **Teléfono:** Para contactar
- **Dirección:** Dónde entregar
- **Método de Pago:** Efectivo o Mercado Pago
- **Items:** Lista de productos con cantidades
- **Total:** Precio total del pedido
- **Fecha y Hora:** Cuándo se hizo el pedido
- **Tiempo Estimado:** Cuántos minutos tomará preparar

### En los detalles:
- Toda la información anterior
- Tabla completa con precios unitarios y subtotales
- Historial de actualizaciones del pedido

---

## 🔧 Troubleshooting

### No aparecen los pedidos
- Verifica que el backend esté corriendo
- Asegúrate de que haya pedidos en la base de datos
- Prueba hacer un pedido desde la app móvil

### No se actualiza automáticamente
- Verifica que JavaScript esté habilitado en tu navegador
- Haz click en el botón "🔄 Actualizar" manualmente

### No puedo acceder desde otro dispositivo
- Verifica que ambos dispositivos estén en la misma red Wi-Fi
- Asegúrate de usar la IP correcta (no `localhost`)
- Verifica que el firewall de Windows permita conexiones en el puerto 5000

---

## 💡 Consejos

1. **Tenerlo siempre abierto:** Deja el dashboard abierto en una tablet o computadora en la cocina
2. **Sonidos de notificación:** Puedes usar extensiones del navegador para que suene cuando aparece un nuevo pedido
3. **Imprimir pedidos:** Usa la vista de detalles para imprimir los pedidos si lo necesitas
4. **Ordenar por estado:** Visualmente, los pedidos más recientes aparecen primero

---

## 🎯 Próximos pasos (opcionales)

Si quieres mejorar el dashboard más adelante:
- [ ] Filtros por estado (solo pendientes, solo en preparación, etc.)
- [ ] Búsqueda de pedidos por ID o cliente
- [ ] Notificaciones por sonido cuando llega un nuevo pedido
- [ ] Exportar reportes de ventas
- [ ] Gráficos de ventas por día/semana

---

## ✅ Listo para usar

¡El dashboard está listo! Solo necesitas:
1. Iniciar el backend: `dotnet run`
2. Abrir `http://localhost:5000/admin` en tu navegador
3. ¡Ver los pedidos en tiempo real! 🎉


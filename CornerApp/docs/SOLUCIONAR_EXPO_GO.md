# Solución para Expo Go en Celular

## ✅ Configuración Actualizada

Ya está configurado para usar tu IP: **192.168.1.7**

## 🔧 Pasos Inmediatos

### 1. Verificar Backend

Asegúrate de que el backend esté corriendo y accesible desde tu red:

```bash
# Ejecuta el backend (si no lo tienes corriendo)
cd backend-csharp\CornerApp.API
dotnet run
```

El backend debería estar escuchando en `http://0.0.0.0:5000` (todas las interfaces).

### 2. Probar desde el Celular

**En el navegador de tu celular** (conectado a la misma WiFi), abre:
```
http://192.168.1.7:5000/swagger
```

Si no abre, el firewall está bloqueando. Sigue al paso 3.

### 3. Configurar Firewall (si es necesario)

**Abrir puerto 5000 en Windows Firewall:**

```powershell
# Ejecutar como Administrador
netsh advfirewall firewall add rule name="CornerApp API" dir=in action=allow protocol=TCP localport=5000
```

O manualmente:
1. Windows Defender Firewall → Configuración avanzada
2. Reglas de entrada → Nueva regla
3. Puerto → TCP → 5000 → Permitir conexión

### 4. Recargar App en Expo Go

1. En Expo Go: Sacude el celular → "Reload"
2. O en la terminal de Expo: Presiona `r`

### 5. Verificar Logs

En la consola de Metro, deberías ver:
```
🔌 Conectando al backend en: http://192.168.1.7:5000
✅ Productos recibidos del backend: 10
```

## 🚨 Si Sigue Sin Funcionar

### Opción A: Deshabilitar Firewall Temporalmente (Solo para Probar)

1. Windows Defender Firewall → Activar o desactivar
2. Desactivar temporalmente para redes privadas
3. Probar la app
4. Si funciona, reconecta el firewall y permite el puerto 5000

### Opción B: Verificar IP Correcta

Tu IP actual es: **192.168.1.7**

Si cambió, actualiza en:
- `services/api.js` línea 106
- `services/mercadopago.js` línea 11

Para verificar tu IP actual:
```bash
ipconfig
```
Busca "Dirección IPv4" en tu conexión WiFi.

### Opción C: Verificar que Están en la Misma Red

1. En tu celular: Configuración → WiFi → Ver detalle de red
2. La IP debería empezar con `192.168.1.X` (igual que tu PC)

## 📱 Test Final

Si todo está bien configurado:

1. ✅ Backend corriendo
2. ✅ Celular y PC en misma WiFi
3. ✅ Firewall permite puerto 5000
4. ✅ IP correcta en `services/api.js`

La app debería mostrar los productos reales del backend.

## 🔍 Debug en Expo

Si quieres ver más detalles, en la consola de Metro presiona `j` para abrir React Native Debugger, y ejecuta:

```javascript
// Ver URL configurada
console.log('API URL:', require('./services/api').default.defaults.baseURL);

// Probar conexión
fetch('http://192.168.1.7:5000/api/products')
  .then(r => r.json())
  .then(d => console.log('✅ Backend responde:', d.length, 'productos'))
  .catch(e => console.error('❌ Error:', e));
```


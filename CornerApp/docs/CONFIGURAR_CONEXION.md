# Configurar Conexión Frontend-Backend

## 🔧 Problema

Si la app muestra datos simulados en lugar de datos del backend, es un problema de conectividad.

## ✅ Solución

### Paso 1: Verificar que el Backend esté Corriendo

El backend debe estar ejecutándose en: `http://localhost:5000`

Verifica en Swagger: http://localhost:5000/swagger

### Paso 2: Configurar la URL Según tu Entorno

Edita `services/api.js` y configura la URL correcta:

#### Para Android Emulator:
```javascript
const API_BASE_URL = 'http://10.0.2.2:5000';
```

#### Para iOS Simulator:
```javascript
const API_BASE_URL = 'http://localhost:5000';
```

#### Para Dispositivo Físico:
1. Encuentra tu IP local:
   ```bash
   # Windows
   ipconfig
   
   # Linux/Mac
   ifconfig
   ```

2. Actualiza `services/api.js`:
   ```javascript
   const API_BASE_URL = 'http://192.168.1.XXX:5000'; // Cambia XXX por tu IP
   ```

3. **IMPORTANTE**: Asegúrate de que tu dispositivo móvil y tu PC estén en la misma red WiFi.

### Paso 3: Verificar Logs

Revisa la consola de Metro/Expo. Deberías ver:
- ✅ `Conectando al backend en: http://...`
- ✅ `Productos recibidos del backend: 10`

Si ves:
- ⚠️ `Backend no disponible, usando datos simulados`

Significa que no puede conectar. Verifica:
1. Backend corriendo
2. URL correcta
3. Firewall no bloqueando el puerto 5000
4. Misma red WiFi (si es dispositivo físico)

## 🧪 Probar la Conexión

En la consola de tu app, ejecuta:

```javascript
// Probar endpoint directamente
fetch('http://localhost:5000/api/products')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

## 🐛 Troubleshooting

### Error: "Network request failed"
- Verifica que el backend esté corriendo
- Verifica la URL (no uses https en local)
- Firewall bloqueando puerto 5000

### Error: "ECONNREFUSED"
- Backend no está corriendo
- URL incorrecta
- Puerto incorrecto

### Sigue mostrando datos simulados
- Revisa los logs en consola
- Verifica que la URL sea correcta
- Reinicia la app (shake device → "Reload")

## 📱 Para Dispositivo Físico

**Si estás usando un dispositivo físico real**, necesitas la IP local de tu PC:

1. En Windows, ejecuta `ipconfig` y busca "IPv4 Address"
2. Actualiza `services/api.js` con esa IP
3. Asegúrate de que ambos (PC y móvil) estén en la misma red WiFi
4. Deshabilita temporalmente el firewall de Windows para probar


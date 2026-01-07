# Configuración para Expo

## 🎯 Configuración Rápida

### Tu IP Local
**192.168.1.7** (ya configurada en `services/api.js`)

## 📱 Configuración Según Tu Dispositivo

### Expo Go en Dispositivo Físico (Android/iOS)

Ya está configurado para usar tu IP: `http://192.168.1.7:5000`

**Requisitos:**
1. ✅ Backend corriendo en `http://localhost:5000`
2. ✅ Tu PC y móvil en la **misma red WiFi**
3. ✅ Firewall de Windows permite conexiones al puerto 5000

### Emulador Android

Si usas **Android Studio Emulator**, edita `services/api.js` y cambia:

```javascript
return `http://${LOCAL_IP}:5000`; // Comentar esta línea
return 'http://10.0.2.2:5000'; // Descomentar esta línea
```

### iOS Simulator

Si usas **iOS Simulator**, edita `services/api.js` y cambia:

```javascript
return `http://${LOCAL_IP}:5000`; // Comentar esta línea
return 'http://localhost:5000'; // Descomentar esta línea
```

## ✅ Verificar que Funciona

### 1. Backend Corriendo
```bash
# En otra terminal, verifica:
curl http://localhost:5000/api/products
```

### 2. En Expo
1. Abre la consola de Metro (donde ejecutaste `expo start`)
2. Recarga la app (shake device → "Reload" o `r` en la terminal)
3. Deberías ver en los logs:
   ```
   🔌 Conectando al backend en: http://192.168.1.7:5000
   ✅ Productos recibidos del backend: 10
   ```

### 3. Si no Funciona

**Ver errores:**
- Revisa la consola de Metro
- Mira los logs del backend

**Problemas comunes:**

#### Error: "Network request failed"
- ✅ Backend corriendo: `http://localhost:5000`
- ✅ IP correcta en `services/api.js`
- ✅ Misma red WiFi
- ✅ Firewall no bloquea puerto 5000

#### Sigue usando datos simulados
- Revisa los logs en consola
- Verifica que la URL sea correcta
- Reinicia Expo: `Ctrl+C` y luego `expo start`

#### Firewall bloqueando
**Windows:**
1. Windows Defender Firewall → Configuración avanzada
2. Reglas de entrada → Nueva regla
3. Puerto → TCP → 5000 → Permitir

## 🧪 Test Directo

En la consola de Expo (Metro), presiona `j` para abrir el debugger y ejecuta:

```javascript
fetch('http://192.168.1.7:5000/api/products')
  .then(r => r.json())
  .then(data => console.log('✅ Datos del backend:', data))
  .catch(err => console.error('❌ Error:', err));
```

## 📝 Cambiar la IP

Si tu IP cambió, edita `services/api.js`:

```javascript
const LOCAL_IP = 'TU_NUEVA_IP'; // Línea ~104
```

Para saber tu IP:
```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

Busca "IPv4 Address" en la red WiFi.

## 🚀 Expo Go en la Red

**IMPORTANTE:** Para Expo Go en dispositivo físico:
- Debe estar en la **misma red WiFi** que tu PC
- No funciona con datos móviles
- Si cambias de red, actualiza la IP


# Guía para Expo Go en Celular Físico

## ✅ Configuración Actual

Tu IP local está configurada: **192.168.1.7**

## 🔍 Pasos para Verificar

### 1. Verificar que el Backend esté Corriendo

En la terminal donde ejecutaste el backend C#, deberías ver algo como:
```
info: Microsoft.AspNetCore.Hosting.Diagnostics[1]
      Now listening on: http://localhost:5000
```

### 2. Verificar Conexión desde el Celular

**IMPORTANTE:** Para que funcione, tu celular y tu PC deben estar en la **misma red WiFi**.

### 3. Recargar la App en Expo Go

1. Abre Expo Go en tu celular
2. Sacude el celular (o presiona `r` en la terminal de Expo)
3. Selecciona "Reload"

### 4. Revisar Logs

En la **consola de Metro** (donde ejecutaste `expo start`), deberías ver:

✅ **Si funciona:**
```
🔌 Conectando al backend en: http://192.168.1.7:5000
✅ Productos recibidos del backend: 10
📦 Productos normalizados: 10
```

❌ **Si no funciona:**
```
❌ Error conectando al backend: Network request failed
⚠️ Backend no disponible, usando datos simulados
💡 Verifica que el backend esté corriendo en: http://192.168.1.7:5000
```

## 🐛 Solución de Problemas

### Problema: "Network request failed"

**Causa:** No puede alcanzar el backend desde tu celular.

**Soluciones:**

1. **Verifica la misma red WiFi:**
   - Tu PC y celular deben estar conectados a la misma red WiFi
   - No uses datos móviles

2. **Verifica que el backend acepte conexiones externas:**
   - El backend debe estar escuchando en todas las interfaces (0.0.0.0)
   - Por defecto en .NET escucha en localhost, puede necesitar configuración

3. **Firewall de Windows:**
   - Puede estar bloqueando el puerto 5000
   - Deshabilita temporalmente el firewall para probar

4. **Prueba la conexión manualmente:**
   En el navegador de tu celular (conectado a la misma WiFi), intenta:
   ```
   http://192.168.1.7:5000/swagger
   ```
   Si no abre, el firewall está bloqueando.

### Problema: Sigue mostrando datos simulados

**Causa:** El interceptor detecta error de conexión.

**Solución:**
1. Revisa los logs en la consola de Metro
2. Verifica que la IP sea correcta
3. Asegúrate de que el backend esté corriendo

## 🔧 Cambiar la IP si es Necesario

Si tu IP cambió, edita `services/api.js` línea ~106:

```javascript
const LOCAL_IP = '192.168.1.7'; // Cambia por tu nueva IP
```

Y también `services/mercadopago.js` línea ~11:

```javascript
const LOCAL_IP = '192.168.1.7'; // Misma IP
```

## 🧪 Test Rápido

En el navegador de tu celular (misma WiFi), abre:
```
http://192.168.1.7:5000/api/products
```

Deberías ver JSON con productos. Si no, el firewall está bloqueando.

## 📝 Checklist

- [ ] Backend corriendo en `http://localhost:5000`
- [ ] Celular y PC en la misma red WiFi
- [ ] IP configurada en `services/api.js`: `192.168.1.7`
- [ ] Firewall permite conexiones al puerto 5000
- [ ] Expo Go recargado después de cambios


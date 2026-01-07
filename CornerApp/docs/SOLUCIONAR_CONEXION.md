# 🔧 Solución: No se puede conectar al servidor

## ✅ Verificaciones Iniciales

### 1. Backend está corriendo
El backend está escuchando en `0.0.0.0:5000` ✅

### 2. IP Configurada
La IP está configurada como: `192.168.1.7` ✅

### 3. Misma Red WiFi
Asegúrate de que tu PC y tu dispositivo móvil estén en la **misma red WiFi**.

---

## 🔥 Solución: Configurar Firewall de Windows

El firewall de Windows está bloqueando las conexiones entrantes al puerto 5000.

### Opción A: Usar PowerShell (Recomendado)

**Ejecuta PowerShell como Administrador:**
1. Presiona `Windows + X`
2. Selecciona "Windows PowerShell (Administrador)" o "Terminal (Administrador)"
3. Ejecuta este comando:

```powershell
netsh advfirewall firewall add rule name="CornerApp API" dir=in action=allow protocol=TCP localport=5000
```

4. Deberías ver: `Ok.`

### Opción B: Configuración Manual del Firewall

1. Abre **Windows Defender Firewall**
   - Presiona `Windows + R`
   - Escribe: `wf.msc` y presiona Enter

2. Crea una nueva regla de entrada:
   - Click en **"Reglas de entrada"** (Inbound Rules) en el panel izquierdo
   - Click en **"Nueva regla..."** (New Rule...) en el panel derecho

3. Configura la regla:
   - Tipo: Selecciona **"Puerto"** → Siguiente
   - Protocolo: Selecciona **"TCP"** → Siguiente
   - Puertos: Selecciona **"Puertos locales específicos"** y escribe: `5000` → Siguiente
   - Acción: Selecciona **"Permitir la conexión"** → Siguiente
   - Perfiles: Marca todas las casillas (Dominio, Privada, Pública) → Siguiente
   - Nombre: Escribe `CornerApp API` → Finalizar

---

## 🧪 Probar la Conexión

### Desde tu PC (debería funcionar):
```powershell
curl http://localhost:5000/api/products
```

### Desde tu dispositivo móvil:
1. Abre el navegador en tu celular
2. Ve a: `http://192.168.1.7:5000/swagger`
3. Si abre Swagger, el firewall está configurado correctamente ✅

### Desde la App:
1. Recarga la app en Expo Go (sacude el dispositivo o presiona `r` en la terminal)
2. Intenta iniciar sesión o cargar productos
3. Deberías ver en la consola: `✅ Productos recibidos del backend: X`

---

## 🚨 Si Sigue Sin Funcionar

### Verificar IP Correcta

Ejecuta en PowerShell:
```powershell
ipconfig
```

Busca tu conexión WiFi y verifica la **"Dirección IPv4"**. Debe ser `192.168.1.143` o similar.

Si es diferente, actualiza en `services/api.js` línea 111.

### Verificar que Están en la Misma Red

- Tu PC debe estar conectada a WiFi
- Tu celular debe estar conectado a la **misma red WiFi**
- No uses datos móviles en el celular

### Deshabilitar Firewall Temporalmente (Solo para Probar)

⚠️ **Solo para diagnóstico, no recomendado para uso permanente**

1. Windows Defender Firewall → Activar o desactivar
2. Desactiva temporalmente para "Redes privadas"
3. Prueba la conexión
4. Si funciona, reactiva el firewall y crea la regla correctamente

---

## ✅ Verificación Final

Después de configurar el firewall, deberías poder:

1. ✅ Acceder a `http://192.168.1.7:5000/swagger` desde tu celular
2. ✅ Ver productos en la app móvil
3. ✅ Iniciar sesión sin errores de conexión

Si todo funciona, el problema está resuelto. 🎉


# 📱 Conectar la App de Repartidores desde tu Celular

## ✅ Configuración Completada

La app de repartidores ya está configurada para usar tu IP local: **192.168.1.201**

## 🚀 Pasos para Conectar

### 1. Asegúrate de que el Backend esté Corriendo

Ejecuta el backend desde la terminal:

```powershell
cd Restaurante\CornerApp\backend-csharp\CornerApp.API
dotnet run
```

El backend debería iniciarse en:
- **http://0.0.0.0:5002** (escucha en todas las interfaces)
- **http://localhost:5002** (acceso local)

### 2. Verifica el Firewall de Windows

El firewall puede estar bloqueando el puerto 5002. Para permitirlo:

1. Abre **Windows Defender Firewall**
2. Click en **Configuración avanzada**
3. Click en **Reglas de entrada** → **Nueva regla**
4. Selecciona **Puerto** → **Siguiente**
5. Selecciona **TCP** y escribe **5002** → **Siguiente**
6. Selecciona **Permitir la conexión** → **Siguiente**
7. Marca todas las casillas (Dominio, Privada, Pública) → **Siguiente**
8. Nombre: "CornerApp Backend" → **Finalizar**

O ejecuta este comando en PowerShell como Administrador:

```powershell
New-NetFirewallRule -DisplayName "CornerApp Backend" -Direction Inbound -LocalPort 5002 -Protocol TCP -Action Allow
```

### 3. Verifica que tu Celular esté en la Misma Red WiFi

- Tu PC: **192.168.1.201**
- Tu celular debe estar conectado a la misma red WiFi (192.168.1.x)

### 4. Probar la Conexión desde el Celular

Abre un navegador en tu celular y visita:

```
http://192.168.1.201:5002/swagger
```

Si puedes ver Swagger, la conexión funciona ✅

### 5. Ejecutar la App de Repartidores

#### Opción A: Con Expo Go (Recomendado para desarrollo)

1. Instala **Expo Go** en tu celular desde la App Store o Google Play
2. En tu PC, ejecuta:
   ```powershell
   cd Restaurante\CornerApp\delivery-app
   npm start
   ```
3. Escanea el código QR que aparece con Expo Go
4. La app se conectará automáticamente a `http://192.168.1.201:5002`

#### Opción B: Build de Desarrollo

Si prefieres una app instalada:

```powershell
cd Restaurante\CornerApp\delivery-app
npx expo start --dev-client
```

### 6. Verificar la Conexión en la App

Cuando la app se inicie, deberías ver en la consola de Metro/Expo:

```
🌐 URL base del backend configurada: http://192.168.1.201:5002
```

Si ves esto, la conexión está funcionando correctamente.

## 🔧 Solución de Problemas

### Error: "Network request failed"

**Causas posibles:**
1. Backend no está corriendo → Verifica con `http://192.168.1.201:5002/swagger`
2. Firewall bloqueando → Verifica el paso 2
3. IP incorrecta → Verifica que tu PC siga siendo 192.168.1.201
4. Celular en otra red → Asegúrate de estar en la misma WiFi

### Error: "ECONNREFUSED"

**Solución:**
- Verifica que el backend esté escuchando en `0.0.0.0:5002` (no solo localhost)
- Verifica el archivo `launchSettings.json` que debe tener `"applicationUrl": "http://0.0.0.0:5002"`

### La app no se conecta pero Swagger sí funciona

**Solución:**
- Limpia el caché de la app:
  ```powershell
  cd Restaurante\CornerApp\delivery-app
  npx expo start -c
  ```
- O borra el caché de AsyncStorage en la app

### Cambió mi IP

Si tu IP cambia (por ejemplo, ahora es 192.168.1.202):

1. Edita `Restaurante/CornerApp/delivery-app/services/api.js`
2. Busca todas las ocurrencias de `192.168.1.201` y cámbialas por tu nueva IP
3. Reinicia la app

## 📝 Notas Importantes

- **Puerto**: El backend usa el puerto **5002** (no 5000)
- **Protocolo**: Usa **HTTP** (no HTTPS) en desarrollo local
- **IP Dinámica**: Si tu router asigna IPs dinámicas, tu IP puede cambiar. Considera configurar una IP estática en tu router.

## 🎯 URLs de Acceso

- **Backend (desde PC)**: http://localhost:5002
- **Backend (desde celular)**: http://192.168.1.201:5002
- **Swagger (desde celular)**: http://192.168.1.201:5002/swagger
- **Login de Repartidores (web)**: http://192.168.1.201:5002/delivery/login (si está configurado)

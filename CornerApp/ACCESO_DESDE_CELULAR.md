# 📱 Acceder a la Aplicación Web desde tu Celular

## ✅ Configuración Completada

El frontend ahora está configurado para ser accesible desde tu red local.

## 🚀 Pasos para Acceder

### 1. Iniciar el Backend

En una terminal, ejecuta:

```powershell
cd Restaurante\CornerApp\backend-csharp\CornerApp.API
dotnet run
```

Espera a ver:
```
Now listening on: http://0.0.0.0:5002
```

### 2. Iniciar el Frontend

En otra terminal, ejecuta:

```powershell
cd Restaurante\CornerApp\frontend
npm run dev
```

Deberías ver algo como:
```
➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.201:3000/
```

**¡Importante!** Copia la URL de "Network" que aparece.

### 3. Abrir en tu Celular

Abre el navegador en tu celular y visita:

```
http://192.168.1.201:3000
```

O la URL que apareció en "Network" cuando iniciaste Vite.

## 🔐 Páginas Disponibles

### Para Administradores:
- **Login**: `http://192.168.1.201:3000/login`
- **Dashboard**: `http://192.168.1.201:3000/admin` (requiere login)

### Para Repartidores:
- **Login de Repartidores**: `http://192.168.1.201:3000/delivery/login`
- **Pedidos de Repartidores**: `http://192.168.1.201:3000/delivery/orders` (requiere login)

## 🔧 Solución de Problemas

### No puedo acceder desde el celular

1. **Verifica que ambos estén en la misma WiFi**
   - Tu PC: `192.168.1.201`
   - Tu celular debe estar en la misma red (192.168.1.x)

2. **Verifica el Firewall de Windows**
   - El puerto 3000 debe estar abierto
   - Ejecuta como Administrador:
     ```powershell
     New-NetFirewallRule -DisplayName "CornerApp Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
     ```

3. **Verifica que Vite muestre la URL de Network**
   - Si solo ves "Local", el frontend no está expuesto en la red
   - Asegúrate de usar `npm run dev` (que ahora incluye `--host`)

4. **Verifica que el backend esté corriendo**
   - Visita `http://192.168.1.201:5002/swagger` desde tu celular
   - Si no funciona, el backend no está accesible

### Error: "Network request failed" en la app

- Verifica que el backend esté corriendo
- Verifica que el proxy de Vite esté configurado correctamente
- El frontend hace proxy de `/api` y `/admin/api` al backend

### La página carga pero no hay datos

- Verifica que el backend esté corriendo en el puerto 5002
- Abre la consola del navegador (F12) y revisa los errores
- Verifica que no haya errores de CORS

## 📝 Notas Importantes

- **IP Dinámica**: Si tu IP cambia, actualiza la URL en el celular
- **HTTPS**: En desarrollo local usamos HTTP (no HTTPS)
- **Puerto Frontend**: 3000
- **Puerto Backend**: 5002

## 🎯 URLs Completas

### Desde tu PC:
- Frontend: http://localhost:3000
- Backend: http://localhost:5002
- Swagger: http://localhost:5002/swagger

### Desde tu Celular (misma red WiFi):
- Frontend: http://192.168.1.201:3000
- Backend: http://192.168.1.201:5002
- Swagger: http://192.168.1.201:5002/swagger
- Login Admin: http://192.168.1.201:3000/login
- Login Repartidores: http://192.168.1.201:3000/delivery/login

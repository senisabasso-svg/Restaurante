# Backend Example - Integración Mercado Pago

Este es un ejemplo completo de backend para integrar Mercado Pago con CornerApp.

## 🚀 Instalación

1. Instala las dependencias:
```bash
npm install
```

2. Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

3. Edita `.env` y agrega tus credenciales de Mercado Pago:
   - Ve a https://www.mercadopago.com.ar/developers/panel/app
   - Crea una aplicación
   - Copia tu Access Token

4. Inicia el servidor:
```bash
npm start
```

Para desarrollo con auto-reload:
```bash
npm run dev
```

## 📝 Endpoints

### POST `/api/mercadopago/create-preference`

Crea una preferencia de pago en Mercado Pago.

**Request Body:**
```json
{
  "total": 25.99,
  "items": [
    {
      "id": 1,
      "name": "Pizza Margarita",
      "description": "Deliciosa pizza",
      "price": 12.99,
      "quantity": 2
    }
  ],
  "customer": {
    "name": "Juan Pérez",
    "phone": "+541112345678",
    "address": "Av. Corrientes 1234",
    "email": "juan@example.com"
  }
}
```

**Response:**
```json
{
  "success": true,
  "checkout_url": "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=...",
  "preference_id": "123456789",
  "sandbox": true
}
```

### GET `/api/mercadopago/payment/:paymentId`

Obtiene el estado de un pago específico.

### POST `/api/mercadopago/webhook`

Endpoint que recibe notificaciones de Mercado Pago cuando cambia el estado de un pago.

## 🔧 Configuración para Desarrollo Local

### Usando ngrok para exponer tu servidor local:

1. Instala ngrok: https://ngrok.com/download

2. Inicia tu servidor en el puerto 3000

3. Expón el servidor:
```bash
ngrok http 3000
```

4. Copia la URL de ngrok (ej: `https://abc123.ngrok.io`) y actualiza tus variables de entorno:
```env
MERCADOPAGO_WEBHOOK_URL=https://abc123.ngrok.io/api/mercadopago/webhook
```

5. Configura esta URL en el panel de Mercado Pago:
   - Ve a: https://www.mercadopago.com.ar/developers/panel/app
   - Configura la URL del webhook

## 🧪 Pruebas

### Con tarjetas de test:

**Aprobada:**
- Número: 5031 7557 3453 0604
- CVV: 123
- Fecha: 11/25

**Rechazada:**
- Número: 5031 4332 1540 6351
- CVV: 123
- Fecha: 11/25

## 📚 Próximos Pasos

1. Integrar con tu base de datos para guardar pedidos
2. Implementar envío de emails de confirmación
3. Agregar validación de webhooks (verificar firma)
4. Implementar logging y monitoreo
5. Configurar para producción


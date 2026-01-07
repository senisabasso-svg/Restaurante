# Guía de Integración de Mercado Pago

Esta guía explica cómo completar la integración de Mercado Pago en tu aplicación.

## 📋 Requisitos Previos

1. **Cuenta de Mercado Pago**: 
   - Regístrate en https://www.mercadopago.com.ar
   - Crea una aplicación en: https://www.mercadopago.com.ar/developers/panel/app

2. **Credenciales de Mercado Pago**:
   - Access Token (production o test según ambiente)
   - Public Key (opcional, para frontend)

## 🔧 Configuración del Backend

### Paso 1: Instalar el SDK de Mercado Pago en tu Backend

```bash
npm install mercadopago
```

### Paso 2: Configurar Variables de Entorno

Crea un archivo `.env` en tu backend:

```env
MERCADOPAGO_ACCESS_TOKEN=TU_ACCESS_TOKEN_AQUI
MERCADOPAGO_PUBLIC_KEY=TU_PUBLIC_KEY_AQUI
MERCADOPAGO_CLIENT_ID=TU_CLIENT_ID_AQUI
MERCADOPAGO_CLIENT_SECRET=TU_CLIENT_SECRET_AQUI

# URLs de retorno (deben ser accesibles públicamente)
MERCADOPAGO_SUCCESS_URL=https://tu-app.com/mercadopago/success
MERCADOPAGO_FAILURE_URL=https://tu-app.com/mercadopago/failure
MERCADOPAGO_PENDING_URL=https://tu-app.com/mercadopago/pending

# URL del webhook (para recibir notificaciones)
MERCADOPAGO_WEBHOOK_URL=https://tu-backend.com/api/mercadopago/webhook
```

### Paso 3: Ejemplo de Endpoint en tu Backend (Node.js/Express)

```javascript
const express = require('express');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const router = express.Router();

// Configurar SDK de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: {
    timeout: 5000,
    idempotencyKey: 'abc',
  },
});

const preference = new Preference(client);

// Endpoint para crear preferencia de pago
router.post('/create-preference', async (req, res) => {
  try {
    const { total, items, customer } = req.body;

    // Formatear items para Mercado Pago
    const preferenceItems = items.map(item => ({
      id: item.id.toString(),
      title: item.name,
      description: item.description || '',
      quantity: item.quantity,
      currency_id: 'ARS', // o 'USD', 'BRL', etc.
      unit_price: item.price,
    }));

    // Crear preferencia
    const preferenceData = {
      items: preferenceItems,
      payer: {
        name: customer.name,
        phone: {
          number: customer.phone,
        },
        address: {
          street_name: customer.address,
        },
      },
      back_urls: {
        success: `${process.env.MERCADOPAGO_SUCCESS_URL}?payment_id={CHECKOUT_SESSION_ID}`,
        failure: `${process.env.MERCADOPAGO_FAILURE_URL}?payment_id={CHECKOUT_SESSION_ID}`,
        pending: `${process.env.MERCADOPAGO_PENDING_URL}?payment_id={CHECKOUT_SESSION_ID}`,
      },
      auto_return: 'approved', // Redirige automáticamente si el pago es aprobado
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL,
      statement_descriptor: 'CORNER APP', // Aparece en el resumen de la tarjeta
      external_reference: `order_${Date.now()}`, // Referencia para identificar el pedido
    };

    const response = await preference.create({ body: preferenceData });

    // Retornar la URL del checkout
    res.json({
      checkout_url: response.init_point, // URL completa del checkout
      preference_id: response.id,
      sandbox: response.sandbox_init_point ? true : false,
    });
  } catch (error) {
    console.error('Error creating preference:', error);
    res.status(500).json({
      error: 'No se pudo crear la preferencia de pago',
      details: error.message,
    });
  }
});

// Endpoint para verificar estado de pago
router.get('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Aquí usarías el SDK para obtener el estado del pago
    // const payment = await payment.get({ id: paymentId });
    
    res.json({
      id: paymentId,
      status: 'approved', // o 'pending', 'rejected', etc.
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook para recibir notificaciones de Mercado Pago
router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === 'payment') {
      const paymentId = data.id;
      
      // Verificar el pago
      // const payment = await payment.get({ id: paymentId });
      
      // Actualizar el estado del pedido en tu base de datos
      // await updateOrderStatus(payment.external_reference, payment.status);
      
      console.log(`Pago ${paymentId} recibido con estado: ${payment.status}`);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

module.exports = router;
```

## 🔗 Actualizar Frontend

### Actualizar `services/mercadopago.js`

Cambia la URL del backend:

```javascript
const MERCADOPAGO_BACKEND_URL = 'https://tu-backend.com/api/mercadopago';
```

### Actualizar `screens/MercadoPagoCheckoutScreen.js`

Descomenta las líneas 32-33 para usar el servicio real:

```javascript
const url = await createPaymentPreference({ 
  total: orderTotal, 
  items: orderData.items,
  name: orderData.name,
  phone: orderData.phone,
  address: orderData.address,
});
setCheckoutUrl(url);
```

## 🧪 Testing con Mercado Pago

### Tarjetas de Prueba

En modo sandbox, puedes usar estas tarjetas:

**Aprobada:**
- Número: 5031 7557 3453 0604
- CVV: 123
- Fecha: 11/25

**Rechazada:**
- Número: 5031 4332 1540 6351
- CVV: 123
- Fecha: 11/25

## 🔐 Seguridad Importante

1. **NUNCA** expongas tu Access Token en el frontend
2. Todas las llamadas al SDK deben hacerse desde tu backend
3. Valida los webhooks verificando la firma con tu secret
4. Usa HTTPS en producción

## 📝 Checklist de Producción

- [ ] Credenciales de producción configuradas
- [ ] Webhook configurado en el panel de Mercado Pago
- [ ] URLs de retorno configuradas y accesibles
- [ ] Manejo de errores implementado
- [ ] Logs de transacciones configurados
- [ ] Pruebas con tarjetas de test completadas

## 📚 Recursos

- [Documentación oficial de Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs)
- [SDK de Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Panel de desarrolladores](https://www.mercadopago.com.ar/developers/panel)


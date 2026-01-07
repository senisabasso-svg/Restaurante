/**
 * Ejemplo de servidor backend para integración con Mercado Pago
 * 
 * Este es un ejemplo completo que puedes usar como referencia
 * para implementar en tu backend real.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configurar SDK de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
  options: {
    timeout: 5000,
  },
});

const preference = new Preference(client);
const payment = new Payment(client);

// Endpoint para crear preferencia de pago
app.post('/api/mercadopago/create-preference', async (req, res) => {
  try {
    const { total, items, customer } = req.body;

    // Validar datos
    if (!total || !items || !customer) {
      return res.status(400).json({
        error: 'Faltan datos requeridos',
      });
    }

    // Formatear items para Mercado Pago
    const preferenceItems = items.map(item => ({
      id: item.id?.toString() || `item_${Date.now()}_${Math.random()}`,
      title: item.name,
      description: item.description || `${item.name} - ${item.quantity} unidades`,
      quantity: item.quantity,
      currency_id: 'ARS', // Cambiar según tu país
      unit_price: parseFloat(item.price),
    }));

    // Configurar preferencia
    const preferenceData = {
      items: preferenceItems,
      payer: {
        name: customer.name,
        email: customer.email || 'cliente@example.com', // Opcional
        phone: {
          number: customer.phone || '',
        },
        address: {
          street_name: customer.address || '',
        },
      },
      back_urls: {
        success: `${process.env.MERCADOPAGO_SUCCESS_URL || 'https://tu-app.com/success'}?payment_id={CHECKOUT_SESSION_ID}`,
        failure: `${process.env.MERCADOPAGO_FAILURE_URL || 'https://tu-app.com/failure'}?payment_id={CHECKOUT_SESSION_ID}`,
        pending: `${process.env.MERCADOPAGO_PENDING_URL || 'https://tu-app.com/pending'}?payment_id={CHECKOUT_SESSION_ID}`,
      },
      auto_return: 'approved',
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
      statement_descriptor: 'CORNER APP',
      external_reference: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        order_total: total,
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_address: customer.address,
      },
    };

    // Crear preferencia
    const response = await preference.create({ body: preferenceData });

    // Retornar respuesta
    res.json({
      success: true,
      checkout_url: response.init_point || response.sandbox_init_point,
      preference_id: response.id,
      sandbox: !!response.sandbox_init_point,
    });
  } catch (error) {
    console.error('Error creating preference:', error);
    res.status(500).json({
      success: false,
      error: 'No se pudo crear la preferencia de pago',
      details: error.message,
    });
  }
});

// Endpoint para verificar estado de pago
app.get('/api/mercadopago/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;

    const paymentInfo = await payment.get({ id: paymentId });

    res.json({
      success: true,
      payment: {
        id: paymentInfo.id,
        status: paymentInfo.status,
        status_detail: paymentInfo.status_detail,
        transaction_amount: paymentInfo.transaction_amount,
        external_reference: paymentInfo.external_reference,
      },
    });
  } catch (error) {
    console.error('Error getting payment:', error);
    res.status(500).json({
      success: false,
      error: 'No se pudo obtener el estado del pago',
      details: error.message,
    });
  }
});

// Webhook para recibir notificaciones de Mercado Pago
app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;

    console.log('Webhook recibido:', { type, data });

    if (type === 'payment') {
      const paymentId = data.id;

      // Obtener información del pago
      const paymentInfo = await payment.get({ id: paymentId });

      // Aquí deberías actualizar el estado del pedido en tu base de datos
      const orderReference = paymentInfo.external_reference;
      const paymentStatus = paymentInfo.status;

      console.log(`Pago ${paymentId} - Estado: ${paymentStatus} - Pedido: ${orderReference}`);

      // Ejemplo de actualización (reemplazar con tu lógica):
      // await updateOrderStatus(orderReference, paymentStatus);

      // Si el pago fue aprobado, puedes enviar notificaciones, emails, etc.
      if (paymentStatus === 'approved') {
        console.log(`Pedido ${orderReference} pagado exitosamente`);
        // await sendConfirmationEmail(orderReference);
        // await notifyCustomer(orderReference);
      }
    }

    // Mercado Pago espera una respuesta 200
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Mercado Pago endpoints:`);
  console.log(`  POST /api/mercadopago/create-preference`);
  console.log(`  GET  /api/mercadopago/payment/:paymentId`);
  console.log(`  POST /api/mercadopago/webhook`);
});

module.exports = app;


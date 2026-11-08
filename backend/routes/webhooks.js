import express from 'express';
import pool from '../db.js';
import { parseWebhookEvent, InvalidWebhookError } from '../integrations/paymentAdapter.js';
import { syncProductsToSearch } from '../services/searchSync.js';

const router = express.Router();

async function markOrderPaid(orderId, sessionId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE orders SET payment_status = 'Betald', paid_at = NOW()
       WHERE id = ? AND stripe_session_id = ? AND payment_status = 'Obetald'`,
      [orderId, sessionId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return [];
    }

    const [items] = await connection.query('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [
      orderId,
    ]);

    for (const item of items) {
      await connection.query('UPDATE products SET stock = GREATEST(stock - ?, 0) WHERE id = ?', [
        item.quantity,
        item.product_id,
      ]);
    }

    await connection.commit();
    return items.map((item) => item.product_id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function markOrderCancelled(orderId, sessionId) {
  const [result] = await pool.query(
    `UPDATE orders SET payment_status = 'Avbruten'
     WHERE id = ? AND stripe_session_id = ? AND payment_status = 'Obetald'`,
    [orderId, sessionId]
  );
  return result.affectedRows > 0;
}

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;

  try {
    event = parseWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    if (error instanceof InvalidWebhookError) {
      console.warn('[Stripe webhook] Avvisad:', error.message);
      return res.status(400).json({ error: 'Ogiltig webhook' });
    }
    throw error;
  }

  if (event.type === 'paid') {
    const productIds = await markOrderPaid(event.orderId, event.sessionId);

    if (productIds.length > 0) {
      console.log(`[Stripe webhook] Order ${event.orderId} är betald, lagret minskat`);
      await syncProductsToSearch(productIds);
    } else {
      console.log(`[Stripe webhook] Order ${event.orderId} var redan hanterad, ingen ändring`);
    }
  } else if (event.type === 'expired') {
    const cancelled = await markOrderCancelled(event.orderId, event.sessionId);
    console.log(`[Stripe webhook] Order ${event.orderId} ${cancelled ? 'avbruten' : 'oförändrad'}`);
  } else {
    console.log(`[Stripe webhook] Ignorerad: ${event.reason}`);
  }

  res.json({ received: true });
});

export default router;
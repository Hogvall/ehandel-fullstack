import express from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createCheckoutSession } from '../integrations/paymentAdapter.js';
import { findServicePoints } from '../integrations/shippingAdapter.js';
import { CartItems, CartError, priceCart } from '../services/cart.js';
import { SHIPPING_METHODS, shippingPriceInOre } from '../services/shippingPrices.js';
import { ExternalServiceError } from '../utils/fetchWithTimeout.js';

const router = express.Router();

const FULFILLMENT_STATUSES = ['Beställd', 'Behandlas', 'Levererad', 'Återbetald'];

const CheckoutRequest = z.object({
  items: CartItems,
  delivery: z.object({
    name: z.string().trim().min(1, 'Namn krävs').max(100),
    email: z.email('Ogiltig e-postadress').max(150),
    address: z.string().trim().min(1, 'Adress krävs').max(255),
    postalCode: z.string().trim().regex(/^\d{3} ?\d{2}$/, 'Postnumret måste vara fem siffror'),
    city: z.string().trim().min(1, 'Ort krävs').max(100),
  }),
  shipping: z.object({
    method: z.enum(['service_point', 'home'], 'Välj ett fraktalternativ'),
    servicePointId: z.string().trim().max(20).optional(),
  }),
});

router.post('/', authenticateToken, async (req, res) => {
  const parsed = CheckoutRequest.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
  }

  const { items, delivery, shipping } = parsed.data;
  const postalCode = delivery.postalCode.replace(' ', '');

  let lines;
  let subtotalInOre;
  try {
    ({ lines, subtotalInOre } = await priceCart(items));
  } catch (error) {
    if (error instanceof CartError) {
      return res.status(error.status).json({ error: error.message });
    }
    throw error;
  }

  let servicePoint = null;
  if (shipping.method === 'service_point') {
    if (!shipping.servicePointId) {
      return res.status(400).json({ error: 'Välj ett ombud' });
    }

    let nearby;
    try {
      nearby = await findServicePoints(postalCode);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        console.error('[PostNord] Ombudskontroll:', error.cause ?? error.message);
        return res
          .status(502)
          .json({ error: 'Kunde inte kontrollera ombudet hos PostNord. Försök igen eller välj hemleverans.' });
      }
      throw error;
    }

    servicePoint = nearby.find((point) => point.id === shipping.servicePointId) ?? null;
    if (!servicePoint) {
      return res.status(400).json({ error: 'Det valda ombudet finns inte nära ditt postnummer. Välj ett ombud i listan.' });
    }
  }

  const shippingInOre = shippingPriceInOre(shipping.method, subtotalInOre);
  const totalInOre = subtotalInOre + shippingInOre;

  const connection = await pool.getConnection();
  let orderId;

  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders
        (user_id, status, payment_status, total, delivery_name, delivery_email, delivery_address,
         delivery_postal_code, delivery_city, shipping_method, shipping_price, service_point_id, service_point_name)
       VALUES (?, 'Beställd', 'Obetald', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        totalInOre / 100,
        delivery.name,
        delivery.email,
        delivery.address,
        postalCode,
        delivery.city,
        shipping.method,
        shippingInOre / 100,
        servicePoint?.id ?? null,
        servicePoint ? `${servicePoint.name}, ${servicePoint.address}, ${servicePoint.city}` : null,
      ]
    );

    orderId = orderResult.insertId;

    for (const line of lines) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, line.productId, line.quantity, line.unitAmount / 100]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const stripeLines = [...lines];
  if (shippingInOre > 0) {
    stripeLines.push({ name: `Frakt: ${SHIPPING_METHODS[shipping.method].label}`, quantity: 1, unitAmount: shippingInOre });
  }

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  const session = await createCheckoutSession({
    orderId,
    customerEmail: delivery.email,
    lines: stripeLines,
    successUrl: `${frontendUrl}/orderbekraftelse/${orderId}`,
    cancelUrl: `${frontendUrl}/orderbekraftelse/${orderId}?avbruten=1`,
  });

  await pool.query('UPDATE orders SET stripe_session_id = ? WHERE id = ?', [session.sessionId, orderId]);

  res.status(201).json({ orderId, checkoutUrl: session.url });
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT orders.*, users.name AS customer_name
     FROM orders JOIN users ON orders.user_id = users.id
     ORDER BY orders.created_at DESC`
  );
  res.json(rows);
});

router.get('/:id', authenticateToken, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT id, user_id, status, payment_status, total, delivery_name, delivery_address,
            delivery_postal_code, delivery_city, shipping_method, shipping_price, service_point_name,
            created_at, paid_at
     FROM orders WHERE id = ?`,
    [req.params.id]
  );

  const order = orders[0];

  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Ordern hittades inte' });
  }

  const [items] = await pool.query(
    `SELECT order_items.quantity, order_items.price_at_purchase, products.name
     FROM order_items JOIN products ON products.id = order_items.product_id
     WHERE order_items.order_id = ?`,
    [order.id]
  );

  const { user_id, ...publicOrder } = order;
  res.json({ ...publicOrder, items });
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;

  if (!FULFILLMENT_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Ogiltig status' });
  }

  const [result] = await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Ordern hittades inte' });
  }

  res.json({ message: 'Status uppdaterad' });
});

export default router;
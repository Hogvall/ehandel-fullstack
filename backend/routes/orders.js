import express from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createCheckoutSession } from '../integrations/paymentAdapter.js';

const router = express.Router();

const FULFILLMENT_STATUSES = ['Beställd', 'Behandlas', 'Levererad', 'Återbetald'];

const CheckoutRequest = z.object({
  items: z
    .array(
      z.object({
        productId: z.number('produkt-id saknas').int('ogiltigt produkt-id').positive('ogiltigt produkt-id'),
        quantity: z
          .number('antal saknas')
          .int('antal måste vara ett heltal')
          .min(1, 'antal måste vara minst 1')
          .max(99, 'högst 99 st per produkt'),
      })
    )
    .min(1, 'Varukorgen är tom')
    .max(50, 'För många produkter i varukorgen'),
  delivery: z.object({
    name: z.string().trim().min(1, 'Namn krävs').max(100),
    email: z.email('Ogiltig e-postadress').max(150),
    address: z.string().trim().min(1, 'Adress krävs').max(255),
    postalCode: z.string().trim().regex(/^\d{3} ?\d{2}$/, 'Postnumret måste vara fem siffror'),
    city: z.string().trim().min(1, 'Ort krävs').max(100),
  }),
});

function sumQuantities(items) {
  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return quantities;
}

router.post('/', authenticateToken, async (req, res) => {
  const parsed = CheckoutRequest.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(', ') });
  }

  const { items, delivery } = parsed.data;
  const quantities = sumQuantities(items);

  const [products] = await pool.query('SELECT id, name, price, stock FROM products WHERE id IN (?)', [
    [...quantities.keys()],
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  const lines = [];
  for (const [productId, quantity] of quantities) {
    const product = productsById.get(productId);

    if (!product) {
      return res.status(400).json({ error: `En produkt i varukorgen finns inte längre (id ${productId})` });
    }

    if (product.stock < quantity) {
      return res.status(409).json({ error: `Det finns bara ${product.stock} st kvar av ${product.name}` });
    }

    lines.push({
      productId,
      name: product.name,
      quantity,
      unitAmount: Math.round(Number(product.price) * 100),
    });
  }

  const totalInOre = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, 0);

  const connection = await pool.getConnection();
  let orderId;

  try {
    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders
        (user_id, status, payment_status, total, delivery_name, delivery_email, delivery_address, delivery_postal_code, delivery_city)
       VALUES (?, 'Beställd', 'Obetald', ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        totalInOre / 100,
        delivery.name,
        delivery.email,
        delivery.address,
        delivery.postalCode,
        delivery.city,
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

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  const session = await createCheckoutSession({
    orderId,
    customerEmail: delivery.email,
    lines,
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
            delivery_postal_code, delivery_city, created_at, paid_at
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
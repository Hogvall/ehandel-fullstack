import express from 'express';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// OBS!!!! hårdkodat. ersätt med inloggad användares id när inloggningen är byggd.
const TEMP_USER_ID = 1;


router.post('/', async (req, res) => {
  const { items } = req.body; 

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Varukorgen är tom' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, status, total) VALUES (?, ?, ?)',
      [TEMP_USER_ID, 'Beställd', total]
    );

    const orderId = orderResult.insertId;

    for (const item of items) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
        [orderId, item.id, item.quantity, item.price]
      );

      const [stockResult] = await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.id, item.quantity]
      );

      if (stockResult.affectedRows === 0) {
        throw new Error(`Otillräckligt lagersaldo för produkt id ${item.id}`);
      }
    }

    await connection.commit();
    res.status(201).json({ orderId, total });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: error.message || 'Kunde inte skapa order' });
  } finally {
    connection.release();
  }
});

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT orders.*, users.name AS customer_name FROM orders JOIN users ON orders.user_id = users.id ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte hämta ordrar' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['Beställd', 'Behandlas', 'Levererad', 'Återbetald'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Ogiltig status' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Ordern hittades inte' });
    }

    res.json({ message: 'Status uppdaterad' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte uppdatera status' });
  }
});

export default router;
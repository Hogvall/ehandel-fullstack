import express from 'express';
import pool from '../db.js';

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

// Se över för Admin senare.
export default router;
import express from 'express';
import pool from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte hämta produkter' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produkten hittades inte' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte hämta produkten' });
  }
});

router.post('/', async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  if (!name || price === undefined) {
    return res.status(400).json({ error: 'Namn och pris krävs' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, price, stock || 0, image_url || null]
    );

    res.status(201).json({ id: result.insertId, name, description, price, stock, image_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte skapa produkten' });
  }
});

router.put('/:id', async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ? WHERE id = ?',
      [name, description, price, stock, image_url, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produkten hittades inte' });
    }

    res.json({ message: 'Produkten uppdaterad' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte uppdatera produkten' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produkten hittades inte' });
    }

    res.json({ message: 'Produkten borttagen' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte ta bort produkten' });
  }
});

export default router;
import express from 'express';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { syncProductsToSearch, removeProductsFromSearch } from '../services/searchSync.js';

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

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { sku, name, description, price, stock, image_url } = req.body;

  if (typeof sku !== 'string' || !sku.trim() || !name || price === undefined) {
    return res.status(400).json({ error: 'Artikelnummer, namn och pris krävs' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO products (sku, name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [sku.trim(), name, description || null, price, stock || 0, image_url || null]
    );

    const searchIndexed = await syncProductsToSearch([result.insertId]);

    res.status(201).json({ id: result.insertId, sku: sku.trim(), name, description, price, stock, image_url, searchIndexed });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Det finns redan en produkt med det artikelnumret' });
    }
    console.error(error);
    res.status(500).json({ error: 'Kunde inte skapa produkten' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ? WHERE id = ?',
      [name, description, price, stock, image_url, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Produkten hittades inte' });
    }

    const searchIndexed = await syncProductsToSearch([Number(req.params.id)]);

    res.json({ message: 'Produkten uppdaterad', searchIndexed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Kunde inte uppdatera produkten' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT sku FROM products WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produkten hittades inte' });
    }

    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);

    const searchIndexed = rows[0].sku ? await removeProductsFromSearch([rows[0].sku]) : true;

    res.json({ message: 'Produkten borttagen', searchIndexed });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Produkten finns i en order och kan inte tas bort' });
    }
    console.error(error);
    res.status(500).json({ error: 'Kunde inte ta bort produkten' });
  }
});

export default router;
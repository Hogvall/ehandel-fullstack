import express from 'express';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { syncProductsToSearch, removeProductsFromSearch } from '../services/searchSync.js';
import { removeProductImage } from '../integrations/storageAdapter.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Produkten hittades inte' });
  }

  res.json(rows[0]);
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { sku, name, description, price, stock } = req.body;

  if (typeof sku !== 'string' || !sku.trim() || !name || price === undefined) {
    return res.status(400).json({ error: 'Artikelnummer, namn och pris krävs' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO products (sku, name, description, price, stock) VALUES (?, ?, ?, ?, ?)',
      [sku.trim(), name, description || null, price, stock || 0]
    );

    const searchIndexed = await syncProductsToSearch([result.insertId]);

    res.status(201).json({ id: result.insertId, sku: sku.trim(), name, description, price, stock, searchIndexed });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Det finns redan en produkt med det artikelnumret' });
    }
    throw error;
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, price, stock } = req.body;

  const [result] = await pool.query(
    'UPDATE products SET name = ?, description = ?, price = ?, stock = ? WHERE id = ?',
    [name, description, price, stock, req.params.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Produkten hittades inte' });
  }

  const searchIndexed = await syncProductsToSearch([Number(req.params.id)]);

  res.json({ message: 'Produkten uppdaterad', searchIndexed });
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const [rows] = await pool.query('SELECT sku, image_path FROM products WHERE id = ?', [req.params.id]);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Produkten hittades inte' });
  }

  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'Produkten finns i en order och kan inte tas bort' });
    }
    throw error;
  }

  const { sku, image_path } = rows[0];

  if (image_path) {
    await removeProductImage(image_path).catch((error) =>
      console.error(`[Bilder] Bild ${image_path} kunde inte tas bort:`, error.cause ?? error)
    );
  }

  const searchIndexed = sku ? await removeProductsFromSearch([sku]) : true;

  res.json({ message: 'Produkten borttagen', searchIndexed });
});

export default router;
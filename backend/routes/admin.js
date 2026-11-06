import express from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getSupplierCatalog } from '../integrations/supplierAdapter.js';

const router = express.Router();

const ImportedProduct = z.object({
  sku: z.string('artikelnummer saknas').trim().min(1, 'artikelnummer saknas'),
  ean: z.string('EAN saknas').regex(/^\d{13}$/, 'EAN måste vara 13 siffror'),
  name: z.string('namn saknas').trim().min(1, 'namn saknas').max(200, 'namnet är för långt'),
  category: z.string('kategori saknas').trim().min(1, 'kategori saknas').max(100, 'kategorin är för lång'),
  price: z.number('pris måste vara ett tal').positive('pris måste vara större än 0'),
  stock: z
    .number('lagersaldo måste vara ett tal')
    .int('lagersaldo måste vara ett heltal')
    .min(0, 'lagersaldo kan inte vara negativt'),
  variants: z.array(z.string()),
});

function describeIssues(error) {
  return error.issues.map((issue) => issue.message).join(', ');
}

async function findOrCreateCategory(name, categoryIdsByName) {
  if (categoryIdsByName.has(name)) {
    return categoryIdsByName.get(name);
  }

  const [result] = await pool.query('INSERT INTO categories (name) VALUES (?)', [name]);
  categoryIdsByName.set(name, result.insertId);
  return result.insertId;
}

router.post('/products/import/:format', authenticateToken, requireAdmin, async (req, res) => {
  const { format } = req.params;

  if (format !== 'csv' && format !== 'xml') {
    return res.status(400).json({ error: 'Formatet måste vara csv eller xml' });
  }

  const candidates = await getSupplierCatalog(format);

  const [existingRows] = await pool.query('SELECT id, sku FROM products WHERE sku IS NOT NULL');
  const productIdsBySku = new Map(existingRows.map((row) => [row.sku, row.id]));

  const [categoryRows] = await pool.query('SELECT id, name FROM categories');
  const categoryIdsByName = new Map(categoryRows.map((row) => [row.name, row.id]));

  const report = { format, total: candidates.length, created: 0, updated: 0, skipped: [] };

  for (const candidate of candidates) {
    const result = ImportedProduct.safeParse(candidate);

    if (!result.success) {
      report.skipped.push({ sku: candidate.sku || '(saknas)', reason: describeIssues(result.error) });
      continue;
    }

    const product = result.data;

    try {
      const categoryId = await findOrCreateCategory(product.category, categoryIdsByName);
      const existingId = productIdsBySku.get(product.sku);

      const [upsertResult] = await pool.query(
        `INSERT INTO products (sku, ean, name, price, stock)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ean = VALUES(ean),
           name = VALUES(name),
           price = VALUES(price),
           stock = VALUES(stock)`,
        [product.sku, product.ean, product.name, product.price, product.stock]
      );

      const productId = existingId ?? upsertResult.insertId;

      await pool.query('DELETE FROM product_categories WHERE product_id = ?', [productId]);
      await pool.query('INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)', [
        productId,
        categoryId,
      ]);

      if (existingId) {
        report.updated += 1;
      } else {
        report.created += 1;
        productIdsBySku.set(product.sku, productId);
      }
    } catch (error) {
      console.error(`[Import] ${product.sku}:`, error);
      report.skipped.push({ sku: product.sku, reason: 'kunde inte sparas i databasen' });
    }
  }

  res.json(report);
});

export default router;
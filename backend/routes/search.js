import express from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { searchProducts } from '../integrations/searchAdapter.js';

const router = express.Router();

const SearchQuery = z.object({
  q: z.string('q måste vara text').trim().max(100, 'q får vara högst 100 tecken').default(''),
  category: z
    .string('category måste vara text')
    .trim()
    .min(1, 'category får inte vara tom')
    .max(100, 'category får vara högst 100 tecken')
    .optional(),
  inStock: z.stringbool('inStock måste vara true eller false').optional(),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc'], 'sort måste vara relevance, price_asc eller price_desc')
    .default('relevance'),
  page: z.coerce
    .number('page måste vara ett tal')
    .int('page måste vara ett heltal')
    .min(1, 'page måste vara minst 1')
    .default(1),
  pageSize: z.coerce
    .number('pageSize måste vara ett tal')
    .int('pageSize måste vara ett heltal')
    .min(1, 'pageSize måste vara minst 1')
    .max(50, 'pageSize får vara högst 50')
    .default(12),
});

router.get('/categories', async (req, res) => {
  const [rows] = await pool.query('SELECT name FROM categories ORDER BY name');
  res.json(rows.map((row) => row.name));
});

router.get('/', async (req, res) => {
  const result = SearchQuery.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      error: 'Ogiltiga sökparametrar',
      details: result.error.issues.map((issue) => issue.message),
    });
  }

  res.json(await searchProducts(result.data));
});

export default router;
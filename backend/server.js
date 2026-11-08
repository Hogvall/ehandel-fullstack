import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import searchRouter from './routes/search.js';
import webhooksRouter from './routes/webhooks.js';
import productImagesRouter from './routes/productImages.js';
import shippingRouter from './routes/shipping.js';
import { ExternalServiceError } from './utils/fetchWithTimeout.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use('/api/webhooks', webhooksRouter);
app.use(express.json());
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', productImagesRouter);
app.use('/api/search', searchRouter);
app.use('/api/shipping', shippingRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Servern är igång!' });
});

app.get('/db-test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS resultat');
    res.json({ dbFungerar: true, resultat: rows[0].resultat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ dbFungerar: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof ExternalServiceError) {
    console.error(`[${err.service}]`, err.cause ?? err.message);
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Något gick fel på servern.' });
});

app.listen(PORT, () => {
  console.log(`Servern körs på http://localhost:${PORT}`);
});
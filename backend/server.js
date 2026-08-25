import 'dotenv/config';
import express from 'express';
import cors from 'cors'; 
import pool from './db.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/auth', authRouter);

app.get('/', (req, res)=> {
    res.json({message: 'Servern är igång!' });
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

app.listen (PORT, () => {
console.log (`servern körs på http://localhost:${PORT}`);
});
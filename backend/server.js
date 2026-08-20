import 'dotenv/config';

import express from 'express';
import cors from 'cors'; 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express());

app.get('/', (req, res)=> {
    res.json({message: 'Servern är igång!' });
});

app.listen (PORT, () => {
console.log (`servern körs på http://localhost:${PORT}`);
});
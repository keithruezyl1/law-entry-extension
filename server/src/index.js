import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import kbRouter from './routes/kb.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(bodyParser.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/kb', kbRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`KB Vector Server listening on http://localhost:${port}`);
});




import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import kbRouter from './routes/kb.js';
import chatRouter from './routes/chat.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(bodyParser.json({ limit: '2mb' }));

// Basic authentication middleware
const API_KEY = process.env.API_KEY;
if (API_KEY) {
  app.use('/api', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader === `Bearer ${API_KEY}`) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized' });
    }
  });
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/kb', kbRouter);
app.use('/api', chatRouter);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`KB Vector Server listening on http://localhost:${port}`);
});




import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import kbRouter from './routes/kb.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import plansRouter from './routes/plans.js';
import setupDatabase from './setup-db.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'] }));
app.use(bodyParser.json({ limit: '2mb' }));

// JWT authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Public routes (no authentication required)
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);

// Protected routes (authentication required)
app.use('/api/kb', authenticateToken, kbRouter);
app.use('/api/chat', authenticateToken, chatRouter);
app.use('/api/plans', authenticateToken, plansRouter);

const port = process.env.PORT || 4000;

// Start server with database setup
async function startServer() {
  try {
    // Run database setup first
    await setupDatabase();
    
    // Then start the server
    app.listen(port, () => {
      console.log(`KB Vector Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();




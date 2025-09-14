import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import kbRouter from './routes/kb.js';
import chatRouter from './routes/chat.js';
import authRouter from './routes/auth.js';
import plansRouter from './routes/plans.js';
import notificationsRouter from './routes/notifications.js';
import setupDatabase from './setup-db.js';

const app = express();

// CORS configuration - allow multiple origins for development and production
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'https://law-entry-extension.vercel.app'
    ];
    
    // Add CORS_ORIGIN from environment if it exists
    if (process.env.CORS_ORIGIN) {
      allowedOrigins.push(process.env.CORS_ORIGIN);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
};
app.use(cors(corsOptions));
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
app.use('/api/notifications', authenticateToken, notificationsRouter);

const port = process.env.PORT || 4000;

// Start server with database setup
async function startServer() {
  try {
    console.log('Starting server setup...');
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('PGSSL:', process.env.PGSSL);
    console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN);
    console.log('CORS: Allowing multiple origins including localhost:3000 and production URL');
    
    // Run database setup first
    console.log('Running database setup...');
    await setupDatabase();
    console.log('Database setup completed successfully');
    
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




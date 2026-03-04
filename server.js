import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import pollHandler from './api/poll.js';
import streamHandler from './api/stream.js';
import moveHandler from './api/move.js';
import chatHandler from './api/chat.js';
import stateHandler from './api/state.js';
import webhookHandler from './api/webhook.js';

// Simple in-memory rate limiter
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

const rateLimiterMiddleware = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const userLimit = rateLimit.get(ip) || { count: 0, startTime: now };
  
  if (now - userLimit.startTime > RATE_LIMIT_WINDOW) {
    userLimit.count = 1;
    userLimit.startTime = now;
  } else {
    userLimit.count++;
  }
  
  rateLimit.set(ip, userLimit);
  
  if (userLimit.count > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
  next();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  
  // Apply rate limiting to all API routes
  app.use('/api', rateLimiterMiddleware);

  // API Routes
  app.get('/api/poll', pollHandler);
  app.get('/api/stream', streamHandler);
  app.post('/api/move', moveHandler);
  app.post('/api/chat', chatHandler);
  app.get('/api/state', stateHandler);
  app.post('/api/webhook', webhookHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

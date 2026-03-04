import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import pollHandler from './api/poll.js';
import streamHandler from './api/stream.js';
import moveHandler from './api/move.js';
import chatHandler from './api/chat.js';
import stateHandler from './api/state.js';
import webhookHandler from './api/webhook.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

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

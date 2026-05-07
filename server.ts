import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import * as chatModule from './api/chat.js';
import * as createModule from './api/create.js';
import * as cronModule from './api/cron.js';
import * as heartbeatModule from './api/heartbeat.js';
import * as moveModule from './api/move.js';
import * as pollModule from './api/poll.js';
import * as stateModule from './api/state.js';
import * as streamModule from './api/stream.js';
import * as thinkingModule from './api/thinking.js';
import * as webhookModule from './api/webhook.js';

const apiModules = {
  chat: chatModule,
  create: createModule,
  cron: cronModule,
  heartbeat: heartbeatModule,
  move: moveModule,
  poll: pollModule,
  state: stateModule,
  stream: streamModule,
  thinking: thinkingModule,
  webhook: webhookModule
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // Dynamically load all API routes
  for (const [routeName, module] of Object.entries(apiModules)) {
      const routePath = `/api/${routeName}`;
      
      app.all(routePath, async (req, res) => {
        try {
          if (module.config?.runtime === 'edge') {
            const controller = new AbortController();
            req.on('close', () => controller.abort());

            const url = new URL(req.url, `http://${req.headers.host}`);
            const edgeReq = new Request(url, {
              method: req.method,
              headers: new Headers(req.headers),
              body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
              signal: controller.signal
            });
            const edgeHandler = typeof module === 'function' ? module : (typeof module.default === 'function' ? module.default : module);
            if (typeof edgeHandler !== 'function') {
               throw new Error(`Edge handler for ${routePath} is not a function.`);
            }
            const edgeRes = await edgeHandler(edgeReq);
            
            edgeRes.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            res.status(edgeRes.status);
            
            if (edgeRes.body) {
              const reader = edgeRes.body.getReader();
              const pump = async () => {
                try {
                  const { done, value } = await reader.read();
                  if (done) {
                    res.end();
                    return;
                  }
                  res.write(value);
                  pump();
                } catch (err) {
                  res.end();
                }
              };
              pump();
            } else {
              res.end();
            }
          } else {
            // Standard Node.js Vercel function
            const handler = typeof module === 'function' ? module : (typeof module.default === 'function' ? module.default : module);
            if (typeof handler !== 'function') {
               throw new Error(`Handler for ${routePath} is not a function.`);
            }
            await handler(req, res);
          }
        } catch (error) {
          console.error(`Error in ${routePath}:`, error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
          }
        }
      });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

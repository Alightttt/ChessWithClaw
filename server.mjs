import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Parse JSON bodies
  app.use(express.json());

  // Dynamically load all API routes
  const apiDir = path.join(__dirname, 'api');
  const files = fs.readdirSync(apiDir);
  
  for (const file of files) {
    if (file.endsWith('.js')) {
      const routeName = file.replace('.js', '');
      const routePath = `/api/${routeName}`;
      const module = await import(`./api/${file}`);
      
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
            const edgeRes = await module.default(edgeReq);
            
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
            // Vercel populates req.query automatically, Express does too
            await module.default(req, res);
          }
        } catch (error) {
          console.error(`Error in ${routePath}:`, error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
          }
        }
      });
    }
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

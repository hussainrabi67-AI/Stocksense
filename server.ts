import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  app.use(express.json());

  // Server-side API Proxy for n8n Webhook to avoid browser CORS issues
  const handleN8nProxy = async (req: express.Request, res: express.Response) => {
    try {
      const n8nUrl =
        process.env.VITE_N8N_AI_WEBHOOK_URL ||
        process.env.NEXT_PUBLIC_N8N_AI_WEBHOOK_URL ||
        'https://arwa123.app.n8n.cloud/webhook-test/stocksense-ai';

      if (!n8nUrl || n8nUrl.includes('your-n8n')) {
        return res.status(400).json({ error: 'n8n webhook URL not configured correctly.' });
      }

      console.log(`[n8n Proxy] Forwarding request to: ${n8nUrl}`);

      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(req.body)
      });

      const responseText = await response.text();
      
      try {
        const json = JSON.parse(responseText);
        return res.status(response.status).json(json);
      } catch {
        return res.status(response.status).send(responseText);
      }
    } catch (err: any) {
      console.error('[n8n Proxy Error]:', err);
      return res.status(500).json({
        error: err.message || 'Failed to communicate with n8n workflow webhook.'
      });
    }
  };

  app.post('/api/ai/n8n-proxy', handleN8nProxy);
  app.post('/api/n8n-proxy', handleN8nProxy);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Create Vite server in middleware mode for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[StockSense Server] Running on http://0.0.0.0:${port}`);
  });
}

startServer();

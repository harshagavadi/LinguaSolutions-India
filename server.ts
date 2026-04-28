import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

fs.writeFileSync('startup.log', 'Module loading started\n');

import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const logPath = path.resolve('./startup.log');
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] startServer() called\n`);
  console.log('Logging to:', logPath);

  const app = express();
  const PORT = 3000;

  app.use(cors());
  // Use body-parser middleware with increased limits for handling base64 images
  app.use(express.json({ limit: '50mb' }));

  // Debug middleware to log all requests
  app.use((req, res, next) => {
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
    console.log(logLine.trim());
    try {
      fs.appendFileSync(logPath, logLine);
    } catch (err) {
      // ignore log errors
    }
    next();
  });

  // API Route: Translation Proxy (Handle both /api/translate and /api/translate/)
  app.all(['/api/translate', '/api/translate/'], async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method Not Allowed', 
        message: `This endpoint requires POST, but received ${req.method}`,
        receivedMethod: req.method
      });
    }

    const { contents, model, config } = req.body;

    console.log('[Proxy] Incoming translation request:', {
      model,
      hasContents: !!contents,
      hasConfig: !!config
    });

    if (!process.env.GEMINI_API_KEY) {
      console.error('[Proxy] Server Configuration Error: GEMINI_API_KEY is missing');
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set on the server.' });
    }

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const genModel = genAI.getGenerativeModel({ model: model || 'gemini-1.5-flash' });

      // Adapting contents if they are in the older parts-only format
      const finalContents = contents.parts ? [contents] : contents;

      const result = await genModel.generateContent({
        contents: Array.isArray(finalContents) ? finalContents : [finalContents],
        generationConfig: config || {
          temperature: 0.1,
        }
      });

      const response = await result.response;
      const responseText = response.text();
      
      console.log('[Proxy] AI response received, length:', responseText.length);
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('[Proxy] AI Error:', error);
      res.status(500).json({ 
        error: 'Failed to translate content via server proxy.',
        details: error.message 
      });
    }
  });

  // Health check / Test route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/view-logs', (req, res) => {
    try {
      if (fs.existsSync(logPath)) {
        res.setHeader('Content-Type', 'text/plain');
        res.send(fs.readFileSync(logPath, 'utf8'));
      } else {
        res.status(404).send('Log file not found at ' + logPath);
      }
    } catch (e) {
      res.status(500).send('Error reading log: ' + e);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

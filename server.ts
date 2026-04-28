import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use body-parser middleware with increased limits for handling base64 images
  app.use(express.json({ limit: '50mb' }));

  // API Route: Translation Proxy
  app.post('/api/translate', async (req, res) => {
    const { contents, model, config } = req.body;

    console.log('[Proxy] Incoming translation request:', {
      model,
      hasContents: !!contents,
      hasConfig: !!config,
      contentParts: contents?.parts?.length || (Array.isArray(contents) ? contents.length : 'unknown')
    });

    if (!process.env.GEMINI_API_KEY) {
      console.error('[Proxy] Server Configuration Error: GEMINI_API_KEY is missing');
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set on the server.' });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Use the modern SDK pattern as per gemini-api skill
      const response = await ai.models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents,
        config: config || {
          temperature: 0.1,
        }
      });

      console.log('[Proxy] AI response received:', {
        hasText: !!response.text,
        textLength: response.text?.length
      });

      const responseText = response.text || '';
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('[Proxy] AI Error:', error);
      res.status(500).json({ 
        error: 'Failed to translate content via server proxy.',
        details: error.message 
      });
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

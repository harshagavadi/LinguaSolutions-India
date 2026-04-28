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

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set on the server.' });
    }

    try {
      const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const genModel = genAI.getGenerativeModel({ model: model || 'gemini-3-flash-preview' });

      // Note: SDK structure might differ slightly, using a clean approach
      // @ts-ignore - The SDK types might be strict about contents structure
      const result = await genModel.generateContent({
        contents,
        generationConfig: config
      });

      const responseText = result.response.text();
      res.json({ text: responseText });
    } catch (error: any) {
      console.error('Proxy Translation Error:', error);
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

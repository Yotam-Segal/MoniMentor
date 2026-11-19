import 'dotenv/config';
import express from 'express';
import { streamChat, llmReady } from './llm.js';
import { generateDigest } from './agents/digest.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, llmReady: llmReady() }));

// Streams the assistant reply as plain text chunks.
app.post('/api/chat', async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: 'messages required' });
  if (!llmReady()) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY חסר בקובץ .env' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  try {
    await streamChat(messages, (chunk) => res.write(chunk));
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end('\n\n[שגיאה בקבלת התשובה]');
  }
});

app.post('/api/digest', async (_req, res) => {
  if (!llmReady()) return res.status(500).json({ error: 'ANTHROPIC_API_KEY חסר בקובץ .env' });
  try {
    res.json(await generateDigest());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port =process.env.PORT || 3001;
app.listen(port, () => console.log(`MoniMentor server on http://localhost:${port}`));

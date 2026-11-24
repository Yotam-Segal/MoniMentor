import 'dotenv/config';
import express from 'express';
import { streamChat, llmReady } from './llm.js';
import { generateDigest } from './agents/digest.js';
import { generateDaily, dailyTeams } from './agents/daily.js';
import { orgTree, personView, meId } from './org.js';
import { projectsForTeam, projectDetail } from './projects.js';

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

app.get('/api/org', (_req, res) => res.json(orgTree()));
app.get('/api/person/:id', (req, res) => {
  const view = personView(req.params.id === 'me' ? meId() : req.params.id);
  if (!view) return res.status(404).json({ error: 'לא נמצא' });
  res.json(view);
});

app.get('/api/projects', (req, res) => res.json(projectsForTeam(String(req.query.team || meId()))));
app.get('/api/project/:id', (req, res) => {
  const detail = projectDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'פרויקט לא נמצא' });
  res.json(detail);
});

app.get('/api/daily/teams', (_req, res) => res.json(dailyTeams()));
app.post('/api/daily', async (req, res) => {
  const teamId = req.body?.teamId;
  if (!dailyTeams().some((t) => t.id === teamId)) return res.status(400).json({ error: 'צוות לא תקין' });
  if (!llmReady()) return res.status(500).json({ error: 'ANTHROPIC_API_KEY חסר בקובץ .env' });
  try {
    res.json(await generateDaily(teamId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
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

import 'dotenv/config';
import express from 'express';
import { streamChat, llmReady } from './llm.js';
import { generateDigest } from './agents/digest.js';
import { taskDetail } from './tasks.js';
import { search } from './search.js';
import { computeWeekly, generateWeekly } from './agents/weekly.js';
import { personSchedule } from './schedule.js';
import { listFeedback, saveFeedback } from './feedback.js';
import { generateDaily, dailyTeams, computeDaily } from './agents/daily.js';
import { orgTree, personView, meId } from './org.js';
import { pool, placePerson, removePerson, renameTeam, createTeam, OrgError } from './orgEdit.js';
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
// Org editing. Every successful change answers with the new tree and pool.
const orgState = () => ({ tree: orgTree(), pool: pool() });
const orgAction = (fn) => (req, res) => {
  try {
    fn(req);
    res.json(orgState());
  } catch (err) {
    if (!(err instanceof OrgError)) console.error(err);
    res.status(err instanceof OrgError ? 400 : 500).json({ error: err.message });
  }
};
app.get('/api/org/pool', (_req, res) => res.json(pool()));
app.put('/api/org/people/:id', orgAction((req) => placePerson(req.params.id, req.body?.managerId)));
app.delete('/api/org/people/:id', orgAction((req) => removePerson(req.params.id)));
app.put('/api/org/teams/:id', orgAction((req) => renameTeam(req.params.id, req.body?.name)));
app.post('/api/org/teams', orgAction((req) => createTeam(req.body ?? {})));

app.get('/api/person/:id/schedule', (req, res) => {
  const schedule = personSchedule(req.params.id === 'me' ? meId() : req.params.id, req.query.week);
  if (!schedule) return res.status(404).json({ error: 'לא נמצא' });
  res.json(schedule);
});
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
// Numbers only (no LLM), so the charts show up immediately.
app.get('/api/daily/:teamId/stats', (req, res) => {
  if (!dailyTeams().some((t) => t.id === req.params.teamId)) return res.status(404).json({ error: 'צוות לא תקין' });
  res.json(computeDaily(req.params.teamId));
});
app.post('/api/daily',async (req, res) => {
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

app.get('/api/feedback', (_req, res) => res.json(listFeedback()));
app.post('/api/feedback', (req, res) => {
  if (!saveFeedback(req.body ?? {})) return res.status(400).json({ error: 'משוב לא תקין' });
  res.json({ ok: true });
});

const validTeam = (id) => dailyTeams().some((t) => t.id === id);
app.get('/api/weekly/:teamId/stats', (req, res) => {
  if (!validTeam(req.params.teamId)) return res.status(404).json({ error: 'צוות לא תקין' });
  res.json(computeWeekly(req.params.teamId));
});
app.post('/api/weekly', async (req, res) => {
  const teamId = req.body?.teamId;
  if (!validTeam(teamId)) return res.status(400).json({ error: 'צוות לא תקין' });
  if (!llmReady()) return res.status(500).json({ error: 'ANTHROPIC_API_KEY חסר בקובץ .env' });
  try {
    res.json(await generateWeekly(teamId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/search', (req, res) => res.json(search(String(req.query.q ?? '').slice(0, 100), req.query.type)));
app.get('/api/task/:key', (req, res) => {
  const task = taskDetail(req.params.key);
  if (!task) return res.status(404).json({ error: 'משימה לא נמצאה' });
  res.json(task);
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

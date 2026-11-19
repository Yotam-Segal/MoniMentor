import { readFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
export const team = load('team.json');
export const jira = load('jira.json');
export const git = load('git.json');
export const name = (id) => team.find((p) => p.id === id)?.fullName ?? id;

// Mock data is anchored to this date (latest commit), not the wall clock.
export const REPORT_DATE = '2026-11-12';

// Mock data is small, so it is injected whole. Replaced by RAG retrieval in a later stage.
export const TEAM_CONTEXT = `

התאריך היום: ${REPORT_DATE}. נתוני הדמה הבאים הם כל המידע שיש לך – אל תמציא מעבר להם.

חברי הצוות:
${team.map((p) => `- ${p.fullName} | ${p.role} | ${p.city} | הכשרה: ${p.training}`).join('\n')}

ספרינטים: ${jira.sprints.map((s) => `${s.name} (${s.start}–${s.end}, ${s.state})`).join('; ')}

כרטיסי Jira (מפתח | כותרת | אחראי | סוג | סטטוס | נקודות | ספרינט | נוצר | נסגר | הערה):
${jira.tickets
  .map((t) => [t.key, t.title, name(t.assignee), t.type, t.status, t.points, t.sprint, t.created, t.resolved ?? '-', t.note ?? ''].join(' | '))
  .join('\n')}

קומיטים ב-Git (hash | כותרת | כותב | תאריך | קבצים | +שורות/-שורות | כרטיס):
${git.commits
  .map((c) => [c.hash, c.message, name(c.author), c.date, c.files, `+${c.additions}/-${c.deletions}`, c.ticket].join(' | '))
  .join('\n')}`;

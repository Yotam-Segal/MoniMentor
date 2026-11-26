import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const load = (f) => JSON.parse(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'));
export const team = load('team.json');
export const jira = load('jira.json');
export const git = load('git.json');
export const calendar = load('calendar.json');
export const projects = load('projects.json');
// The signed-in manager (no auth yet).
export const ME_ID = 'd0';
export const name = (id) => team.find((p) => p.id === id)?.fullName ?? id;

// `team` is the whole pool of people. Someone is in the org when they are ME or report (indirectly) to ME.
// Edits made in the UI are saved apart from the seed data (git-ignored) and re-applied on startup.
const ORG_FILE = process.env.ORG_FILE || new URL('./data/org.local.json', import.meta.url);
if (existsSync(ORG_FILE)) {
  const saved = JSON.parse(readFileSync(ORG_FILE, 'utf8'));
  for (const p of team) if (saved[p.id]) Object.assign(p, saved[p.id]);
}
export const saveOrg = () =>
  writeFileSync(
    ORG_FILE,
    JSON.stringify(Object.fromEntries(team.map((p) => [p.id, { managerId: p.managerId, teamName: p.teamName ?? null }])), null, 2),
  );

export const subtreeIds = (id) => [id, ...team.filter((p) => p.managerId === id).flatMap((p) => subtreeIds(p.id))];
export const orgMembers = () => {
  const ids = new Set(subtreeIds(ME_ID));
  return team.filter((p) => ids.has(p.id));
};
export const teamLabel = (p) => p.teamName || `הצוות של ${p.fullName}`;

// Mock data is anchored to this date (latest commit), not the wall clock.
export const REPORT_DATE = '2026-11-12';

// Mock data is small, so it is injected whole. Replaced by RAG retrieval in a later stage.
// A function, not a constant: the org can change while the server runs.
export const teamContext = () => `

התאריך היום: ${REPORT_DATE}. נתוני הדמה הבאים הם כל המידע שיש לך – אל תמציא מעבר להם.

חברי הצוות:
${orgMembers().map((p) => `- ${p.fullName} | ${p.role} | ${p.city} | הכשרה: ${p.training} | כפוף ל: ${p.id === ME_ID ? '— (המשתמשת הנוכחית)' : name(p.managerId)}${p.teamName ? ` | מוביל את ${p.teamName}` : ''}`).join('\n')}

ספרינטים: ${jira.sprints.map((s) => `${s.name} (${s.start}–${s.end}, ${s.state})`).join('; ')}

כרטיסי Jira (מפתח | כותרת | אחראי | סוג | סטטוס | נקודות | ספרינט | נוצר | נסגר | פרויקט | הערה):
${jira.tickets
  .map((t) => [t.key, t.title, name(t.assignee), t.type, t.status, t.points, t.sprint, t.created, t.resolved ?? '-', t.project ?? '-', t.note ?? ''].join(' | '))
  .join('\n')}

פרויקטים (מזהה | שם | אחראי | התחלה | יעד | שלב):
${projects.map((p) => [p.id, p.name, name(p.ownerId), p.start, p.target, p.phase].join(' | ')).join('\n')}

קומיטים ב-Git (hash | כותרת | כותב | תאריך | קבצים | +שורות/-שורות | כרטיס):
${git.commits
  .map((c) => [c.hash, c.message, name(c.author), c.date, c.files, `+${c.additions}/-${c.deletions}`, c.ticket].join(' | '))
  .join('\n')}`;

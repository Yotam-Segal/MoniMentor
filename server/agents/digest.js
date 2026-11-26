import { orgMembers, jira, git, teamContext, REPORT_DATE } from '../data.js';
import { complete } from '../llm.js';

const WEEK_START = '2026-11-06';
const inWeek = (d) => d >= WEEK_START && d <= REPORT_DATE;

// Deterministic facts first – the LLM only narrates them, it does not compute them.
export function computeStats() {
  const active = jira.sprints.find((s) => s.state === 'active');
  const sprintTickets = jira.tickets.filter((t) => t.sprint === active.name);
  const byStatus = {};
  for (const t of sprintTickets) byStatus[t.status] = (byStatus[t.status] ?? 0) + t.points;
  const totalPoints = sprintTickets.reduce((s, t) => s + t.points, 0);

  const weekCommits = git.commits.filter((c) => inWeek(c.date));
  const people = orgMembers().map((p) => {
    const commits = weekCommits.filter((c) => c.author === p.id);
    const open = sprintTickets.filter((t) => t.assignee === p.id && t.status !== 'Done');
    return {
      id: p.id,
      name: p.fullName,
      role: p.role,
      commits: commits.length,
      linesChanged: commits.reduce((s, c) => s + c.additions + c.deletions, 0),
      closedThisWeek: jira.tickets.filter((t) => t.assignee === p.id && t.resolved && inWeek(t.resolved)).length,
      openPoints: open.reduce((s, t) => s + t.points, 0),
    };
  });

  return {
    week: { from: WEEK_START, to: REPORT_DATE },
    sprint: active.name,
    sprintTotalPoints: totalPoints,
    pointsByStatus: byStatus,
    blocked: sprintTickets.filter((t) => t.status === 'Blocked').map((t) => ({ key: t.key, title: t.title, note: t.note })),
    weekCommitCount: weekCommits.length,
    people,
  };
}

const SYSTEM = `אתה סוכן סיכומי הנהלה (Executive Digest Agent) של MoniMentor.
כתוב סיכום שבועי להנהלת החברה בעברית, בשפה עסקית נקייה ללא ז'רגון טכני.
פורמט Markdown בלבד, עם הסעיפים האלה בדיוק:
## תמצית
(2–3 משפטים)
## הישגים השבוע
## סיכונים וחסמים
## המלצות לשבוע הבא
השתמש רק בנתונים שסופקו, אל תמציא מספרים או עובדות. הנתונים המספריים בבלוק "סטטיסטיקות" מחושבים מראש – הסתמך עליהם.`;

export async function generateDigest() {
  const stats = computeStats();
  const markdown = await complete({
    system: SYSTEM,
    prompt: `סטטיסטיקות:\n${JSON.stringify(stats, null, 2)}${teamContext()}\n\nהפק את הסיכום השבועי.`,
    maxTokens: 2000,
  });
  return { stats, markdown, generatedAt: new Date().toISOString() };
}

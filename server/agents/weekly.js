import { team, teamLabel, jira, subtreeIds, REPORT_DATE } from '../data.js';
import { getEvents, addDays, dayOfWeek } from '../outlook.js';
import { daysBetween, WORKDAY } from '../schedule.js';
import { projectsForTeam } from '../projects.js';
import { complete } from '../llm.js';

// Same assumption as the capacity screen's default.
const HOURS_PER_POINT = 4;
const byId = (id) => team.find((p) => p.id === id);
const sum = (arr, f) => Math.round(arr.reduce((s, x) => s + f(x), 0) * 100) / 100;

// Forward-looking view of the coming work week (the Sunday after "today", through Thursday).
export function computeWeekly(teamId) {
  const from = addDays(REPORT_DATE, 7 - dayOfWeek(REPORT_DATE));
  const to = addDays(from, 4);
  const memberIds = subtreeIds(teamId);
  const activeSprint = jira.sprints.find((s) => s.state === 'active');
  const open = jira.tickets.filter((t) => memberIds.includes(t.assignee) && t.status !== 'Done');
  const inScope = open.filter((t) => t.sprint === activeSprint.name);
  const brief = (t) => ({
    key: t.key,
    title: t.title,
    assignee: byId(t.assignee).fullName,
    status: t.status,
    points: t.points,
    due: t.due ?? null,
    note: t.note ?? null,
  });

  const calendars = Object.fromEntries(memberIds.map((id) => [id, daysBetween(id, from, to)]));

  const days = [0, 1, 2, 3, 4].map((i) => {
    const date = addDays(from, i);
    // A meeting shared by several members is listed once.
    const meetings = new Map();
    for (const id of memberIds) {
      for (const e of getEvents(id, date, date)) {
        const key = `${e.start}|${e.end}|${e.title}`;
        const m = meetings.get(key) ?? { start: e.start, end: e.end, title: e.title, attendees: [] };
        m.attendees.push(byId(id).fullName);
        meetings.set(key, m);
      }
    }
    return {
      date,
      freeHours: sum(memberIds, (id) => calendars[id][i].freeHours),
      meetings: [...meetings.values()].sort((a, b) => a.start.localeCompare(b.start)),
      due: open.filter((t) => t.due === date).map(brief),
    };
  });

  const people = memberIds.map((id) => {
    const mine = inScope.filter((t) => t.assignee === id);
    const freeHours = sum(calendars[id], (d) => d.freeHours);
    const neededHours = sum(mine, (t) => t.points * HOURS_PER_POINT);
    return {
      id,
      name: byId(id).fullName,
      role: byId(id).role,
      freeHours,
      neededHours,
      load: freeHours ? Math.round((neededHours / freeHours) * 100) : neededHours ? 999 : 0,
      tasks: mine.map((t) => `${t.key} ${t.title} (${t.status})`),
    };
  });

  return {
    team: teamLabel(byId(teamId)),
    week: { from, to },
    asOf: REPORT_DATE,
    assumptions: { workday: `${WORKDAY.start}-${WORKDAY.end}`, hoursPerPoint: HOURS_PER_POINT },
    sprint: { name: activeSprint.name, end: activeSprint.end },
    days,
    people,
    carriedOver: open.filter((t) => t.status === 'Blocked' || (t.due && t.due < from)).map(brief),
    openTasks: inScope.map(brief),
    projects: projectsForTeam(teamId).map((p) => ({
      id: p.id,
      name: p.name,
      target: p.target,
      progress: p.progress,
      expectedProgress: p.expectedProgress,
      health: p.healthText,
    })),
  };
}

const SYSTEM = `אתה סוכן התכנון השבועי (Weekly Planning Agent) של MoniMentor.
תפקידך: להפיק למפקד צוות תוכנית לשבוע העבודה הקרוב, בעברית פשוטה וישירה.
פורמט Markdown בלבד – כותרות ## ורשימות עם "-" והדגשות **bold**. בלי טבלאות.
מבנה המסמך, בדיוק:
## תמונת השבוע
(2–3 משפטים: תאריכים, מועד סיום הספרינט, העומס מול הזמן הפנוי)
## יעדים לשבוע
(3–6 יעדים מדידים לפי יעדי משימות, חסמים ופרויקטים בסיכון)
## תכנון לפי יום
(לכל יום: משימות שמגיע מועדן, פגישות מרכזיות – לא לפרט דיילי חוזר, ומה כדאי לקדם)
## עומס לפי אדם
(שעות פנויות מול נדרשות, ומי בחריגה; הצע העברה או דחייה רק אם יש בצוות מי שיש לו מקום)
## סיכונים והחלטות
(חסמים ופיגורים שנגררים, והחלטות שצריך לקבל בתחילת השבוע)
השתמש רק בנתונים שסופקו, אל תמציא. זכור שההערכה בשעות מבוססת על ההנחה שבשדה assumptions ואינה כוללת עבודה שכבר נעשתה.`;

export async function generateWeekly(teamId) {
  const stats = computeWeekly(teamId);
  const markdown = await complete({
    system: SYSTEM,
    prompt: `נתוני השבוע הקרוב (JSON):\n${JSON.stringify(stats)}\n\nהפק את התוכנית השבועית.`,
    maxTokens: 3500,
  });
  return { stats, markdown, generatedAt: new Date().toISOString() };
}

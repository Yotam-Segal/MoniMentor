import { team, teamLabel, jira, git, ME_ID, REPORT_DATE } from '../data.js';
import { getEvents } from '../outlook.js';
import { complete } from '../llm.js';
import { projectsForTeam } from '../projects.js';

const byId = (id) => team.find((p) => p.id === id);
const DAY_MS = 86400000;
const day = (d) => new Date(`${d}T12:00:00`).getTime();
const addDays = (d, n) => new Date(day(d) + n * DAY_MS).toISOString().slice(0, 10);
const reportsOf = (id) => team.filter((p) => p.managerId === id);
const subtree = (id) => [id, ...reportsOf(id).flatMap((r) => subtree(r.id))];

// Managers (below the signed-in user) that lead a team – the daily can be produced for each.
export function dailyTeams() {
  const walk = (id) => reportsOf(id).flatMap((r) => (reportsOf(r.id).length ? [r, ...walk(r.id)] : []));
  return walk(ME_ID).map((m) => ({ id: m.id, name: teamLabel(m), size: subtree(m.id).length - 1 }));
}

// Work days between two dates (Sun–Thu, Israeli work week).
function workdays(from, to) {
  let n = 0;
  for (let t = day(from); t < day(to); t += DAY_MS) {
    const dow = new Date(t).getDay();
    if (dow !== 5 && dow !== 6) n++;
  }
  return n;
}

const VELOCITY_WINDOW_DAYS = 14;

export function computeDaily(teamId) {
  const manager = byId(teamId);
  const memberIds = new Set(subtree(teamId));
  const projects = projectsForTeam(teamId);
  const healthOf = Object.fromEntries(projects.map((p) => [p.id, p]));
  const activeSprint = jira.sprints.find((s) => s.state === 'active');

  // Pace per project: points still needed per work day vs. what the project closed recently.
  const windowStart = addDays(REPORT_DATE, -VELOCITY_WINDOW_DAYS);
  const pace = projects.map((p) => {
    const tickets = jira.tickets.filter((t) => t.project === p.id);
    const remaining = tickets.filter((t) => t.status !== 'Done').reduce((s, t) => s + t.points, 0);
    const recentDone = tickets.filter((t) => t.resolved && t.resolved > windowStart).reduce((s, t) => s + t.points, 0);
    const daysLeft = Math.max(1, workdays(REPORT_DATE, p.target));
    const need = remaining / daysLeft;
    const velocity = recentDone / workdays(windowStart, REPORT_DATE);
    return {
      id: p.id,
      name: p.name,
      target: p.target,
      workdaysLeft: daysLeft,
      remainingPoints: remaining,
      requiredPerWorkday: Number(need.toFixed(2)),
      recentPerWorkday: Number(velocity.toFixed(2)),
      // A tiny required pace (far-off deadline) is not worth flagging as "behind".
      onPace: remaining === 0 || need < 0.5 || velocity >= need * 0.9,
      health: p.health,
      healthText: p.healthText,
    };
  });
  const paceOf = Object.fromEntries(pace.map((p) => [p.id, p]));

  // Priority = why this ticket needs attention now.
  const open = jira.tickets.filter((t) => memberIds.has(t.assignee) && t.status !== 'Done' && t.sprint === activeSprint.name);
  const prioritized = open
    .map((t) => {
      const reasons = [];
      let score = 0;
      const proj = t.project ? healthOf[t.project] ?? paceOf[t.project] : null;
      if (t.status === 'Blocked') { score += 100; reasons.push(t.note ?? 'חסום'); }
      if (t.due && t.due < REPORT_DATE) { score += 80; reasons.push(`באיחור (יעד ${t.due})`); }
      else if (t.due && t.due <= addDays(REPORT_DATE, 7)) { score += 15; reasons.push(`יעד קרוב (${t.due})`); }
      if (t.project && paceOf[t.project] && !paceOf[t.project].onPace) { score += 40; reasons.push('הפרויקט מפגר אחרי הקצב הנדרש'); }
      if (proj?.health === 'at_risk') { score += 25; reasons.push('הפרויקט בסיכון'); }
      if (t.status === 'In Review') { score += 20; reasons.push('ממתין לסקירה – אפשר לסגור מהר'); }
      if (t.status === 'In Progress') score += 10;
      return {
        key: t.key,
        title: t.title,
        assignee: byId(t.assignee).fullName,
        assigneeId: t.assignee,
        status: t.status,
        points: t.points,
        project: t.project ? (healthOf[t.project]?.name ?? t.project) : null,
        projectId: t.project ?? null,
        overdue: Boolean(t.due && t.due < REPORT_DATE),
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Open tickets of lagging/at-risk projects that nobody has started yet – candidates to pull forward.
  const toAdvance = jira.tickets
    .filter((t) => t.project && memberIds.has(t.assignee) && t.status === 'To Do' && paceOf[t.project] && (!paceOf[t.project].onPace || healthOf[t.project]?.health !== 'on_track'))
    .map((t) => ({
      key: t.key,
      title: t.title,
      assignee: byId(t.assignee).fullName,
      points: t.points,
      sprint: t.sprint,
      project: healthOf[t.project]?.name,
      workdaysToTarget: paceOf[t.project].workdaysLeft,
    }));

  const since = addDays(REPORT_DATE, -1);
  const people = [...memberIds].map((id) => {
    const p = byId(id);
    const mine = open.filter((t) => t.assignee === id);
    return {
      name: p.fullName,
      role: p.role,
      inProgress: mine.filter((t) => t.status === 'In Progress').map((t) => `${t.key} ${t.title}`),
      inReview: mine.filter((t) => t.status === 'In Review').map((t) => `${t.key} ${t.title}`),
      blocked: mine.filter((t) => t.status === 'Blocked').map((t) => `${t.key} ${t.title}${t.note ? ` (${t.note})` : ''}`),
      notStarted: mine.filter((t) => t.status === 'To Do').map((t) => `${t.key} ${t.title}`),
      openPoints: mine.reduce((s, t) => s + t.points, 0),
      commitsSinceLastDaily: git.commits.filter((c) => c.author === id && c.date >= since).map((c) => `${c.hash} ${c.message}`),
      meetingsToday: getEvents(id, REPORT_DATE, REPORT_DATE).map((e) => `${e.start} ${e.title}`),
    };
  });

  return {
    team: teamLabel(manager),
    manager: manager.fullName,
    date: REPORT_DATE,
    sprint: { name: activeSprint.name, end: activeSprint.end, workdaysLeft: workdays(REPORT_DATE, addDays(activeSprint.end, 1)) },
    projects: pace,
    prioritized,
    toAdvance,
    people: people.filter((p) => p.name !== manager.fullName || p.inProgress.length || p.blocked.length || p.notStarted.length),
  };
}

const SYSTEM = `אתה סוכן הכנת הדיילי (Daily Stand-up Agent) של MoniMentor.
תפקידך: להפיק למפקד צוות מסמך קצר לפגישת הדיילי של הבוקר, בעברית פשוטה וישירה.
פורמט Markdown בלבד – כותרות ## ורשימות עם "-" והדגשות **bold**. בלי טבלאות.
מבנה המסמך, בדיוק:
## תמונת מצב
(2–3 משפטים: ספרינט, ימי עבודה שנותרו, מצב הפרויקטים לפי הקצב הנדרש)
## משימות בתעדוף עכשיו
(עד 7 משימות מהרשימה "prioritized" לפי הסדר שלה: מפתח, כותרת, אחראי, ולמה היא דחופה)
## מה צריך לקדם כדי לעמוד ביעדי הפרויקטים
(לכל פרויקט שמפגר או בסיכון: כמה נקודות נשארו, מה הקצב הנדרש לעומת הקצב בפועל, ואילו משימות מ-"toAdvance" כדאי להתחיל השבוע)
## לפי אדם
(שורה לכל אדם: על מה עבד לאחרונה, על מה עובד עכשיו, חסמים, פגישות היום)
## שאלות והחלטות לדיילי
(3–5 שאלות מעשיות לפתיחת הפגישה, למשל פירוק חסמים)
השתמש רק בנתונים שסופקו. אל תמציא משימות, מספרים או תאריכים. אם אין נתון – אל תציין אותו.`;

export async function generateDaily(teamId) {
  const stats = computeDaily(teamId);
  const markdown = await complete({
    system: SYSTEM,
    prompt: `נתוני היום (JSON):\n${JSON.stringify(stats, null, 1)}\n\nהפק את מסמך הדיילי.`,
    maxTokens: 2500,
  });
  return { stats, markdown, generatedAt: new Date().toISOString() };
}

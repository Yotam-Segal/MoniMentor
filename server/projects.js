import { team, jira, git, projects, REPORT_DATE } from './data.js';

const byId = (id) => team.find((p) => p.id === id);
const pub = (p) => ({ id: p.id, fullName: p.fullName, role: p.role, photo: p.photo ?? null });
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const day = (d) => new Date(`${d}T12:00:00`).getTime();
const DAY_MS = 86400000;

function subtreeIds(id) {
  return [id, ...team.filter((p) => p.managerId === id).flatMap((p) => subtreeIds(p.id))];
}

const STATUSES = ['Done', 'In Review', 'In Progress', 'Blocked', 'To Do'];

function summarize(project) {
  const tickets = jira.tickets.filter((t) => t.project === project.id);
  const total = sum(tickets, (t) => t.points);
  const done = sum(tickets.filter((t) => t.status === 'Done'), (t) => t.points);
  const progress = total ? Math.round((done / total) * 100) : 0;

  const span = day(project.target) - day(project.start);
  const elapsed = Math.min(1, Math.max(0, (day(REPORT_DATE) - day(project.start)) / span));
  const expected = Math.round(elapsed * 100);

  const open = tickets.filter((t) => t.status !== 'Done');
  const blocked = open.filter((t) => t.status === 'Blocked');
  const overdue = open.filter((t) => t.due && t.due < REPORT_DATE);

  let health = 'on_track';
  let healthText = 'בקצב';
  if (blocked.length || overdue.length) {
    health = 'at_risk';
    healthText = `בסיכון – ${blocked.length} חסומים, ${overdue.length} באיחור`;
  } else if (progress < expected - 15) {
    health = 'watch';
    healthText = `מאחר ללוח הזמנים (${progress}% מול ${expected}% צפוי)`;
  }

  const memberIds = [...new Set(tickets.map((t) => t.assignee))];
  return {
    ...project,
    owner: pub(byId(project.ownerId)),
    members: memberIds.map((id) => pub(byId(id))),
    ticketCount: tickets.length,
    totalPoints: total,
    donePoints: done,
    progress,
    expectedProgress: expected,
    daysLeft: Math.round((day(project.target) - day(REPORT_DATE)) / DAY_MS),
    health,
    healthText,
  };
}

// Projects in which anyone from the manager's organisation has tickets (or that the manager owns).
export function projectsForTeam(managerId) {
  const ids = new Set(subtreeIds(managerId));
  return projects
    .filter((p) => p.ownerId === managerId || jira.tickets.some((t) => t.project === p.id && ids.has(t.assignee)))
    .map(summarize);
}

export function projectDetail(projectId) {
  const project = projects.find((p) => p.id === projectId);
  if (!project) return null;
  const tickets = jira.tickets.filter((t) => t.project === projectId);
  const summary = summarize(project);

  const byStatus = STATUSES.map((s) => {
    const ts = tickets.filter((t) => t.status === s);
    return { status: s, tickets: ts.length, points: sum(ts, (t) => t.points) };
  });

  const people = summary.members.map((m) => {
    const mine = tickets.filter((t) => t.assignee === m.id);
    return {
      ...m,
      tickets: mine.length,
      donePoints: sum(mine.filter((t) => t.status === 'Done'), (t) => t.points),
      openPoints: sum(mine.filter((t) => t.status !== 'Done'), (t) => t.points),
    };
  });

  // Burn-up: cumulative scope (by creation) and completed work (by resolution), daily up to "today".
  const burnup = [];
  for (let t = day(project.start); t <= day(REPORT_DATE); t += DAY_MS) {
    const d = new Date(t).toISOString().slice(0, 10);
    burnup.push({
      date: d,
      scope: sum(tickets.filter((x) => x.created <= d), (x) => x.points),
      done: sum(tickets.filter((x) => x.resolved && x.resolved <= d), (x) => x.points),
    });
  }

  const risks = tickets
    .filter((t) => t.status !== 'Done' && (t.status === 'Blocked' || (t.due && t.due < REPORT_DATE)))
    .map((t) => ({
      key: t.key,
      text: t.status === 'Blocked' ? (t.note ?? `${t.title} – חסום`) : `${t.title} – באיחור (יעד ${t.due})`,
      assignee: byId(t.assignee)?.fullName,
      assigneeId: t.assignee,
    }));

  const keys = new Set(tickets.map((t) => t.key));
  return {
    ...summary,
    today: REPORT_DATE,
    byStatus,
    people,
    burnup,
    risks,
    tickets: tickets.map((t) => ({ ...t, assigneeName: byId(t.assignee)?.fullName })),
    commits: git.commits
      .filter((c) => keys.has(c.ticket))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map((c) => ({ ...c, authorName: byId(c.author)?.fullName })),
  };
}

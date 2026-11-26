import { team, jira, git, ME_ID, REPORT_DATE } from './data.js';
import { getEvents, addDays } from './outlook.js';

const byId = (id) => team.find((p) => p.id === id);
const publicPerson = (p) => ({ id: p.id, fullName: p.fullName, role: p.role, city: p.city, photo: p.photo ?? null, teamName: p.teamName ?? null });
const reportsOf = (id) => team.filter((p) => p.managerId === id);

function descendants(id) {
  const out = [];
  for (const r of reportsOf(id)) out.push(r, ...descendants(r.id));
  return out;
}

export function orgTree(rootId = ME_ID) {
  const node = (p) => ({ ...publicPerson(p), reports: reportsOf(p.id).map(node) });
  return node(byId(rootId));
}

const WEEK_START = '2026-11-06';
const OVERLOAD_POINTS = 13;
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

// Rules that decide what "needs attention" for a person's own tickets.
function attentionFor(personId, label) {
  const tickets = jira.tickets.filter((t) => t.assignee === personId);
  const open = tickets.filter((t) => t.status !== 'Done');
  const items = [];
  const who = label ? `${label}: ` : '';
  for (const t of open) {
    const overdue = t.due && t.due < REPORT_DATE;
    if (t.status === 'Blocked') {
      items.push({ severity: 'high', personId, ticket: t.key, text: `${who}${t.key} ${t.note ?? `חסום – ${t.title}`}` });
    } else if (overdue) {
      items.push({ severity: 'high', personId, ticket: t.key, text: `${who}${t.key} באיחור (יעד ${t.due}) – ${t.title}` });
    } else if (t.status === 'In Review') {
      items.push({ severity: 'low', personId, ticket: t.key, text: `${who}${t.key} ממתין לסקירה – ${t.title}` });
    }
  }
  const openPoints = open.reduce((s, t) => s + t.points, 0);
  if (openPoints >= OVERLOAD_POINTS) {
    items.push({ severity: 'medium', personId, text: `${who}עומס גבוה: ${openPoints} נקודות פתוחות` });
  }
  return items;
}

export function personView(id) {
  const p = byId(id);
  if (!p) return null;
  const reports = reportsOf(id);
  const tickets = jira.tickets.filter((t) => t.assignee === id);
  const open = tickets.filter((t) => t.status !== 'Done');
  const commits = git.commits.filter((c) => c.author === id);

  const attention = [
    ...attentionFor(id),
    // Managers also see problems anywhere in their organisation.
    ...descendants(id).flatMap((d) => attentionFor(d.id, d.fullName)),
  ].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Upcoming week from the person's Outlook calendar.
  const events = getEvents(id, REPORT_DATE, addDays(REPORT_DATE, 6))
    .map((e) => ({ ...e, with: e.people.filter((x) => x !== id).map((x) => byId(x)?.fullName) }));

  const manager = p.managerId ? byId(p.managerId) : null;
  return {
    ...publicPerson(p),
    training: p.training,
    skills: p.skills,
    isMe: id === ME_ID,
    manager: manager && publicPerson(manager),
    reports: reports.map(publicPerson),
    orgSize: descendants(id).length,
    stats: {
      openTickets: open.length,
      openPoints: open.reduce((s, t) => s + t.points, 0),
      closedThisWeek: tickets.filter((t) => t.resolved && t.resolved >= WEEK_START).length,
      commitsThisWeek: commits.filter((c) => c.date >= WEEK_START).length,
    },
    attention,
    events,
    openTickets: open,
    recentCommits: [...commits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  };
}

export const meId = () => ME_ID;

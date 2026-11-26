import { team, jira, git, calendar, projects, REPORT_DATE } from './data.js';

const byId = (id) => team.find((p) => p.id === id);
const pub = (p) => p && { id: p.id, fullName: p.fullName, role: p.role, photo: p.photo ?? null };

export function taskDetail(key) {
  const t = jira.tickets.find((x) => x.key === key);
  if (!t) return null;

  const commits = git.commits
    .filter((c) => c.ticket === key)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({ ...c, authorName: byId(c.author)?.fullName }));

  const meetings = calendar
    .filter((e) => e.title.includes(key))
    .map((e) => ({ ...e, people: e.people.map((id) => byId(id)?.fullName) }));

  const project = projects.find((p) => p.id === t.project);
  const history = [
    { date: t.created, text: 'המשימה נוצרה' },
    ...commits.map((c) => ({ date: c.date, text: `קומיט של ${c.authorName}: ${c.message}` })),
    ...(t.resolved ? [{ date: t.resolved, text: 'המשימה נסגרה' }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    ...t,
    assignee: pub(byId(t.assignee)),
    project: project ? { id: project.id, name: project.name } : null,
    sprint: jira.sprints.find((s) => s.name === t.sprint) ?? { name: t.sprint },
    overdue: Boolean(t.status !== 'Done' && t.due && t.due < REPORT_DATE),
    commits,
    changes: {
      files: commits.reduce((s, c) => s + c.files, 0),
      additions: commits.reduce((s, c) => s + c.additions, 0),
      deletions: commits.reduce((s, c) => s + c.deletions, 0),
    },
    meetings,
    history,
    related: jira.tickets
      .filter((x) => x.key !== key && t.project && x.project === t.project)
      .map((x) => ({ key: x.key, title: x.title, status: x.status, assigneeName: byId(x.assignee)?.fullName })),
  };
}

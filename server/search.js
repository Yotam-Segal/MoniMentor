import { jira, projects, orgMembers, name } from './data.js';

const LIMIT = 6; // per group in a general search
const LIMIT_SINGLE = 20; // when the search is narrowed to one type
export const TYPES = ['people', 'projects', 'tasks'];
const norm = (s) => String(s ?? '').toLowerCase().replace(/["'״׳]/g, '');

// Every word of the query must appear somewhere in the item; hits in the main title rank first.
function match(items, words, titleOf, restOf, limit) {
  return items
    .map((item) => {
      const title = norm(titleOf(item));
      const all = `${title} ${norm(restOf(item))}`;
      if (!words.every((w) => all.includes(w))) return null;
      return { item, rank: words.every((w) => title.includes(w)) ? 0 : 1 };
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((x) => x.item);
}

export function search(query, type) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { people: [], projects: [], tasks: [] };
  const only = TYPES.includes(type) ? type : null; // anything else = search everything
  // A limit of 0 empties the groups the user filtered out.
  const limit = (group) => (!only ? LIMIT : only === group ? LIMIT_SINGLE : 0);
  return {
    people: match(orgMembers(), words, (p) => p.fullName, (p) => `${p.role} ${p.city} ${p.teamName ?? ''} ${(p.skills ?? []).join(' ')}`, limit('people')).map(
      (p) => ({ id: p.id, title: p.fullName, subtitle: `${p.role} · ${p.city}` }),
    ),
    projects: match(projects, words, (p) => p.name, (p) => p.description, limit('projects')).map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: p.description,
    })),
    tasks: match(jira.tickets, words, (t) => `${t.key} ${t.title}`, (t) => `${t.description ?? ''} ${name(t.assignee)}`, limit('tasks')).map((t) => ({
      id: t.key,
      title: `${t.key} · ${t.title}`,
      subtitle: `${name(t.assignee)} · ${t.status}`,
    })),
  };
}

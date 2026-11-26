import { readFileSync } from 'node:fs';
import { calendar } from './data.js';

// SIMULATED Outlook calendar. Everything that needs a person's schedule goes through getEvents(), so a real
// connection (Microsoft Graph `calendarView`) can replace this file without touching the rest of the system.
export const SOURCE = 'Outlook (הדמיה)';

const recurring = JSON.parse(readFileSync(new URL('./data/recurring.json', import.meta.url), 'utf8'));
const noon = (d) => new Date(`${d}T12:00:00`);
export const addDays = (d, n) => {
  const x = noon(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
export const dayOfWeek = (d) => noon(d).getDay(); // 0 = Sunday

// All events of a person between two dates (inclusive), sorted by time.
export function getEvents(personId, from, to) {
  const events = calendar.filter((e) => e.people.includes(personId) && e.date >= from && e.date <= to);
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const dow = dayOfWeek(date);
    for (const r of recurring) {
      if (r.days.includes(dow) && r.people.includes(personId)) {
        events.push({ id: `${r.id}-${date}`, date, start: r.start, end: r.end, title: r.title, type: r.type, people: r.people });
      }
    }
  }
  return events.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

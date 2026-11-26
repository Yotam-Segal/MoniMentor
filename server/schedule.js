import { team, jira, orgMembers, REPORT_DATE } from './data.js';
import { getEvents, addDays, dayOfWeek, SOURCE } from './outlook.js';

// Working assumptions: 09:30–17:00, Sunday–Thursday.
export const WORKDAY = { start: '09:30', end: '17:00' };
const WORK_DOWS = [0, 1, 2, 3, 4];

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const DAY_START = toMin(WORKDAY.start);
const DAY_END = toMin(WORKDAY.end);
const hours = (min) => Math.round((min / 60) * 100) / 100;
const weekStart = (d) => addDays(d, -dayOfWeek(d));

// Busy time = union of meetings clipped to the working day (overlapping meetings are not counted twice).
function dayLoad(date, events) {
  const intervals = events
    .map((e) => [Math.max(toMin(e.start), DAY_START), Math.min(toMin(e.end), DAY_END)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const busy = [];
  for (const [a, b] of intervals) {
    const last = busy[busy.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else busy.push([a, b]);
  }
  const free = [];
  let cursor = DAY_START;
  for (const [a, b] of busy) {
    if (a > cursor) free.push([cursor, a]);
    cursor = b;
  }
  if (cursor < DAY_END) free.push([cursor, DAY_END]);
  const busyMin = busy.reduce((s, [a, b]) => s + b - a, 0);
  return {
    date,
    events,
    busyHours: hours(busyMin),
    freeHours: hours(DAY_END - DAY_START - busyMin),
    freeSlots: free.map(([a, b]) => ({ start: toTime(a), end: toTime(b) })),
  };
}

export function daysBetween(personId, from, to) {
  const events = getEvents(personId, from, to);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (WORK_DOWS.includes(dayOfWeek(d))) days.push(dayLoad(d, events.filter((e) => e.date === d)));
  }
  return days;
}

const sum = (arr, f) => Math.round(arr.reduce((s, x) => s + f(x), 0) * 100) / 100;
const activeSprint = () => jira.sprints.find((s) => s.state === 'active');
const openSprintTasks = (id) =>
  jira.tickets.filter((t) => t.assignee === id && t.status !== 'Done' && t.sprint === activeSprint().name);

// Free time left until the sprint ends, and the open work that has to fit into it.
function capacity(personId) {
  const sprint = activeSprint();
  const days = daysBetween(personId, REPORT_DATE, sprint.end);
  const tasks = openSprintTasks(personId)
    .map((t) => ({
      key: t.key,
      title: t.title,
      status: t.status,
      points: t.points,
      due: t.due ?? null,
      // free hours available until the task's own deadline (or the sprint end)
      freeUntilDue: sum(days.filter((d) => d.date <= (t.due && t.due >= REPORT_DATE ? t.due : sprint.end)), (d) => d.freeHours),
      overdue: Boolean(t.due && t.due < REPORT_DATE),
    }))
    .sort((a, b) => (a.due ?? sprint.end).localeCompare(b.due ?? sprint.end));
  return {
    sprint: sprint.name,
    until: sprint.end,
    workdays: days.length,
    freeHours: sum(days, (d) => d.freeHours),
    openPoints: sum(tasks, (t) => t.points),
    tasks,
  };
}

export function personSchedule(personId, week) {
  const person = team.find((p) => p.id === personId);
  if (!person) return null;
  const from = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(week ?? '') ? week : REPORT_DATE);
  const to = addDays(from, 4);
  const days = daysBetween(personId, from, to).map((d) => ({
    ...d,
    events: d.events.map((e) => ({ ...e, with: e.people.filter((x) => x !== personId).map((x) => team.find((p) => p.id === x)?.fullName) })),
  }));

  const reports = team.filter((p) => p.managerId === personId);
  return {
    source: SOURCE,
    person: { id: person.id, fullName: person.fullName, role: person.role, photo: person.photo ?? null },
    today: REPORT_DATE,
    workday: { ...WORKDAY, hours: hours(DAY_END - DAY_START) },
    week: { from, to, previous: addDays(from, -7), next: addDays(from, 7) },
    days,
    weekFree: sum(days, (d) => d.freeHours),
    weekBusy: sum(days, (d) => d.busyHours),
    capacity: capacity(personId),
    team: reports.map((r) => {
      const c = capacity(r.id);
      return {
        id: r.id,
        fullName: r.fullName,
        weekFree: sum(daysBetween(r.id, from, to), (d) => d.freeHours),
        sprintFree: c.freeHours,
        openPoints: c.openPoints,
      };
    }),
  };
}

// Compact availability summary for the chat agent.
export function capacityContext() {
  const from = weekStart(REPORT_DATE);
  const next = addDays(from, 7);
  const lines = orgMembers().map((p) => {
    const free = (start) => sum(daysBetween(p.id, start, addDays(start, 4)), (d) => d.freeHours);
    const c = capacity(p.id);
    return `${p.fullName} | ${free(from)} | ${free(next)} | ${c.freeHours} | ${c.openPoints}`;
  });
  return `\n\nזמינות לפי יומני Outlook (יום עבודה ${WORKDAY.start}–${WORKDAY.end}, ראשון עד חמישי).
שם | שעות פנויות השבוע | שעות פנויות בשבוע הבא | שעות פנויות עד סוף הספרינט | נקודות פתוחות בספרינט:
${lines.join('\n')}`;
}

import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import { STATUS_HE } from '../../charts/charts.jsx';
import { TaskLink, linkTasks } from '../../components/TaskLink.jsx';

const HPP_KEY = 'mm.hoursPerPoint';
const PX_PER_MIN = 1.1;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const date = (d, opts) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', opts);
const h = (n) => `${Number(n.toFixed(2))} ש׳`;

const readHoursPerPoint = () => {
  try {
    return Number(localStorage.getItem(HPP_KEY)) || 4;
  } catch {
    return 4;
  }
};

// Overlapping meetings are drawn side by side.
function layout(events) {
  const out = [];
  let cluster = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = [];
    for (const e of cluster) {
      let lane = lanes.findIndex((end) => end <= toMin(e.start));
      if (lane === -1) lane = lanes.length;
      lanes[lane] = toMin(e.end);
      e.lane = lane;
    }
    for (const e of cluster) out.push({ ...e, lanes: lanes.length });
    cluster = [];
  };
  for (const e of [...events].sort((a, b) => toMin(a.start) - toMin(b.start))) {
    if (cluster.length && toMin(e.start) >= clusterEnd) flush();
    cluster.push({ ...e });
    clusterEnd = Math.max(clusterEnd, toMin(e.end));
  }
  flush();
  return out;
}

const loadClass = (ratio) => (ratio > 1 ? 'at_risk' : ratio > 0.8 ? 'watch' : 'on_track');
const loadText = (ratio) => (ratio > 1 ? 'חריגה מהזמן' : ratio > 0.8 ? 'עמוס' : 'יש מקום');

export default function SchedulePage({ id }) {
  const [week, setWeek] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [hpp, setHpp] = useState(readHoursPerPoint);

  useEffect(() => {
    let stale = false;
    setError('');
    fetch(`/api/person/${id}/schedule${week ? `?week=${week}` : ''}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `שגיאה ${r.status}`);
        return d;
      })
      .then((d) => !stale && setData(d))
      .catch((e) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [id, week]);

  function changeHpp(value) {
    const n = Math.min(40, Math.max(0.5, Number(value) || 0.5));
    setHpp(n);
    try {
      localStorage.setItem(HPP_KEY, String(n));
    } catch {
      /* not persisted */
    }
  }

  if (error) return <section className="wide"><p className="err">⚠️ {error}</p></section>;
  if (!data) return <section className="wide"><p className="muted">טוען…</p></section>;

  const { person, workday, days, capacity: cap } = data;
  const start = toMin(workday.start);
  const height = (toMin(workday.end) - start) * PX_PER_MIN;
  const hourMarks = [];
  for (let m = Math.ceil(start / 60) * 60; m <= toMin(workday.end); m += 60) hourMarks.push(m);

  const needed = cap.openPoints * hpp;
  const ratio = cap.freeHours ? needed / cap.freeHours : needed ? Infinity : 0;
  let cumulative = 0;

  return (
    <section className="wide person">
      <a className="back" href={id === 'me' ? '#/' : `#/person/${person.id}`}>
        ← חזרה לדף של {person.fullName}
      </a>
      <header className="profile">
        <Avatar person={person} size={64} />
        <div>
          <h1 className="pagetitle">לוח זמנים וקיבולת – {person.fullName}</h1>
          <div className="muted">
            {person.role} · מקור: {data.source} · יום עבודה {workday.start}–{workday.end} ({h(workday.hours)}), ראשון–חמישי
          </div>
        </div>
      </header>

      <div className="orgfilter">
        <button type="button" onClick={() => setWeek(data.week.previous)}>→ שבוע קודם</button>
        <strong>
          {date(data.week.from, { day: 'numeric', month: 'numeric' })} – {date(data.week.to, { day: 'numeric', month: 'numeric', year: 'numeric' })}
        </strong>
        <button type="button" onClick={() => setWeek(data.week.next)}>שבוע הבא ←</button>
        {week && <button type="button" onClick={() => setWeek('')}>השבוע</button>}
      </div>

      <div className="stats">
        <Stat value={h(data.weekFree)} label="שעות פנויות בשבוע" />
        <Stat value={h(data.weekBusy)} label="שעות בפגישות" />
        <Stat value={h(cap.freeHours)} label={`פנוי עד סוף ${cap.sprint}`} />
        <Stat value={h(needed)} label={`נדרש ל-${cap.openPoints} נק׳ פתוחות`} />
      </div>

      <div className="card calwrap">
        <div className="calendar">
          <div className="calaxis">
            <div className="calhead" />
            <div className="calbody" style={{ height }}>
              {hourMarks.map((m) => (
                <span key={m} style={{ top: (m - start) * PX_PER_MIN }}>{`${m / 60}:00`}</span>
              ))}
            </div>
          </div>
          {days.map((d) => (
            <div key={d.date} className={`calday ${d.date === data.today ? 'today' : ''}`}>
              <div className="calhead">
                <b>{date(d.date, { weekday: 'long' })}</b>
                <small>{date(d.date, { day: 'numeric', month: 'numeric' })}</small>
                <span className="freebadge">פנוי {h(d.freeHours)}</span>
              </div>
              <div className="calbody" style={{ height }}>
                {hourMarks.map((m) => (
                  <i key={m} style={{ top: (m - start) * PX_PER_MIN }} />
                ))}
                {layout(d.events).map((e) => (
                  <div
                    key={e.id}
                    className={`calevent ${e.type}`}
                    title={`${e.start}–${e.end} · ${e.title}${e.with.length ? ` · עם ${e.with.join(', ')}` : ''}`}
                    style={{
                      top: (Math.max(toMin(e.start), start) - start) * PX_PER_MIN,
                      height: Math.max(16, (Math.min(toMin(e.end), toMin(workday.end)) - Math.max(toMin(e.start), start)) * PX_PER_MIN - 2),
                      right: `${(e.lane / e.lanes) * 100}%`,
                      width: `calc(${100 / e.lanes}% - 3px)`,
                    }}
                  >
                    <b>{e.start}</b> {linkTasks(e.title)}
                  </div>
                ))}
              </div>
              <div className="freeslots">
                {d.freeSlots.map((s) => (
                  <small key={s.start}>{s.start}–{s.end}</small>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="progresshead">
          <h2>⚖️ תכולה מול זמן פנוי (עד {date(cap.until, { day: 'numeric', month: 'numeric' })}, {cap.workdays} ימי עבודה)</h2>
          <label className="hpp">
            שעות עבודה לנקודה:
            <input type="number" min="0.5" max="40" step="0.5" value={hpp} onChange={(e) => changeHpp(e.target.value)} />
          </label>
        </div>
        <p>
          <span className={`health ${loadClass(ratio)}`}>{loadText(ratio)}</span>{' '}
          נדרשות {h(needed)} מתוך {h(cap.freeHours)} פנויות
          {Number.isFinite(ratio) && ` (${Math.round(ratio * 100)}% ניצול)`}
          {ratio > 1 ? ` · חסרות ${h(needed - cap.freeHours)}` : ` · נשארות ${h(cap.freeHours - needed)}`}
        </p>
        <div className="loadbar">
          <span className={loadClass(ratio)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
        {cap.tasks.length === 0 ? (
          <p className="muted">אין משימות פתוחות בספרינט.</p>
        ) : (
          <table>
            <thead>
              <tr><th>משימה</th><th>כותרת</th><th>סטטוס</th><th>יעד</th><th>הערכה</th><th>מצטבר / פנוי עד היעד</th><th></th></tr>
            </thead>
            <tbody>
              {cap.tasks.map((t) => {
                cumulative += t.points * hpp;
                const fits = !t.overdue && cumulative <= t.freeUntilDue;
                return (
                  <tr key={t.key}>
                    <td><TaskLink id={t.key} /></td>
                    <td>{t.title}</td>
                    <td><span className={`status ${t.status.replace(' ', '')}`}>{STATUS_HE[t.status]}</span></td>
                    <td>{t.due ? date(t.due, { day: 'numeric', month: 'numeric' }) : 'סוף ספרינט'}</td>
                    <td>{h(t.points * hpp)}</td>
                    <td>{h(cumulative)} / {h(t.freeUntilDue)}</td>
                    <td>
                      <span className={`health ${fits ? 'on_track' : 'at_risk'}`}>{t.overdue ? 'באיחור' : fits ? 'נכנס' : 'לא נכנס'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="muted small">
          ההערכה היא לפי נקודות הסיפור כפול השעות לנקודה, בלי להפחית עבודה שכבר נעשתה. המשימות מסודרות לפי יעד.
        </p>
      </div>

      {data.team.length > 0 && (
        <div className="card">
          <h2>👥 קיבולת הצוות</h2>
          <table>
            <thead>
              <tr><th>שם</th><th>פנוי בשבוע המוצג</th><th>פנוי עד סוף הספרינט</th><th>נדרש</th><th></th></tr>
            </thead>
            <tbody>
              {data.team.map((m) => {
                const r = m.sprintFree ? (m.openPoints * hpp) / m.sprintFree : 0;
                return (
                  <tr key={m.id}>
                    <td><a href={`#/schedule/${m.id}`}>{m.fullName}</a></td>
                    <td>{h(m.weekFree)}</td>
                    <td>{h(m.sprintFree)}</td>
                    <td>{h(m.openPoints * hpp)}</td>
                    <td><span className={`health ${loadClass(r)}`}>{loadText(r)} · {Math.round(r * 100)}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const Stat = ({ value, label }) => (
  <div className="stat">
    <b>{value}</b>
    <span>{label}</span>
  </div>
);

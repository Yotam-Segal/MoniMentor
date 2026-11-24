import { useEffect, useState } from 'react';
import Avatar from '../Avatar.jsx';

const STATUS_HE = { Done: 'הושלם', 'In Progress': 'בעבודה', 'In Review': 'בסקירה', Blocked: 'חסום', 'To Do': 'לביצוע' };
const TYPE_ICON = { oneonone: '👥', review: '🔍', meeting: '📅' };
const SEV_LABEL = { high: 'דחוף', medium: 'שים לב', low: 'לידיעה' };

const dayLabel = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });

function groupByDay(events) {
  const map = new Map();
  for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
  return [...map.entries()];
}

export default function PersonPage({ id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/person/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || `שגיאה ${r.status}`);
        return data;
      })
      .then(setP)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <section className="wide"><p className="err">⚠️ {error}</p></section>;
  if (!p) return <section className="wide"><p className="muted">טוען…</p></section>;

  const title = p.isMe ? 'העבודה שלי' : p.fullName;

  return (
    <section className="wide person">
      {!p.isMe && (
        <a className="back" href="#/org">
          ← חזרה למבנה הארגוני
        </a>
      )}

      <header className="profile">
        <Avatar person={p} size={88} />
        <div>
          <h1 className="pagetitle">{title}</h1>
          <div className="muted">
            {p.fullName} · {p.role} · {p.city}
          </div>
          {p.manager && (
            <div className="muted">
              כפוף ל: <a href={`#/person/${p.manager.id}`}>{p.manager.fullName}</a>
            </div>
          )}
          <div className="muted small">{p.training}</div>
        </div>
      </header>

      <div className="stats">
        <Stat label="משימות פתוחות" value={p.stats.openTickets} />
        <Stat label="נקודות פתוחות" value={p.stats.openPoints} />
        <Stat label="נסגרו השבוע" value={p.stats.closedThisWeek} />
        <Stat label="קומיטים השבוע" value={p.stats.commitsThisWeek} />
        {p.reports.length > 0 && <Stat label="אנשים בארגון" value={p.orgSize} />}
      </div>

      <div className="grid2">
        <Card title="🔔 דורש קשב עכשיו">
          {p.attention.length === 0 && <p className="muted">אין פריטים דחופים 🎉</p>}
          <ul className="plain">
            {p.attention.map((a, i) => (
              <li key={i} className={`att ${a.severity}`}>
                <span className="badge">{SEV_LABEL[a.severity]}</span>
                {a.personId !== p.id ? <a href={`#/person/${a.personId}`}>{a.text}</a> : a.text}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="🗓️ בלו&quot;ז קרוב">
          {p.events.length === 0 && <p className="muted">אין אירועים קרובים.</p>}
          {groupByDay(p.events).map(([date, evs]) => (
            <div key={date} className="day">
              <div className="dayhead">{dayLabel(date)}</div>
              {evs.map((e) => (
                <div key={e.id} className="event">
                  <span className="time">
                    {e.start}–{e.end}
                  </span>
                  <span>
                    {TYPE_ICON[e.type]} {e.title}
                    {e.with.length > 0 && <small className="muted"> · עם {e.with.join(', ')}</small>}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </Card>
      </div>

      <Card title="✅ משימות פתוחות">
        {p.openTickets.length === 0 && <p className="muted">אין משימות פתוחות.</p>}
        {p.openTickets.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>מפתח</th>
                <th>כותרת</th>
                <th>סטטוס</th>
                <th>נק׳</th>
                <th>יעד</th>
              </tr>
            </thead>
            <tbody>
              {p.openTickets.map((t) => (
                <tr key={t.key}>
                  <td>{t.key}</td>
                  <td>{t.title}</td>
                  <td>
                    <span className={`status ${t.status.replace(' ', '')}`}>{STATUS_HE[t.status]}</span>
                  </td>
                  <td>{t.points}</td>
                  <td>{t.due ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {p.reports.length > 0 && (
        <Card title="👥 הצוות">
          <div className="reports">
            {p.reports.map((r) => (
              <a key={r.id} className="orgnode" href={`#/person/${r.id}`}>
                <Avatar person={r} size={52} />
                <strong>{r.fullName}</strong>
                <small>{r.role}</small>
              </a>
            ))}
          </div>
        </Card>
      )}

      {p.recentCommits.length > 0 && (
        <Card title="💻 פעילות אחרונה ב-Git">
          <ul className="plain">
            {p.recentCommits.map((c) => (
              <li key={c.hash} className="commit">
                <code>{c.hash}</code> {c.message}
                <small className="muted">
                  {' '}
                  · {c.date} · +{c.additions}/-{c.deletions}
                </small>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

const Stat = ({ label, value }) => (
  <div className="stat">
    <b>{value}</b>
    <span>{label}</span>
  </div>
);

const Card = ({ title, children }) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
);

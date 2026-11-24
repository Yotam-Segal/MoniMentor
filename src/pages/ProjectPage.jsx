import { useEffect, useState } from 'react';
import { Burnup, PeopleBars, StatusBar, STATUS_HE } from '../charts.jsx';

export const HEALTH_LABEL = { on_track: 'בקצב', watch: 'שים לב', at_risk: 'בסיכון' };

export function ProgressBar({ value, expected }) {
  return (
    <div className="progress" title={`התקדמות ${value}% (צפוי ${expected}%)`}>
      <span style={{ width: `${value}%` }} />
      {expected != null && <i style={{ right: `${expected}%` }} />}
    </div>
  );
}

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

export default function ProjectPage({ id }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/project/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `שגיאה ${r.status}`);
        return d;
      })
      .then(setP)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <section className="wide"><p className="err">⚠️ {error}</p></section>;
  if (!p) return <section className="wide"><p className="muted">טוען…</p></section>;

  return (
    <section className="wide person">
      <a className="back" href="#/org" onClick={(e) => { e.preventDefault(); window.history.back(); }}>
        ← חזרה
      </a>

      <header className="projhead">
        <div>
          <h1 className="pagetitle">{p.name}</h1>
          <p className="muted">{p.description}</p>
          <div className="muted small">
            אחראי: <a href={`#/person/${p.owner.id}`}>{p.owner.fullName}</a> · שלב: {p.phase} · {fmtDate(p.start)} ← {fmtDate(p.target)}
          </div>
        </div>
        <span className={`health ${p.health}`}>{HEALTH_LABEL[p.health]}</span>
      </header>
      <p className={`healthtext ${p.health}`}>{p.healthText}</p>

      <div className="card">
        <div className="progresshead">
          <b>{p.progress}% הושלם</b>
          <span className="muted">
            {p.donePoints}/{p.totalPoints} נקודות · נותרו {p.daysLeft} ימים · צפוי כעת {p.expectedProgress}%
          </span>
        </div>
        <ProgressBar value={p.progress} expected={p.expectedProgress} />
      </div>

      <div className="grid2">
        <Card title="📈 התקדמות לאורך זמן (Burn-up)">
          <Burnup data={p.burnup} start={p.start} target={p.target} today={p.today} />
          <ul className="legend">
            <li><i style={{ background: '#ffd98a' }} />היקף הפרויקט</li>
            <li><i style={{ background: '#4cc9a0' }} />הושלם</li>
            <li><i style={{ background: 'var(--muted)' }} />קו מגמה רצוי</li>
          </ul>
        </Card>
        <Card title="📊 התפלגות לפי סטטוס">
          <StatusBar byStatus={p.byStatus} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="👥 האנשים בפרויקט">
          <PeopleBars people={p.people} />
        </Card>
        <Card title="⚠️ סיכונים וחסמים">
          {p.risks.length === 0 && <p className="muted">אין חסמים 🎉</p>}
          <ul className="plain">
            {p.risks.map((r) => (
              <li key={r.key} className="att high">
                <span className="badge">דחוף</span>
                <span>
                  {r.key} · <a href={`#/person/${r.assigneeId}`}>{r.assignee}</a>: {r.text}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="🎫 משימות הפרויקט ב-Jira">
        <table>
          <thead>
            <tr><th>מפתח</th><th>כותרת</th><th>אחראי</th><th>סטטוס</th><th>נק׳</th><th>ספרינט</th></tr>
          </thead>
          <tbody>
            {p.tickets.map((t) => (
              <tr key={t.key}>
                <td>{t.key}</td>
                <td>{t.title}</td>
                <td><a href={`#/person/${t.assignee}`}>{t.assigneeName}</a></td>
                <td><span className={`status ${t.status.replace(' ', '')}`}>{STATUS_HE[t.status]}</span></td>
                <td>{t.points}</td>
                <td>{t.sprint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {p.commits.length > 0 && (
        <Card title="💻 פעילות אחרונה ב-Git">
          <ul className="plain">
            {p.commits.map((c) => (
              <li key={c.hash} className="commit">
                <code>{c.hash}</code> {c.message}
                <small className="muted"> · {c.authorName} · {c.date} · {c.ticket}</small>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

const Card = ({ title, children }) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
);

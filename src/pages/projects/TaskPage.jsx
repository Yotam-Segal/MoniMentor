import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import { STATUS_HE } from '../../charts/charts.jsx';
import { TaskLink } from '../../components/TaskLink.jsx';

const TYPE_HE = { Story: 'סיפור משתמש', Task: 'משימה', Bug: 'באג' };
const fmt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const statusClass = (s) => `status ${s.replace(' ', '')}`;

export default function TaskPage({ id }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/task/${id}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `שגיאה ${r.status}`);
        return d;
      })
      .then(setT)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <section className="wide"><p className="err">⚠️ {error}</p></section>;
  if (!t) return <section className="wide"><p className="muted">טוען…</p></section>;

  return (
    <section className="wide person">
      <a className="back" href="#/" onClick={(e) => { e.preventDefault(); window.history.back(); }}>
        ← חזרה
      </a>

      <header className="projhead">
        <div>
          <div className="muted">{t.key} · {TYPE_HE[t.type] ?? t.type}</div>
          <h1 className="pagetitle">{t.title}</h1>
        </div>
        <span className={statusClass(t.status)}>{STATUS_HE[t.status]}</span>
      </header>

      {t.status === 'Blocked' && <p className="healthtext at_risk">⛔ {t.note ?? 'המשימה חסומה'}</p>}
      {t.overdue && <p className="healthtext at_risk">⏰ המשימה באיחור (יעד {fmt(t.due)})</p>}

      <div className="grid2">
        <Card title="📄 תיאור">
          <p>{t.description ?? 'אין תיאור למשימה.'}</p>
          {t.note && t.status !== 'Blocked' && <p className="muted">הערה: {t.note}</p>}
        </Card>
        <Card title="ℹ️ פרטים">
          <dl className="details">
            <dt>אחראי</dt>
            <dd>
              <a className="who" href={`#/person/${t.assignee.id}`}>
                <Avatar person={t.assignee} size={28} /> {t.assignee.fullName}
              </a>
            </dd>
            <dt>פרויקט</dt>
            <dd>{t.project ? <a href={`#/project/${t.project.id}`}>{t.project.name}</a> : 'ללא פרויקט'}</dd>
            <dt>ספרינט</dt>
            <dd>{t.sprint.name}{t.sprint.start && <small className="muted"> ({fmt(t.sprint.start)} – {fmt(t.sprint.end)})</small>}</dd>
            <dt>נקודות</dt>
            <dd>{t.points}</dd>
            <dt>נוצרה</dt>
            <dd>{fmt(t.created)}</dd>
            <dt>יעד</dt>
            <dd>{fmt(t.due)}</dd>
            <dt>נסגרה</dt>
            <dd>{fmt(t.resolved)}</dd>
          </dl>
        </Card>
      </div>

      <div className="grid2">
        <Card title="🕒 ציר זמן">
          <ul className="plain timeline">
            {t.history.map((h, i) => (
              <li key={i}>
                <small className="muted">{fmt(h.date)}</small>
                <div>{h.text}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="💻 קוד (Git)">
          {t.commits.length === 0 ? (
            <p className="muted">אין עדיין קומיטים למשימה.</p>
          ) : (
            <>
              <p className="muted">
                {t.commits.length} קומיטים · {t.changes.files} קבצים · +{t.changes.additions}/-{t.changes.deletions}
              </p>
              <ul className="plain">
                {t.commits.map((c) => (
                  <li key={c.hash} className="commit">
                    <code>{c.hash}</code> {c.message}
                    <small className="muted"> · {c.authorName} · +{c.additions}/-{c.deletions}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {t.meetings.length > 0 && (
        <Card title="🗓️ פגישות על המשימה">
          <ul className="plain">
            {t.meetings.map((m) => (
              <li key={m.id}>
                {fmt(m.date)} {m.start} · {m.title} <small className="muted">· {m.people.join(', ')}</small>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {t.related.length > 0 && (
        <Card title="🔗 משימות נוספות בפרויקט">
          <table>
            <tbody>
              {t.related.map((r) => (
                <tr key={r.key}>
                  <td><TaskLink id={r.key} /></td>
                  <td>{r.title}</td>
                  <td>{r.assigneeName}</td>
                  <td><span className={statusClass(r.status)}>{STATUS_HE[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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

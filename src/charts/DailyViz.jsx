import { useState } from 'react';
import { STATUS_COLOR, STATUS_HE } from './charts.jsx';

const ORDER = ['Blocked', 'In Review', 'In Progress', 'To Do'];
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

// Clickable chart elements all feed one filter that narrows the task list below.
export default function DailyViz({ stats }) {
  const [filter, setFilter] = useState(null); // { id, label, test }
  const [openKey, setOpenKey] = useState(null);
  const tasks = stats.prioritized;
  const shown = filter ? tasks.filter(filter.test) : tasks;
  const maxScore = Math.max(1, ...tasks.map((t) => t.score));

  const toggle = (id, label, test) => setFilter((f) => (f?.id === id ? null : { id, label, test }));
  const active = (id) => (filter?.id === id ? 'active' : '');

  const kpis = [
    { id: 'all', value: tasks.length, label: 'משימות פתוחות בספרינט', test: null },
    { id: 'blocked', value: tasks.filter((t) => t.status === 'Blocked').length, label: 'חסומות', test: (t) => t.status === 'Blocked', tone: 'bad' },
    { id: 'overdue', value: tasks.filter((t) => t.overdue).length, label: 'באיחור', test: (t) => t.overdue, tone: 'bad' },
    { id: 'review', value: tasks.filter((t) => t.status === 'In Review').length, label: 'ממתינות לסקירה', test: (t) => t.status === 'In Review' },
  ];

  const byStatus = ORDER.map((s) => ({ status: s, count: tasks.filter((t) => t.status === s).length })).filter((x) => x.count);

  const people = [...new Map(tasks.map((t) => [t.assigneeId, t.assignee])).entries()]
    .map(([id, name]) => {
      const mine = tasks.filter((t) => t.assigneeId === id);
      return { id, name, total: sum(mine, (t) => t.points), parts: ORDER.map((s) => ({ s, pts: sum(mine.filter((t) => t.status === s), (t) => t.points) })) };
    })
    .sort((a, b) => b.total - a.total);
  const maxLoad = Math.max(1, ...people.map((p) => p.total));
  const maxPace = Math.max(0.1, ...stats.projects.flatMap((p) => [p.requiredPerWorkday, p.recentPerWorkday]));

  return (
    <div className="viz">
      <div className="stats">
        {kpis.map((k) => (
          <button
            key={k.id}
            className={`stat kpi ${active(k.id)} ${k.tone && k.value ? k.tone : ''}`}
            onClick={() => (k.test ? toggle(k.id, k.label, k.test) : setFilter(null))}
          >
            <b>{k.value}</b>
            <span>{k.label}</span>
          </button>
        ))}
        <div className="stat">
          <b>{stats.sprint.workdaysLeft}</b>
          <span>ימי עבודה לסוף {stats.sprint.name}</span>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>סטטוס המשימות</h2>
          <div className="donutwrap">
            <Donut data={byStatus} total={tasks.length} activeId={filter?.id} onPick={(s) => toggle(`s:${s}`, STATUS_HE[s], (t) => t.status === s)} />
            <ul className="donutlegend">
              {byStatus.map((x) => (
                <li key={x.status}>
                  <button className={active(`s:${x.status}`)} onClick={() => toggle(`s:${x.status}`, STATUS_HE[x.status], (t) => t.status === x.status)}>
                    <i style={{ background: STATUS_COLOR[x.status] }} />
                    {STATUS_HE[x.status]} · {x.count}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card">
          <h2>עומס לפי אדם (נקודות פתוחות)</h2>
          <div className="pbars">
            {people.map((p) => (
              <button key={p.id} className={`prow vizrow ${active(`p:${p.id}`)}`} onClick={() => toggle(`p:${p.id}`, p.name, (t) => t.assigneeId === p.id)}>
                <span className="pname">{p.name}</span>
                <span className="ptrack">
                  {p.parts.map((x) => (
                    <span key={x.s} title={`${STATUS_HE[x.s]}: ${x.pts} נק׳`} style={{ width: `${(x.pts / maxLoad) * 100}%`, background: STATUS_COLOR[x.s] }} />
                  ))}
                </span>
                <span className="pnum">{p.total}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>קצב מול יעדי הפרויקטים (נקודות ליום עבודה)</h2>
        <div className="pace">
          {stats.projects.map((p) => (
            <button key={p.id} className={`pacerow ${active(`j:${p.id}`)}`} onClick={() => toggle(`j:${p.id}`, p.name, (t) => t.projectId === p.id)}>
              <span className="pacename">
                <strong>{p.name}</strong>
                <small>
                  נותרו {p.remainingPoints} נק׳ · {p.workdaysLeft} ימי עבודה
                </small>
              </span>
              <span className="pacebars">
                <PaceBar label="נדרש" value={p.requiredPerWorkday} max={maxPace} color="#ffd98a" />
                <PaceBar label="בפועל" value={p.recentPerWorkday} max={maxPace} color={p.onPace ? '#4cc9a0' : '#ff6b81'} />
              </span>
              <span className={`health ${p.onPace ? 'on_track' : 'at_risk'}`}>{p.onPace ? 'בקצב' : 'מפגר'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="tasklisthead">
          <h2>משימות לפי עדיפות ({shown.length})</h2>
          {filter && (
            <button className="chipclear" onClick={() => setFilter(null)}>
              {filter.label} ✕
            </button>
          )}
        </div>
        <p className="muted small">לחיצה על גרף מסננת את הרשימה. לחיצה על משימה מציגה למה היא בעדיפות.</p>
        {shown.length === 0 && <p className="muted">אין משימות פתוחות בספרינט עבור הסינון הזה.</p>}
        <ul className="plain">
          {shown.map((t) => (
            <li key={t.key}>
              <button className="taskrow" onClick={() => setOpenKey((k) => (k === t.key ? null : t.key))} aria-expanded={openKey === t.key}>
                <span className="status" style={{ background: STATUS_COLOR[t.status], color: '#0b1020' }}>{STATUS_HE[t.status]}</span>
                <span className="tasktitle">
                  <b>{t.key}</b> {t.title}
                  <small className="muted"> · {t.assignee} · {t.points} נק׳</small>
                </span>
                <span className="score" title={`ציון עדיפות ${t.score}`}>
                  <span style={{ width: `${(t.score / maxScore) * 100}%` }} />
                </span>
              </button>
              {openKey === t.key && (
                <div className="taskmore">
                  {t.reasons.length ? <ul>{t.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="muted">אין סיבה מיוחדת – משימה רגילה בספרינט.</p>}
                  <a href={`#/task/${t.key}`}>לדף המשימה</a>
                  <a href={`#/person/${t.assigneeId}`}>לדף של {t.assignee}</a>
                  {t.projectId && <a href={`#/project/${t.projectId}`}>לפרויקט {t.project}</a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PaceBar({ label, value, max, color }) {
  return (
    <span className="pacebar">
      <small>{label}</small>
      <span className="track">
        <span style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <small className="num">{value.toFixed(1)}</small>
    </span>
  );
}

function Donut({ data, total, activeId, onPick }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="התפלגות משימות לפי סטטוס">
      {data.map((x) => {
        const len = (x.count / (total || 1)) * C;
        const seg = (
          <circle
            key={x.status}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={STATUS_COLOR[x.status]}
            strokeWidth={activeId === `s:${x.status}` ? 26 : 18}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
            onClick={() => onPick(x.status)}
          >
            <title>{`${STATUS_HE[x.status]}: ${x.count}`}</title>
          </circle>
        );
        offset += len;
        return seg;
      })}
      <text x="70" y="70" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--text)">{total}</text>
      <text x="70" y="90" textAnchor="middle" fontSize="11" fill="var(--muted)">משימות</text>
    </svg>
  );
}

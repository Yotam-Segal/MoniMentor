// Small dependency-free SVG/CSS charts.
export const STATUS_HE = { Done: 'הושלם', 'In Review': 'בסקירה', 'In Progress': 'בעבודה', Blocked: 'חסום', 'To Do': 'לביצוע' };
export const STATUS_COLOR = {
  Done: '#4cc9a0',
  'In Review': '#a78bfa',
  'In Progress': '#5b8cff',
  Blocked: '#ff6b81',
  'To Do': '#5b6890',
};

export function StatusBar({ byStatus }) {
  const total = byStatus.reduce((s, x) => s + x.points, 0) || 1;
  return (
    <div>
      <div className="stackbar" role="img" aria-label="התפלגות נקודות לפי סטטוס">
        {byStatus
          .filter((x) => x.points > 0)
          .map((x) => (
            <span
              key={x.status}
              style={{ width: `${(x.points / total) * 100}%`, background: STATUS_COLOR[x.status] }}
              title={`${STATUS_HE[x.status]}: ${x.points} נק׳`}
            />
          ))}
      </div>
      <ul className="legend">
        {byStatus.map((x) => (
          <li key={x.status}>
            <i style={{ background: STATUS_COLOR[x.status] }} />
            {STATUS_HE[x.status]} · {x.tickets} כרטיסים · {x.points} נק׳
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PeopleBars({ people }) {
  const max = Math.max(1, ...people.map((p) => p.donePoints + p.openPoints));
  return (
    <div className="pbars">
      {people.map((p) => (
        <a key={p.id} className="prow" href={`#/person/${p.id}`}>
          <span className="pname">{p.fullName}</span>
          <span className="ptrack">
            <span style={{ width: `${(p.donePoints / max) * 100}%`, background: STATUS_COLOR.Done }} />
            <span style={{ width: `${(p.openPoints / max) * 100}%`, background: STATUS_COLOR['In Progress'] }} />
          </span>
          <span className="pnum">
            {p.donePoints}/{p.donePoints + p.openPoints}
          </span>
        </a>
      ))}
      <ul className="legend">
        <li><i style={{ background: STATUS_COLOR.Done }} />נסגר</li>
        <li><i style={{ background: STATUS_COLOR['In Progress'] }} />פתוח</li>
      </ul>
    </div>
  );
}

const ms = (d) => new Date(`${d}T12:00:00`).getTime();
const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

export function Burnup({ data, start, target, today }) {
  const W = 640, H = 250, L = 40, R = 14, T = 14, B = 30;
  const end = Math.max(ms(target), ms(today));
  const x0 = ms(start);
  const finalScope = data.length ? data[data.length - 1].scope : 0;
  const yMax = Math.max(5, Math.ceil((finalScope * 1.1) / 5) * 5);
  const X = (t) => L + ((t - x0) / (end - x0)) * (W - L - R);
  const Y = (v) => H - B - (v / yMax) * (H - T - B);
  const line = (key) => data.map((p, i) => `${i ? 'L' : 'M'}${X(ms(p.date)).toFixed(1)},${Y(p[key]).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f));
  const dates = [start, today, target];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="burnup" direction="ltr" role="img" aria-label="גרף Burn-up של הפרויקט">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}</text>
        </g>
      ))}
      {/* ideal: from 0 at start to the current scope at the target date */}
      <line x1={X(x0)} y1={Y(0)} x2={X(ms(target))} y2={Y(finalScope)} stroke="var(--muted)" strokeDasharray="5 5" strokeWidth="1.5" />
      <path d={line('scope')} fill="none" stroke="#ffd98a" strokeWidth="2" />
      <path d={line('done')} fill="none" stroke={STATUS_COLOR.Done} strokeWidth="2.5" />
      <line x1={X(ms(today))} x2={X(ms(today))} y1={T} y2={H - B} stroke="var(--accent)" strokeDasharray="3 4" />
      <text x={X(ms(today))} y={T - 2} textAnchor="middle" fontSize="11" fill="var(--accent)">היום</text>
      {dates.map((d, i) => (
        <text key={d + i} x={X(ms(d))} y={H - 10} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">
          {fmt(d)}
        </text>
      ))}
    </svg>
  );
}

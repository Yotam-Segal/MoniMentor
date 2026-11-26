import { useEffect, useRef, useState } from 'react';
import Markdown from '../../components/Markdown.jsx';
import Loader from '../../components/Loader.jsx';
import { TaskLink, linkTasks } from '../../components/TaskLink.jsx';

const STEPS = [
  'קורא את יומני השבוע הקרוב…',
  'אוסף משימות ותאריכי יעד…',
  'מחשב זמן פנוי מול תכולה…',
  'בודק את יעדי הפרויקטים…',
  'מנסח את התוכנית השבועית…',
];
const date = (d, opts = { day: 'numeric', month: 'numeric' }) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', opts);
const loadClass = (load) => (load > 100 ? 'at_risk' : load > 80 ? 'watch' : 'on_track');

const getJson = async (url, options) => {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
  return data;
};

export default function WeeklyPage() {
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [stats, setStats] = useState(null);
  const [doc, setDoc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const request = useRef(0); // only the newest document request may write to the screen

  useEffect(() => {
    getJson('/api/daily/teams')
      .then((t) => {
        setTeams(t);
        if (t.length) setTeamId(t[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function generate(id) {
    const mine = ++request.current;
    setBusy(true);
    setDoc('');
    setError('');
    try {
      const data = await getJson('/api/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: id }),
      });
      if (mine === request.current) setDoc(data.markdown);
    } catch (e) {
      if (mine === request.current) setError(e.message);
    } finally {
      if (mine === request.current) setBusy(false);
    }
  }

  // The numbers show at once; the written plan follows.
  useEffect(() => {
    if (!teamId) return;
    let stale = false;
    setStats(null);
    getJson(`/api/weekly/${teamId}/stats`)
      .then((s) => !stale && setStats(s))
      .catch((e) => !stale && setError(e.message));
    generate(teamId);
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="wide daily">
      <a className="back" href="#/agent">← חזרה לסוכן</a>
      <h1 className="pagetitle">🗓️ תכנון שבועי</h1>
      <p className="muted">
        מבט קדימה על שבוע העבודה הקרוב: מה מתוכנן, כמה זמן פנוי יש ומה צריך לסגור.
        {stats && ` שבוע ${date(stats.week.from)} – ${date(stats.week.to)}.`}
      </p>

      <div className="orgfilter">
        <label htmlFor="wteam">צוות:</label>
        <select id="wteam" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.size})
            </option>
          ))}
        </select>
        <button type="button" onClick={() => generate(teamId)} disabled={busy || !teamId}>↻ הפק מחדש</button>
        {doc && (
          <>
            <button type="button" onClick={copy}>{copied ? '✓ הועתק' : 'העתק'}</button>
            <button type="button" onClick={() => window.print()}>הדפס</button>
          </>
        )}
      </div>

      {stats && (
        <div className="viz">
          <div className="weekgrid">
            {stats.days.map((d) => (
              <div key={d.date} className="card weekday">
                <h2>{date(d.date, { weekday: 'long', day: 'numeric', month: 'numeric' })}</h2>
                <div className="muted small">{d.freeHours} ש׳ פנויות בצוות · {d.meetings.length} פגישות</div>
                {d.due.map((t) => (
                  <div key={t.key} className="duechip">
                    יעד: <TaskLink id={t.key} /> <small>{t.assignee}</small>
                  </div>
                ))}
                <ul className="plain">
                  {d.meetings.map((m) => (
                    <li key={m.start + m.title} title={m.attendees.join(', ')}>
                      <small className="muted">{m.start}</small> {linkTasks(m.title)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>⚖️ זמן פנוי מול תכולה</h2>
            <table>
              <thead>
                <tr><th>שם</th><th>פנוי בשבוע</th><th>נדרש לפתוח בספרינט</th><th>עומס</th></tr>
              </thead>
              <tbody>
                {stats.people.map((p) => (
                  <tr key={p.id}>
                    <td><a href={`#/schedule/${p.id}`}>{p.name}</a></td>
                    <td>{p.freeHours} ש׳</td>
                    <td>{p.neededHours} ש׳</td>
                    <td><span className={`health ${loadClass(p.load)}`}>{p.load}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">
              לפי {stats.assumptions.hoursPerPoint} שעות לנקודה, בלי להפחית עבודה שכבר נעשתה. {stats.sprint.name} מסתיים ב-{date(stats.sprint.end)}.
            </p>
          </div>

          {stats.carriedOver.length > 0 && (
            <div className="card">
              <h2>⚠️ נגרר לשבוע הבא (חסום או שעבר היעד)</h2>
              <ul className="plain">
                {stats.carriedOver.map((t) => (
                  <li key={t.key}>
                    <TaskLink id={t.key} /> {t.title} <small className="muted">· {t.assignee}{t.note ? ` · ${t.note}` : ''}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <h2 className="docheading">📝 התוכנית לשבוע</h2>
      {busy && <Loader steps={STEPS} />}
      {error && <p className="err">⚠️ {error}</p>}
      {doc && (
        <article className="card dailydoc">
          <Markdown text={doc} />
        </article>
      )}
    </section>
  );
}

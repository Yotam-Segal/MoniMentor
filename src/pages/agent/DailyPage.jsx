import { useEffect, useState } from 'react';
import Markdown from '../../components/Markdown.jsx';
import DailyViz from '../../charts/DailyViz.jsx';
import Loader from '../../components/Loader.jsx';

const STEPS = [
  'אוסף משימות מ-Jira…',
  'בודק קומיטים ופגישות להיום…',
  'מחשב קצב מול יעדי הפרויקטים…',
  'מתעדף משימות…',
  'מנסח את מסמך הדיילי…',
];

export default function DailyPage() {
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/daily/teams')
      .then((r) => r.json())
      .then((t) => {
        setTeams(t);
        if (t.length) setTeamId(t[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function generate(id = teamId) {
    if (!id || busy) return;
    setBusy(true);
    setError('');
    setDoc(null);
    try {
      const res = await fetch('/api/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
      setDoc(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // The numbers need no LLM, so the charts load on their own and don't wait for the document.
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!teamId) return;
    let stale = false;
    setStats(null);
    fetch(`/api/daily/${teamId}/stats`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`שגיאה ${r.status}`);
        return r.json();
      })
      .then((s) => !stale && setStats(s))
      .catch((e) => !stale && setError(e.message));
    return () => {
      stale = true;
    };
  }, [teamId]);

  // Generate straight away when the page opens / the team changes: the daily is an every-morning habit.
  useEffect(() => {
    if (teamId) generate(teamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(doc.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <section className="wide daily">
      <a className="back" href="#/agent">← חזרה לסוכן</a>
      <h1 className="pagetitle">📋 מסמך דיילי</h1>
      <p className="muted">סיכום בוקר לפגישת הדיילי: מה בתעדוף עכשיו ומה צריך לקדם כדי לעמוד ביעדי הפרויקטים.</p>

      <div className="orgfilter">
        <label htmlFor="dteam">צוות:</label>
        <select id="dteam" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={busy}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.size})
            </option>
          ))}
        </select>
        <button type="button" onClick={() => generate()} disabled={busy || !teamId}>
          ↻ הפק מחדש
        </button>
        {doc && (
          <>
            <button type="button" onClick={copy}>{copied ? '✓ הועתק' : 'העתק'}</button>
            <button type="button" onClick={() => window.print()}>הדפס</button>
          </>
        )}
      </div>

      {stats && <DailyViz key={teamId} stats={stats} />}

      <h2 className="docheading">📝 מסמך הדיילי</h2>
      {busy && <Loader steps={STEPS} />}
      {error && <p className="err">⚠️ {error}</p>}
      {doc && (
        <article className="card dailydoc">
          <div className="muted small">
            {doc.stats.team} · נתונים נכון ל-{doc.stats.date} · {doc.stats.sprint.name} (נותרו {doc.stats.sprint.workdaysLeft} ימי עבודה)
          </div>
          <Markdown text={doc.markdown} />
        </article>
      )}
    </section>
  );
}

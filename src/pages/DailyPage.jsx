import { useEffect, useState } from 'react';
import Markdown from '../Markdown.jsx';

const STEPS = [
  'אוסף משימות מ-Jira…',
  'בודק קומיטים ופגישות להיום…',
  'מחשב קצב מול יעדי הפרויקטים…',
  'מתעדף משימות…',
  'מנסח את מסמך הדיילי…',
];

// Spinner with a rotating status line, so the wait (LLM call) doesn't look frozen.
function Loader() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="spinner" />
      <span>{STEPS[i]}</span>
    </div>
  );
}

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

      {busy && <Loader />}
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

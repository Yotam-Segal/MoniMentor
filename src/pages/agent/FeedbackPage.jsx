import { useEffect, useState } from 'react';
import Markdown from '../../components/Markdown.jsx';
import { REASONS } from '../../chat/Rating.jsx';

const when = (iso) => new Date(iso).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

// Quote every cell and neutralise leading = + - @ so Excel never treats chat text as a formula.
const cell = (v) => {
  const s = String(v ?? '');
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

function exportCsv(items) {
  const rows = [['תאריך', 'דירוג', 'סיבה', 'שאלה', 'תשובה'], ...items.map((f) => [f.at, f.rating === 'up' ? 'לייק' : 'דיסלייק', f.reason, f.question, f.answer])];
  const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'monimentor-feedback.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function FeedbackPage() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => {
        if (!r.ok) throw new Error(`שגיאה ${r.status}`);
        return r.json();
      })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <section className="wide"><p className="err">⚠️ {error}</p></section>;
  if (!items) return <section className="wide"><p className="muted">טוען…</p></section>;

  const up = items.filter((f) => f.rating === 'up').length;
  const down = items.length - up;
  const reasons = REASONS.map((r) => ({ r, n: items.filter((f) => f.reason === r).length })).filter((x) => x.n);
  const shown = items.filter((f) => filter === 'all' || f.rating === filter);

  return (
    <section className="wide">
      <h1 className="pagetitle">משוב על תשובות</h1>
      <p className="muted">כל תשובה שדורגה בצ'אט, כדי לראות מה עובד ומה צריך לשפר.</p>

      <div className="stats">
        <div className="stat"><b>{items.length}</b><span>תשובות שדורגו</span></div>
        <div className="stat"><b>{up}</b><span>👍 לייקים</span></div>
        <div className="stat"><b>{down}</b><span>👎 דיסלייקים</span></div>
        <div className="stat"><b>{items.length ? `${Math.round((up / items.length) * 100)}%` : '—'}</b><span>שביעות רצון</span></div>
      </div>

      {reasons.length > 0 && (
        <div className="card">
          <h2>סיבות לדיסלייק</h2>
          <ul className="plain">
            {reasons.sort((a, b) => b.n - a.n).map((x) => (
              <li key={x.r}>{x.r}: <b>{x.n}</b></li>
            ))}
          </ul>
        </div>
      )}

      <div className="orgfilter">
        <label htmlFor="ffilter">הצג:</label>
        <select id="ffilter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">הכל</option>
          <option value="up">לייקים בלבד</option>
          <option value="down">דיסלייקים בלבד</option>
        </select>
        <button type="button" onClick={() => exportCsv(shown)} disabled={!shown.length}>ייצוא ל-CSV</button>
      </div>

      {shown.length === 0 && <p className="muted">אין עדיין משוב להצגה.</p>}
      {shown.map((f) => (
        <div key={f.id} className="card">
          <div className="muted small">
            {f.rating === 'up' ? '👍' : '👎'} {when(f.at)}
            {f.reason && ` · ${f.reason}`}
          </div>
          <p><strong>{f.question}</strong></p>
          <details>
            <summary>הצג תשובה</summary>
            <Markdown text={f.answer} />
          </details>
        </div>
      ))}
    </section>
  );
}

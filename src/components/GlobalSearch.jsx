import { useEffect, useRef, useState } from 'react';

const GROUPS = [
  { key: 'people', label: 'עובדים', icon: '👤', href: (id) => `#/person/${id}` },
  { key: 'projects', label: 'פרויקטים', icon: '🚀', href: (id) => `#/project/${id}` },
  { key: 'tasks', label: 'משימות', icon: '🎫', href: (id) => `#/task/${id}` },
];
const FILTERS = [
  { value: 'all', label: 'כללי', placeholder: 'עובד, פרויקט או משימה' },
  { value: 'people', label: 'עובד', placeholder: 'שם, תפקיד, עיר או מיומנות' },
  { value: 'tasks', label: 'משימה', placeholder: 'מספר, כותרת או אחראי' },
  { value: 'projects', label: 'פרויקט', placeholder: 'שם או תיאור' },
];
const STATUS_HE = { Done: 'הושלם', 'In Progress': 'בעבודה', 'In Review': 'בסקירה', Blocked: 'חסום', 'To Do': 'לביצוע' };

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced; a slower response for an older query is ignored.
  useEffect(() => {
    setError(false);
    if (!query.trim()) {
      setResults(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}&type=${type}`)
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (stale) return;
          setResults(data);
          setActive(0);
        })
        .catch(() => !stale && setError(true));
    }, 180);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, type]);

  // Close on outside click; Ctrl+K focuses the field from anywhere.
  useEffect(() => {
    const onDown = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const flat = results ? GROUPS.flatMap((g) => results[g.key].map((r) => ({ ...r, group: g, href: g.href(r.id) }))) : [];

  const done = () => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  function onKeyDown(e) {
    if (e.key === 'Escape') return done();
    if (!flat.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      window.location.hash = flat[active].href;
      done();
    }
  }

  let index = -1;
  return (
    <div className="search" ref={boxRef}>
      <select
        value={type}
        aria-label="סוג התוצאות"
        onChange={(e) => {
          setType(e.target.value);
          setResults(null); // don't show results of the previous filter while loading
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder={`🔍 ${FILTERS.find((f) => f.value === type).placeholder} (Ctrl+K)`}
        aria-label="חיפוש כללי"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && query.trim() && (results || error) && (
        <div className="searchdrop">
          {error && <p className="err">⚠️ החיפוש נכשל</p>}
          {!error && flat.length === 0 && <p className="muted">לא נמצאו תוצאות.</p>}
          {!error &&
            GROUPS.filter((g) => results?.[g.key].length).map((g) => (
              <div key={g.key}>
                <div className="searchgroup">{g.label}</div>
                {results[g.key].map((r) => {
                  const i = ++index;
                  return (
                    <a key={r.id} href={g.href(r.id)} className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={done}>
                      <span>{g.icon}</span>
                      <span className="txt">
                        <b>{r.title}</b>
                        <small>{r.subtitle.replace(/(In Progress|In Review|To Do|Blocked|Done)$/, (s) => STATUS_HE[s])}</small>
                      </span>
                    </a>
                  );
                })}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';

const flatten = (node) => [node, ...node.reports.flatMap(flatten)];
const option = (p) => (
  <option key={p.id} value={p.id}>
    {p.fullName} · {p.role}
  </option>
);

// Edit panel shown under the toolbar while the org page is in edit mode.
export default function OrgEditor({ tree, pool, selectedId, onSelect, onChange }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const people = flatten(tree);
  const selected = people.find((p) => p.id === selectedId);
  const isRoot = selected?.id === tree.id;

  async function call(method, url, body) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
      onChange(data);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    const extra = selected.reports.length ? `\n${selected.reports.length} הכפופים הישירים יעברו למנהל שמעל.` : '';
    if (!window.confirm(`להסיר את ${selected.fullName} מהמבנה הארגוני?${extra}`)) return;
    call('DELETE', `/api/org/people/${selected.id}`).then((ok) => ok && onSelect(''));
  }

  const below = selected ? new Set(flatten(selected).map((p) => p.id)) : new Set();

  return (
    <div className="orgedit">
      {error && <p className="err">⚠️ {error}</p>}

      <div className="card">
        <h2>עריכת אדם</h2>
        <div className="field">
          <label htmlFor="who">אדם בארגון (או לחיצה עליו בעץ)</label>
          <select id="who" value={selected?.id ?? ''} onChange={(e) => onSelect(e.target.value)}>
            <option value="">בחר…</option>
            {people.map(option)}
          </select>
        </div>

        {selected && (
          <>
            <div className="field">
              <label htmlFor="add">הוסף אדם תחת {selected.fullName}</label>
              <select
                id="add"
                value=""
                disabled={busy || !pool.length}
                onChange={(e) => e.target.value && call('PUT', `/api/org/people/${e.target.value}`, { managerId: selected.id })}
              >
                <option value="">{pool.length ? `בחר מהרשימה הכללית (${pool.length})…` : 'הרשימה הכללית ריקה'}</option>
                {pool.map(option)}
              </select>
            </div>

            {!isRoot && (
              <>
                <div className="field">
                  <label htmlFor="move">העבר את {selected.fullName} תחת</label>
                  <select
                    id="move"
                    value=""
                    disabled={busy}
                    onChange={(e) => e.target.value && call('PUT', `/api/org/people/${selected.id}`, { managerId: e.target.value })}
                  >
                    <option value="">בחר מנהל חדש…</option>
                    {people.filter((p) => !below.has(p.id) && !p.reports.some((r) => r.id === selected.id)).map(option)}
                  </select>
                </div>
                {selected.reports.length > 0 && (
                  <TeamName key={selected.id + (selected.teamName ?? '')} person={selected} busy={busy} save={(name) => call('PUT', `/api/org/teams/${selected.id}`, { name })} />
                )}
                <button type="button" className="danger" onClick={remove} disabled={busy}>
                  הסר מהארגון
                </button>
              </>
            )}
          </>
        )}
      </div>

      <NewTeam people={people} pool={pool} root={tree} busy={busy} create={(body) => call('POST', '/api/org/teams', body)} />
    </div>
  );
}

function TeamName({ person, busy, save }) {
  const [name, setName] = useState(person.teamName ?? '');
  return (
    <form
      className="field"
      onSubmit={(e) => {
        e.preventDefault();
        save(name);
      }}
    >
      <label htmlFor="tname">שם הצוות</label>
      <span className="inline">
        <input id="tname" value={name} maxLength={60} placeholder={`הצוות של ${person.fullName}`} onChange={(e) => setName(e.target.value)} />
        <button type="submit" disabled={busy}>שמור</button>
      </span>
    </form>
  );
}

function NewTeam({ people, pool, root, busy, create }) {
  const [name, setName] = useState('');
  const [leadId, setLeadId] = useState('');
  const [parentId, setParentId] = useState(root.id);
  const [memberIds, setMemberIds] = useState([]);

  // Lead and members can come from the general list or from the existing org (which moves them).
  const everyone = [...pool, ...people.filter((p) => p.id !== root.id)];
  const toggle = (id) => setMemberIds((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  async function submit(e) {
    e.preventDefault();
    if (await create({ name, leadId, parentId, memberIds })) {
      setName('');
      setLeadId('');
      setMemberIds([]);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>צוות חדש</h2>
      <div className="field">
        <label htmlFor="nt-name">שם הצוות</label>
        <input id="nt-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: צוות אבטחה" />
      </div>
      <div className="field">
        <label htmlFor="nt-lead">ראש הצוות</label>
        <select
          id="nt-lead"
          value={leadId}
          onChange={(e) => {
            setLeadId(e.target.value);
            setMemberIds((m) => m.filter((x) => x !== e.target.value));
          }}
        >
          <option value="">בחר…</option>
          {everyone.map(option)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="nt-parent">ראש הצוות כפוף ל</label>
        <select id="nt-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
          {people.filter((p) => p.id !== leadId).map(option)}
        </select>
      </div>
      <fieldset className="field">
        <legend>חברי הצוות ({memberIds.length})</legend>
        <div className="checks">
          {everyone
            .filter((p) => p.id !== leadId)
            .map((p) => (
              <label key={p.id}>
                <input type="checkbox" checked={memberIds.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  {p.fullName} <small className="muted">{p.role}{pool.includes(p) ? '' : ' · כבר בארגון'}</small>
                </span>
              </label>
            ))}
        </div>
      </fieldset>
      <button type="submit" className="primary" disabled={busy || !name.trim() || !leadId || !memberIds.length}>
        צור צוות
      </button>
    </form>
  );
}

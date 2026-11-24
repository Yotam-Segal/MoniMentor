import { useEffect, useState } from 'react';
import Avatar from '../Avatar.jsx';
import { HEALTH_LABEL, ProgressBar } from './ProjectPage.jsx';

function Node({ node }) {
  return (
    <li>
      <a className="orgnode" href={`#/person/${node.id}`} title={node.role}>
        <Avatar person={node} size={64} />
        <strong>{node.fullName}</strong>
        <small>{node.role}</small>
      </a>
      {node.reports.length > 0 && (
        <ul>
          {node.reports.map((r) => (
            <Node key={r.id} node={r} />
          ))}
        </ul>
      )}
    </li>
  );
}

// Every manager below the root (a node with reports) is a selectable team.
function collectTeams(node, isRoot = true) {
  const own = !isRoot && node.reports.length ? [node] : [];
  return [...own, ...node.reports.flatMap((r) => collectTeams(r, false))];
}

export default function OrgPage() {
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');
  const [teamId, setTeamId] = useState(''); // '' = full org

  useEffect(() => {
    fetch('/api/org')
      .then((r) => r.json())
      .then(setTree)
      .catch((e) => setError(e.message));
  }, []);

  const [projects, setProjects] = useState([]);
  useEffect(() => {
    setProjects([]);
    if (!teamId) return;
    fetch(`/api/projects?team=${teamId}`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [teamId]);

  const teams = tree ? collectTeams(tree) : [];
  const focused = teams.find((t) => t.id === teamId);
  const shown = focused ?? tree;

  return (
    <section className="wide">
      <h1 className="pagetitle">המבנה הארגוני</h1>
      <p className="muted">לחץ על אדם כדי לעבור לדף שלו.</p>
      {teams.length > 1 && (
        <div className="orgfilter">
          <label htmlFor="team">תצוגה:</label>
          <select id="team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">כל הארגון</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                הצוות של {t.fullName} ({t.reports.length})
              </option>
            ))}
          </select>
          {focused && (
            <button type="button" onClick={() => setTeamId('')}>
              ← חזרה לעץ המלא
            </button>
          )}
        </div>
      )}
      {error && <p className="err">⚠️ {error}</p>}
      {!tree && !error && <p className="muted">טוען…</p>}
      {tree && (
        <div className="orgscroll">
          <ul className="orgtree root">
            <Node node={shown} />
          </ul>
        </div>
      )}
      {focused && projects.length > 0 && (
        <div className="projects">
          <h2>🚀 פרויקטים וחזיתות עבודה של הצוות</h2>
          <div className="projgrid">
            {projects.map((p) => (
              <a key={p.id} className="projcard" href={`#/project/${p.id}`}>
                <div className="projtop">
                  <strong>{p.name}</strong>
                  <span className={`health ${p.health}`}>{HEALTH_LABEL[p.health]}</span>
                </div>
                <small className="muted">{p.description}</small>
                <small className="muted">אחראי: {p.owner.fullName}</small>
                <ProgressBar value={p.progress} expected={p.expectedProgress} />
                <div className="projmeta">
                  <span>
                    {p.progress}% · {p.donePoints}/{p.totalPoints} נק׳
                  </span>
                  <span>
                    יעד {new Date(`${p.target}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} ({p.daysLeft} ימים)
                  </span>
                </div>
                <div className="avatars">
                  {p.members.map((m) => (
                    <Avatar key={m.id} person={m} size={28} />
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

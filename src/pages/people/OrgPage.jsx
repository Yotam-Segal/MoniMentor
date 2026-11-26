import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import OrgEditor from '../../components/OrgEditor.jsx';
import ProjectCard from '../../components/ProjectCard.jsx';

// In edit mode (onPick set) clicking a node selects it instead of opening the person page.
function Node({ node, onPick, selectedId }) {
  return (
    <li>
      <a
        className={`orgnode ${onPick && node.id === selectedId ? 'selected' : ''}`}
        href={`#/person/${node.id}`}
        title={node.role}
        onClick={
          onPick &&
          ((e) => {
            e.preventDefault();
            onPick(node.id);
          })
        }
      >
        <Avatar person={node} size={64} />
        <strong>{node.fullName}</strong>
        <small>{node.role}</small>
        {node.teamName && <em className="teamtag">{node.teamName}</em>}
      </a>
      {node.reports.length > 0 && (
        <ul>
          {node.reports.map((r) => (
            <Node key={r.id} node={r} onPick={onPick} selectedId={selectedId} />
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

  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pool, setPool] = useState([]);
  useEffect(() => {
    if (!editing) return;
    fetch('/api/org/pool')
      .then((r) => r.json())
      .then(setPool)
      .catch((e) => setError(e.message));
  }, [editing]);

  const [projects, setProjects] = useState([]);
  useEffect(() => {
    setProjects([]);
    if (!teamId) return;
    fetch(`/api/projects?team=${teamId}`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [teamId, tree]); // tree: membership may have changed in edit mode

  const teams = tree ? collectTeams(tree) : [];
  const focused = teams.find((t) => t.id === teamId);
  const shown = focused ?? tree;

  return (
    <section className="wide">
      <h1 className="pagetitle">המבנה הארגוני</h1>
      {editing && <p className="muted">{'מצב עריכה: לחץ על אדם בעץ כדי לבחור אותו. השינויים נשמרים מיד.'}</p>}
      {tree && (
        <div className="orgfilter">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setSelectedId('');
              setTeamId('');
            }}
          >
            {editing ? '✓ סיום עריכה' : '✏️ עריכת המבנה'}
          </button>
        </div>
      )}
      {editing && tree && (
        <OrgEditor
          tree={tree}
          pool={pool}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={(state) => {
            setTree(state.tree);
            setPool(state.pool);
          }}
        />
      )}
      {!editing && teams.length > 1 && (
        <div className="orgfilter">
          <select id="team" aria-label="תצוגה" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">כל הארגון</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName || `הצוות של ${t.fullName}`} ({t.reports.length})
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="err">⚠️ {error}</p>}
      {!tree && !error && <p className="muted">טוען…</p>}
      {tree && (
        <div className="orgscroll">
          <ul className="orgtree root">
            <Node node={shown} onPick={editing ? setSelectedId : undefined} selectedId={selectedId} />
          </ul>
        </div>
      )}
      {focused && projects.length > 0 && (
        <div className="projects">
          <h2>🚀 פרויקטים וחזיתות עבודה של הצוות</h2>
          <div className="projgrid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

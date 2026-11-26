import { useEffect, useState } from 'react';
import ProjectCard from '../../components/ProjectCard.jsx';

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');

  // Without a team parameter the server returns everything under the signed-in manager.
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => {
        if (!r.ok) throw new Error(`שגיאה ${r.status}`);
        return r.json();
      })
      .then(setProjects)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <section className="wide">
      <h1 className="pagetitle">פרויקטים</h1>
      <p className="muted">כל הפרויקטים שקשורים אליך ואל הארגון שלך. לחץ על פרויקט כדי לראות את התכלול שלו.</p>
      {error && <p className="err">⚠️ {error}</p>}
      {!projects && !error && <p className="muted">טוען…</p>}
      {projects?.length === 0 && <p className="muted">אין פרויקטים להצגה.</p>}
      {projects?.length > 0 && (
        <div className="projgrid">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </section>
  );
}

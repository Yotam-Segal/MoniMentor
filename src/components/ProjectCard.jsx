import Avatar from './Avatar.jsx';
import { HEALTH_LABEL, ProgressBar } from './ProjectHealth.jsx';

const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

// Clickable project tile, used on the projects page and in the org page's team view.
export default function ProjectCard({ project: p }) {
  return (
    <a className="projcard" href={`#/project/${p.id}`}>
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
          יעד {shortDate(p.target)} ({p.daysLeft} ימים)
        </span>
      </div>
      <div className="avatars">
        {p.members.map((m) => (
          <Avatar key={m.id} person={m} size={28} />
        ))}
      </div>
    </a>
  );
}

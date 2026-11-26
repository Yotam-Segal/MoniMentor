// Health badge label + progress bar, shared by the project card and the project page.
export const HEALTH_LABEL = { on_track: 'בקצב', watch: 'שים לב', at_risk: 'בסיכון' };

export function ProgressBar({ value, expected }) {
  return (
    <div className="progress" title={`התקדמות ${value}% (צפוי ${expected}%)`}>
      <span style={{ width: `${value}%` }} />
      {expected != null && <i style={{ right: `${expected}%` }} />}
    </div>
  );
}

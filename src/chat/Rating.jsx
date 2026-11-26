// Keep in sync with REASONS in server/feedback.js
export const REASONS = ['לא מדויק', 'לא רלוונטי', 'ארוך מדי', 'חסר מידע', 'אחר'];

export default function Rating({ value, onChange }) {
  const rating = value?.rating ?? null;
  const toggle = (r) => onChange(rating === r ? null : { rating: r, reason: null });

  return (
    <div className="rating">
      <button className={rating === 'up' ? 'on up' : ''} onClick={() => toggle('up')} aria-pressed={rating === 'up'} title="תשובה טובה" aria-label="לייק">
        👍
      </button>
      <button className={rating === 'down' ? 'on down' : ''} onClick={() => toggle('down')} aria-pressed={rating === 'down'} title="תשובה לא טובה" aria-label="דיסלייק">
        👎
      </button>
      {rating === 'down' && (
        <span className="reasons">
          <span className="muted">מה לא היה טוב?</span>
          {REASONS.map((reason) => (
            <button
              key={reason}
              className={value.reason === reason ? 'on' : ''}
              onClick={() => onChange({ rating: 'down', reason: value.reason === reason ? null : reason })}
              aria-pressed={value.reason === reason}
            >
              {reason}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

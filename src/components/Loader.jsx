import { useEffect, useState } from 'react';

// Spinner with a rotating status line, so the wait (LLM call) doesn't look frozen.
export default function Loader({ steps }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 2500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="loader" role="status" aria-live="polite">
      <span className="spinner" />
      <span>{steps[i]}</span>
    </div>
  );
}

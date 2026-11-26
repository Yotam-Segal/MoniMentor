import { existsSync, readFileSync, writeFileSync } from 'node:fs';

// Ratings of model answers. Holds conversation text, so the file is git-ignored.
const FILE = new URL('./data/feedback.json', import.meta.url);
const MAX_TEXT = 8000;
export const REASONS = ['לא מדויק', 'לא רלוונטי', 'ארוך מדי', 'חסר מידע', 'אחר'];

export function listFeedback() {
  if (!existsSync(FILE)) return [];
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

const clip = (s) => String(s ?? '').slice(0, MAX_TEXT);

// Upsert by answer id; rating null removes the entry.
export function saveFeedback({ id, rating, reason, question, answer }) {
  if (typeof id !== 'string' || !id || !['up', 'down', null].includes(rating)) return false;
  const rest = listFeedback().filter((f) => f.id !== id);
  if (rating) {
    rest.unshift({
      id,
      rating,
      reason: rating === 'down' && REASONS.includes(reason) ? reason : null,
      question: clip(question),
      answer: clip(answer),
      at: new Date().toISOString(),
    });
  }
  writeFileSync(FILE, JSON.stringify(rest, null, 2));
  return true;
}

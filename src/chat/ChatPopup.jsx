import { useEffect, useState } from 'react';
import { ChatComposer, ChatMessages, titleOf, useChat } from './chat.jsx';

// The agent as a floating companion on every page except its own.
export default function ChatPopup({ hidden }) {
  const { messages, busy, newChat, chats } = useChat();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  if (!open) {
    return (
      <button className={`chatfab ${busy ? 'busy' : ''}`} onClick={() => setOpen(true)} aria-label="פתח שיחה עם הסוכן" title="שאל את הסוכן">
        💬
      </button>
    );
  }

  return (
    <section className="chatpop" role="dialog" aria-label="שיחה עם הסוכן">
      <header>
        <strong>{messages.length ? titleOf(messages) : 'MoniMentor'}</strong>
        <span className="actions">
          <button onClick={newChat} disabled={busy} title="שיחה חדשה" aria-label="שיחה חדשה">
            ＋
          </button>
          <a href="#/agent" onClick={() => setOpen(false)} title="פתח בגדול בדף הסוכן" aria-label="פתח בגדול בדף הסוכן">
            ⤢
          </a>
          <button onClick={() => setOpen(false)} title="סגור" aria-label="סגור">
            ✕
          </button>
        </span>
      </header>
      {messages.length ? <ChatMessages /> : <p className="popempty">שאל אותי על הצוותים, המשימות והפרויקטים.</p>}
      <ChatComposer />
      <a className="popall" href="#/agent" onClick={() => setOpen(false)}>
        כל השיחות שלי{chats.length ? ` (${chats.length})` : ''} ←
      </a>
    </section>
  );
}

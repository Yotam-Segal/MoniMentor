import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';

const SUGGESTIONS = [
  'איזה צוות התעכב השבוע ולמה?',
  'הכן לי סיכום שבועי להנהלה',
  'עזור לי להתכונן לשיחת 1-on-1',
  'מה זה צוואר בקבוק בספרינט ואיך מזהים אותו?',
];

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const started = messages.length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Executive Digest agent: one-shot, non-streaming; shown as a normal assistant message.
  async function runDigest() {
    if (busy) return;
    setMessages((m) => [...m, { role: 'user', content: 'הפק סיכום שבועי להנהלה' }, { role: 'assistant', content: '' }]);
    setBusy(true);
    let content;
    try {
      const res = await fetch('/api/digest', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `שגיאה ${res.status}`);
      content = data.markdown;
    } catch (e) {
      content = `⚠️ ${e.message}`;
    }
    setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content }]);
    setBusy(false);
  }

  async function send(text) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user', content }];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);

    const patch = (fn) =>
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: fn(copy[copy.length - 1].content) };
        return copy;
      });

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `שגיאה ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        patch((c) => c + chunk);
      }
    } catch (e) {
      patch(() => `⚠️ ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`app ${started ? 'chatting' : ''}`}>
      <header className="brand">
        <span className="logo">M</span>
        <span className="name">MoniMentor</span>
      </header>

      {!started && (
        <section className="hero">
          <h1>
            מה קורה בצוותים שלך <em>השבוע?</em>
          </h1>
          <p>
            עוזר AI למנהלים שמחבר בין Git ו-Jira, ומתרגם עבודה טכנית לתמונה עסקית – סיכומי הנהלה,
            מעקב צוותים והכנה לשיחות 1-on-1.
          </p>
          <button className="cta" onClick={runDigest}>
            📊 הפק סיכום שבועי להנהלה
          </button>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        </section>
      )}

      {started && (
        <main className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                {!m.content ? <span className="dots">...</span> : m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </main>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="שאל את MoniMentor…"
          autoFocus
        />
        <button type="submit" disabled={busy || !input.trim()}>
          שלח
        </button>
      </form>
    </div>
  );
}

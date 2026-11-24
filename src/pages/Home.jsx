import { useEffect, useRef, useState } from 'react';
import Markdown from '../Markdown.jsx';

const SUGGESTIONS = [
  'איזה צוות התעכב השבוע ולמה?',
  'הכן לי סיכום שבועי להנהלה',
  'עזור לי להתכונן לשיחת 1-on-1',
  'מה זה צוואר בקבוק בספרינט ואיך מזהים אותו?',
];

// Chat history lives in this browser's localStorage (per user/browser, not on the server).
const CHATS_KEY = 'mm.chats';
const ACTIVE_KEY = 'mm.activeChat';
const MAX_CHATS = 50;

const load = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full – history just won't persist */
  }
};

const titleOf = (messages) => (messages.find((m) => m.role === 'user')?.content ?? 'שיחה חדשה').slice(0, 45);
const timeLabel = (ts) =>
  new Date(ts).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Home() {
  const [chats, setChats] = useState(() => load(CHATS_KEY, []));
  const [activeId, setActiveId] = useState(() => {
    const id = load(ACTIVE_KEY, null);
    return load(CHATS_KEY, []).some((c) => c.id === id) ? id : null;
  });
  const [messages, setMessages] = useState(() => {
    const id = load(ACTIVE_KEY, null);
    return load(CHATS_KEY, []).find((c) => c.id === id)?.messages ?? [];
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const started = messages.length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep the active conversation saved in the history list (skipping a still-empty assistant reply).
  useEffect(() => {
    if (!activeId || !messages.length) return;
    const clean = messages.filter((m) => m.content || m.role === 'user');
    setChats((all) => {
      const rest = all.filter((c) => c.id !== activeId);
      return [{ id: activeId, title: titleOf(clean), updatedAt: Date.now(), messages: clean }, ...rest].slice(0, MAX_CHATS);
    });
  }, [messages, activeId]);

  useEffect(() => save(CHATS_KEY, chats), [chats]);
  useEffect(() => save(ACTIVE_KEY, activeId), [activeId]);

  const ensureChat = () => {
    if (activeId) return;
    setActiveId(Date.now().toString(36));
  };

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setInput('');
  }

  function openChat(id) {
    if (busy || id === activeId) return;
    setActiveId(id);
    setMessages(chats.find((c) => c.id === id)?.messages ?? []);
  }

  function deleteChat(id) {
    if (busy) return;
    setChats((all) => all.filter((c) => c.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
  }

  function clearAll() {
    if (busy || !window.confirm('למחוק את כל היסטוריית השיחות?')) return;
    setChats([]);
    setActiveId(null);
    setMessages([]);
  }

  // Executive Digest agent: one-shot, non-streaming; shown as a normal assistant message.
  async function runDigest() {
    if (busy) return;
    ensureChat();
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
    ensureChat();
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
      // Error bubbles (⚠️) are display-only; don't feed them back to the model.
      const history = next.filter((m) => !m.content.startsWith('⚠️'));
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
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
    <div className="homewrap">
      <aside className="history" aria-label="היסטוריית שיחות">
        <button className="newchat" onClick={newChat} disabled={busy}>
          ＋ שיחה חדשה
        </button>
        <div className="histtitle">היסטוריית שיחות</div>
        {chats.length === 0 && <p className="muted small">עוד אין שיחות. התחל לשאול משהו.</p>}
        <ul>
          {chats.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'active' : ''}>
              <button className="histitem" onClick={() => openChat(c.id)} disabled={busy && c.id !== activeId}>
                <span className="t">{c.title}</span>
                <small>{timeLabel(c.updatedAt)}</small>
              </button>
              <button className="histdel" onClick={() => deleteChat(c.id)} disabled={busy} title="מחק שיחה" aria-label="מחק שיחה">
                ✕
              </button>
            </li>
          ))}
        </ul>
        {chats.length > 0 && (
          <button className="clearall" onClick={clearAll} disabled={busy}>
            מחק את כל ההיסטוריה
          </button>
        )}
      </aside>

      <div className={`app ${started ? 'chatting' : ''}`}>
        {!started && (
          <section className="hero">
            <h1>
              מה קורה בצוותים שלך <em>השבוע?</em>
            </h1>
            <p>
              עוזר AI למנהלים שמחבר בין Git ו-Jira, ומתרגם עבודה טכנית לתמונה עסקית – סיכומי הנהלה,
              מעקב צוותים והכנה לשיחות 1-on-1.
            </p>
            <div className="navcards">
              <a className="navcard" href="#/work">
                <span className="ico">🗂️</span>
                <strong>העבודה שלי</strong>
                <small>בלו"ז קרוב, משימות פתוחות ומה שדורש את הקשב שלך</small>
              </a>
              <a className="navcard" href="#/daily">
                <span className="ico">📋</span>
                <strong>מסמך דיילי</strong>
                <small>סיכום בוקר: מה בתעדוף ומה לקדם כדי לעמוד ביעדי הפרויקטים</small>
              </a>
              <a className="navcard" href="#/org">
                <span className="ico">🌳</span>
                <strong>המבנה הארגוני</strong>
                <small>עץ הארגון שלך – היכנס לדף של כל אדם בצוות</small>
              </a>
            </div>
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
          <>
            <div className="chathead">
              <strong>{titleOf(messages)}</strong>
              <span className="actions">
                <button onClick={newChat} disabled={busy}>
                  ＋ שיחה חדשה
                </button>
                <button onClick={() => deleteChat(activeId)} disabled={busy}>
                  🗑️ נקה שיחה
                </button>
              </span>
            </div>
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
          </>
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
    </div>
  );
}

// Chat state shared by the agent page and the floating popup: one conversation, one history.
// It lives above the router, so an answer keeps streaming while the user moves between pages.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Markdown from '../components/Markdown.jsx';
import Rating from './Rating.jsx';

// Chat history lives in this browser's localStorage (per user/browser, not on the server).
const CHATS_KEY = 'mm.chats';
const ACTIVE_KEY = 'mm.activeChat';
const MAX_CHATS = 50;
export const MAX_PINNED = 3;

// Keeps the newest MAX_CHATS, but never drops a pinned chat.
const trim = (chats) => chats.filter((c, i) => c.pinned || i < MAX_CHATS);

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

export const titleOf = (messages) => (messages.find((m) => m.role === 'user')?.content ?? 'שיחה חדשה').slice(0, 45);

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

export function ChatProvider({ children }) {
  const [chats, setChats] = useState(() => load(CHATS_KEY, []));
  const [activeId, setActiveId] = useState(() => {
    const id = load(ACTIVE_KEY, null);
    return load(CHATS_KEY, []).some((c) => c.id === id) ? id : null;
  });
  const [messages, setMessages] = useState(() => {
    const id = load(ACTIVE_KEY, null);
    return load(CHATS_KEY, []).find((c) => c.id === id)?.messages ?? [];
  });
  const [busy, setBusy] = useState(false);

  // Keep the active conversation saved in the history list (skipping a still-empty assistant reply).
  useEffect(() => {
    if (!activeId || !messages.length) return;
    const clean = messages.filter((m) => m.content || m.role === 'user');
    setChats((all) => {
      const old = all.find((c) => c.id === activeId);
      const sameText = old && old.messages.length === clean.length && old.messages.every((m, i) => m.content === clean[i].content);
      // Opening a chat or rating an answer must not reorder the history.
      if (sameText) return all.map((c) => (c === old ? { ...c, messages: clean } : c));
      const rest = all.filter((c) => c.id !== activeId);
      return trim([{ ...old, id: activeId, title: titleOf(clean), updatedAt: Date.now(), messages: clean }, ...rest]);
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
  }

  function openChat(id) {
    if (busy || id === activeId) return;
    setActiveId(id);
    setMessages(chats.find((c) => c.id === id)?.messages ?? []);
  }

  function togglePin(id) {
    setChats((all) => {
      const full = all.filter((c) => c.pinned).length >= MAX_PINNED;
      return all.map((c) => (c.id !== id ? c : c.pinned ? { ...c, pinned: false } : full ? c : { ...c, pinned: true }));
    });
  }

  function deleteChat(id) {
    if (busy) return;
    setChats((all) => all.filter((c) => c.id !== id));
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
  }

  // Rating is kept on the message (for the UI) and sent to the server (for insights).
  async function rate(index, feedback) {
    const previous = messages[index].feedback ?? null;
    const apply = (value) => setMessages((m) => m.map((x, i) => (i === index ? { ...x, feedback: value ?? undefined } : x)));
    apply(feedback);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `${activeId}:${index}`,
          rating: feedback?.rating ?? null,
          reason: feedback?.reason ?? null,
          question: messages[index - 1]?.content ?? '',
          answer: messages[index].content,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      apply(previous); // not saved – don't pretend it was
    }
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

  // Returns false when nothing was sent, so the composer can keep the typed text.
  function send(text) {
    const content = text.trim();
    if (!content || busy) return false;
    ensureChat();
    stream([...messages, { role: 'user', content }]);
    return true;
  }

  async function stream(next) {
    setMessages([...next, { role: 'assistant', content: '' }]);
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

  const value = { chats, activeId, messages, busy, send, runDigest, rate, newChat, openChat, togglePin, deleteChat };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function ChatMessages() {
  const { messages, busy, rate } = useChat();
  const listRef = useRef(null);

  // Scrolls only the message list, never the page behind it.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <main className="messages" ref={listRef}>
      {messages.map((m, i) => (
        <div key={i} className={`msg ${m.role}`}>
          <div className="bubble">
            {!m.content ? <span className="dots">...</span> : m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}
          </div>
          {/* no rating on errors or on an answer that is still streaming */}
          {m.role === 'assistant' && m.content && !m.content.startsWith('⚠️') && !(busy && i === messages.length - 1) && (
            <Rating value={m.feedback} onChange={(f) => rate(i, f)} />
          )}
        </div>
      ))}
    </main>
  );
}

export function ChatComposer() {
  const { send, busy } = useChat();
  const [input, setInput] = useState('');
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        if (send(input)) setInput('');
      }}
    >
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאל את MoniMentor…" autoFocus />
      <button type="submit" disabled={busy || !input.trim()}>
        שלח
      </button>
    </form>
  );
}

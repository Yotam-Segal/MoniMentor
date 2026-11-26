import { ChatComposer, ChatMessages, MAX_PINNED, titleOf, useChat } from '../../chat/chat.jsx';

const SUGGESTIONS = [
  'איזה צוות התעכב השבוע ולמה?',
  'הכן לי סיכום שבועי להנהלה',
  'עזור לי להתכונן לשיחת 1-on-1',
  'מה זה צוואר בקבוק בספרינט ואיך מזהים אותו?',
];

const timeLabel = (ts) =>
  new Date(ts).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

// The agent page: history sidebar + the full-size conversation.
export default function AgentPage() {
  const { chats, activeId, messages, busy, send, runDigest, newChat, openChat, togglePin, deleteChat } = useChat();
  const started = messages.length > 0;
  const pinnedCount = chats.filter((c) => c.pinned).length;
  // Pinned chats come first; each group keeps its newest-first order.
  const orderedChats = [...chats.filter((c) => c.pinned), ...chats.filter((c) => !c.pinned)];

  return (
    <div className="homewrap">
      <aside className="history" aria-label="היסטוריית שיחות">
        <button className="newchat" onClick={newChat} disabled={busy}>
          ＋ שיחה חדשה
        </button>
        <div className="histtitle">מסמכי תכנון</div>
        <a className="toollink" href="#/daily">📋 מסמך דיילי</a>
        <a className="toollink" href="#/weekly">🗓️ תכנון שבועי</a>
        <div className="histtitle">היסטוריית שיחות</div>
        {chats.length === 0 && <p className="muted small">עוד אין שיחות. התחל לשאול משהו.</p>}
        <ul>
          {orderedChats.map((c) => (
            <li key={c.id} className={`${c.id === activeId ? 'active' : ''} ${c.pinned ? 'pinned' : ''}`}>
              <button className="histitem" onClick={() => openChat(c.id)} disabled={busy && c.id !== activeId}>
                <span className="t">{c.title}</span>
                <small>{timeLabel(c.updatedAt)}</small>
              </button>
              <button
                className="histpin"
                onClick={() => togglePin(c.id)}
                disabled={!c.pinned && pinnedCount >= MAX_PINNED}
                aria-pressed={Boolean(c.pinned)}
                aria-label={c.pinned ? 'בטל נעיצה' : 'נעץ שיחה'}
                title={c.pinned ? 'בטל נעיצה' : pinnedCount >= MAX_PINNED ? `אפשר לנעוץ עד ${MAX_PINNED} שיחות` : 'נעץ שיחה'}
              >
                📌
              </button>
              <button className="histdel" onClick={() => deleteChat(c.id)} disabled={busy} title="מחק שיחה" aria-label="מחק שיחה">
                ✕
              </button>
            </li>
          ))}
        </ul>
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
            <div className="tools">
              <a className="tool" href="#/daily">
                <b>📋 מסמך דיילי</b>
                <small>מה בתעדוף היום</small>
              </a>
              <a className="tool" href="#/weekly">
                <b>🗓️ תכנון שבועי</b>
                <small>התוכנית לשבוע הקרוב</small>
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
            <ChatMessages />
          </>
        )}

        <ChatComposer />
      </div>
    </div>
  );
}

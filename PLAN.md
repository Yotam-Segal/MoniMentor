# תוכנית עבודה – MoniMentor (ExecutiveOps AI)

## שלב 0 – תשתית ומסך נחיתה + צ'אט (עכשיו)
- React + Vite (frontend), Express (backend) – מפתח ה-API נשאר בשרת בלבד (`.env`).
- מסך נחיתה בעברית (RTL) עם צ'אט חי מול Claude.
- בשלב זה משתמשים ב-Anthropic API; בהמשך מחליפים ל-Ollama/Qwen לפי ה-PRD (שכבת `server/llm.js` מבודדת לצורך כך).

## שלב 1 – נתוני Mock
- `server/data/`: Jira tickets, Git commits/PRs, צוותים ועובדים (JSON).
- SQLite לשמירת משימות, משתמשים וסיכומים.

## שלב 2 – סוכנים (לפחות 3 מתוך 5)
1. Code Intelligence – ניתוח diffs → משמעות עסקית.
2. Task Analytics – סטטוסים, צווארי בקבוק, עומסים.
3. Executive Digest – סיכום שבועי מעוצב.
4. Employee Insights (1-on-1).
5. RAG Q&A.

## שלב 3 – RAG
- Embeddings + Vector store מקומי; חיבור לצ'אט.

## שלב 4 – דשבורד
- מסך Dashboard לצפייה בסיכומים + צ'אט משולב.

## שלב 5 – מעבר ל-Ollama (Air-Gapped) ובדיקות קבלה (MVP)

import Anthropic from '@anthropic-ai/sdk';
import { teamContext } from './data.js';
import { capacityContext } from './schedule.js';

// LLM layer is isolated here so it can later be swapped for Ollama/Qwen (see PRD).
const SYSTEM_PROMPT = `אתה MoniMentor – עוזר AI למנהלים בכירים בחברות פיתוח.
אתה עוזר להבין סטטוס צוותים, התקדמות ב-Jira וב-Git, להכין סיכומי הנהלה ושיחות 1-on-1.
ענה תמיד בעברית, בקצרה ובשפה ניהולית ברורה. אל תמציא עובדות;
אם חסר מידע, אמור זאת והצע מה ניתן לעשות.`;

let client;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const model = () => process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
export const llmReady = () => Boolean(process.env.ANTHROPIC_API_KEY);

// The model thinks by default and thinking tokens count against max_tokens, which cut visible answers short.
// There are no tool calls here, so thinking is turned off.
const NO_THINKING = { type: 'between_tools' };

const toMessages = (messages) =>
  messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content),
  }));

export async function streamChat(messages, onText) {
  const stream = getClient().messages.stream({
    model: model(),
    max_tokens: 2048,
    thinking: NO_THINKING,
    system: SYSTEM_PROMPT + teamContext() + capacityContext(),
    messages: toMessages(messages),
  });
  stream.on('text', onText);
  await stream.finalMessage();
}

// One-shot completion for agents. `system` replaces the chat persona.
export async function complete({ system, prompt, maxTokens = 2000 }) {
  const res = await getClient().messages.create({
    model: model(),
    max_tokens: maxTokens,
    thinking: NO_THINKING,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// Единственное место, где вызывается ИИ. Имена и номера учеников сюда не попадают.
// Какой ИИ работает, решает AI_PROVIDER: claude (по умолчанию) или gemini. Остальной код об этом не знает.
import Anthropic from '@anthropic-ai/sdk';
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from '@google/genai';
import type { Task } from '../shared/types';
import { HttpError } from './http';
import { readContent } from './pack';

const DEFAULT_MODEL = { claude: 'claude-opus-5-5', gemini: 'gemini-3.5-flash-lite' };
export const provider = (): 'claude' | 'gemini' => (process.env.AI_PROVIDER?.trim().toLowerCase() === 'gemini' ? 'gemini' : 'claude');
export const hasAi = () => !!(provider() === 'gemini' ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY);

export interface Ask {
  prompt: string; // имя файла в content/prompts
  content: string | { text: string; imageBase64?: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } };
  schema: Record<string, unknown>;
  timeoutMs: number;
  maxTokens: number;
  photo?: boolean;
}

const model = (q: Ask) => (q.photo ? process.env.AI_MODEL_PHOTO : process.env.AI_MODEL)?.trim() || DEFAULT_MODEL[provider()];

function parse<T>(text: string | undefined): T {
  try {
    return JSON.parse(text ?? '') as T;
  } catch {
    throw new HttpError(502, 'ИИ вернул неполный ответ, попробуйте ещё раз');
  }
}

export async function ask<T>(q: Ask): Promise<T> {
  if (!hasAi()) throw new HttpError(503, 'ИИ ещё не подключён');
  return parse<T>(provider() === 'gemini' ? await askGemini(q) : await askClaude(q));
}

// Gemini принимает только часть JSON Schema: убираем то, на что он может ответить ошибкой.
function geminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(geminiSchema);
  if (typeof s !== 'object' || s === null) return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties') continue;
    if (k === 'enum' && (s as { type?: string }).type === 'integer') {
      out.minimum = Math.min(...(v as number[]));
      out.maximum = Math.max(...(v as number[]));
      continue;
    }
    out[k] = geminiSchema(v);
  }
  return out;
}

async function askGemini(q: Ask): Promise<string | undefined> {
  const m = model(q);
  const c = q.content;
  const parts: Part[] = typeof c === 'string' ? [{ text: c }] : [...(c.imageBase64 ? [{ inlineData: { mimeType: c.imageBase64.mediaType, data: c.imageBase64.data } }] : []), { text: c.text }];
  try {
    const res = await new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }).models.generateContent({
      model: m,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: readContent(`prompts/${q.prompt}.md`),
        responseMimeType: 'application/json',
        responseJsonSchema: geminiSchema(q.schema),
        maxOutputTokens: q.maxTokens,
        abortSignal: AbortSignal.timeout(q.timeoutMs),
        // Короткое «обдумывание»: подсказка должна прийти за пару секунд
        ...(m.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
      },
    });
    const reason = res.candidates?.[0]?.finishReason;
    if (res.promptFeedback?.blockReason || reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT') throw new HttpError(422, 'ИИ не смог обработать этот текст');
    return res.text;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new HttpError(504, 'ИИ отвечает слишком долго, попробуйте ещё раз');
    if (e instanceof ApiError) {
      console.error('Gemini API', e.status, e.message);
      throw new HttpError(e.status === 429 ? 503 : 502, e.status === 429 ? 'ИИ перегружен, попробуйте через минуту' : 'ИИ сейчас недоступен');
    }
    throw e;
  }
}

async function askClaude(q: Ask): Promise<string> {
  const m = model(q);
  const c = q.content;
  const content: Anthropic.Beta.BetaContentBlockParam[] | string =
    typeof c === 'string' ? c : [...(c.imageBase64 ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: c.imageBase64.mediaType, data: c.imageBase64.data } }] : []), { type: 'text', text: c.text }];
  // Повторы выключены: у ученика уже есть офлайн-замена, долго ждать незачем.
  const client = new Anthropic({ timeout: q.timeoutMs, maxRetries: 0 });
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model: m,
      max_tokens: q.maxTokens,
      system: readContent(`prompts/${q.prompt}.md`),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: q.schema } },
      messages: [{ role: 'user', content }],
      // Если фильтр безопасности ошибочно отклонил учебный текст, тот же запрос выполнит запасная модель.
      ...(m.includes('haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
    });
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new HttpError(504, 'ИИ отвечает слишком долго, попробуйте ещё раз');
    if (e instanceof Anthropic.RateLimitError) throw new HttpError(503, 'ИИ перегружен, попробуйте через минуту');
    if (e instanceof Anthropic.APIError) {
      console.error('Claude API', e.status, e.message);
      throw new HttpError(502, 'ИИ сейчас недоступен');
    }
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new HttpError(422, 'ИИ не смог обработать этот текст');
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

export const obj = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

export function taskText(t: Task, withKey: boolean): string {
  const a = t.answer;
  const items = a.type === 'spans' ? a.sentences : a.type === 'free' ? [] : a.options;
  const key = a.type === 'choice' ? [a.correct] : a.type === 'free' ? [] : a.correct;
  return [
    `Язык: ${t.lang}`,
    ...t.docs.map((d) => `<document title="${d.title}">\n${d.body}\n</document>`),
    `Вопрос: ${t.question}`,
    items.length ? `Варианты:\n${items.map((o) => `- ${o}`).join('\n')}` : '',
    a.type === 'free' ? `Рубрика:\n${a.rubric.map((r, i) => `${i + 1}. ${r}`).join('\n')}` : '',
    withKey && key.length ? `Верно (не раскрывать ученику): ${key.map((i) => items[i]).join(' | ')}` : '',
    withKey ? `Разбор (не раскрывать ученику): ${t.explanation}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export const studentText = (s: string) => `<student_answer>\n${s.replace(/<\/?student_answer>/gi, '')}\n</student_answer>`;

// Единственное место, где вызывается Claude. Имена и номера учеников сюда не попадают.
import Anthropic from '@anthropic-ai/sdk';
import type { Task } from '../shared/types';
import { HttpError } from './http';
import { readContent } from './pack';

const DEFAULT_MODEL = 'claude-opus-5-5';
export const hasAi = () => !!process.env.ANTHROPIC_API_KEY;

export interface Ask {
  prompt: string; // имя файла в content/prompts
  content: string | Anthropic.Beta.BetaContentBlockParam[];
  schema: Record<string, unknown>;
  timeoutMs: number;
  maxTokens: number;
  photo?: boolean;
}

export async function ask<T>(q: Ask): Promise<T> {
  if (!hasAi()) throw new HttpError(503, 'ИИ ещё не подключён');
  const model = (q.photo ? process.env.AI_MODEL_PHOTO : process.env.AI_MODEL) || DEFAULT_MODEL;
  // Повторы выключены: у ученика уже есть офлайн-замена, долго ждать незачем.
  const client = new Anthropic({ timeout: q.timeoutMs, maxRetries: 0 });
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model,
      max_tokens: q.maxTokens,
      system: readContent(`prompts/${q.prompt}.md`),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: q.schema } },
      messages: [{ role: 'user', content: q.content }],
      // Если фильтр безопасности ошибочно отклонил учебный текст, тот же запрос выполнит запасная модель.
      ...(model.includes('haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
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
  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(502, 'ИИ вернул неполный ответ, попробуйте ещё раз');
  }
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

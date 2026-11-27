// ИИ-репетитор: три режима.
//  • cloud  — сервер Oqy (часть B, /api/hint, Claude) — нужен интернет;
//  • local  — локальная модель школы через Ollama (компьютер учителя в школьной сети Wi-Fi), интернет не нужен;
//  • off    — только готовые подсказки из базы.
// Защита: если ответ модели содержит правильный вариант, подсказка не показывается (как server/leak.ts у части B).

export type AiMode = 'off' | 'cloud' | 'local';
export interface AiSettings {
  mode: AiMode;
  ollamaUrl: string;
  model: string;
}

const KEY = 'oqy-ai';
export const DEFAULT_AI: AiSettings = { mode: 'cloud', ollamaUrl: 'http://192.168.1.10:11434', model: 'qwen2.5:3b' };

export function getAi(): AiSettings {
  try {
    return { ...DEFAULT_AI, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AiSettings>) };
  } catch {
    return DEFAULT_AI;
  }
}

export function setAi(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* без сохранения */
  }
}

const SYSTEM =
  'Ты — репетитор по функциональной грамотности для ученика 7–9 класса. Ученик ошибся. ' +
  'НИКОГДА не называй правильный ответ и не перечисляй варианты. Задай ОДИН короткий наводящий вопрос (до 25 слов), ' +
  'который укажет, где в тексте искать или что пересчитать. Пиши по-русски, просто и доброжелательно.';

function leaks(text: string, answer: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const a = norm(answer);
  return a.length >= 3 && norm(text).includes(a);
}

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export interface TutorRequest {
  taskId: string;
  context: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  hintLevel: number;
}

/** Наводящий вопрос от ИИ или null (тогда показываем готовую подсказку). */
export async function askTutor(r: TutorRequest): Promise<{ text: string; source: string } | null> {
  const s = getAi();
  if (s.mode === 'off' || (typeof navigator !== 'undefined' && !navigator.onLine && s.mode === 'cloud')) return null;
  try {
    if (s.mode === 'local') {
      const res = await withTimeout(
        (signal) =>
          fetch(`${s.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
            method: 'POST',
            signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              model: s.model,
              stream: false,
              options: { temperature: 0.3 },
              messages: [
                { role: 'system', content: SYSTEM },
                { role: 'user', content: `Текст: ${r.context}\nВопрос: ${r.question}\nОтвет ученика: ${r.studentAnswer}` },
              ],
            }),
          }),
        25000,
      );
      if (!res.ok) return null;
      const j = (await res.json()) as { message?: { content?: string } };
      const text = j.message?.content?.trim();
      if (!text || leaks(text, r.correctAnswer)) return null;
      return { text, source: `локальная модель ${s.model}` };
    }
    const res = await withTimeout(
      (signal) =>
        fetch('/api/hint', {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: r.taskId, answer: r.studentAnswer, hintLevel: r.hintLevel }),
        }),
      15000,
    );
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    const j = (await res.json()) as { hint?: string };
    if (!j.hint || leaks(j.hint, r.correctAnswer)) return null;
    return { text: j.hint, source: 'ИИ Oqy' };
  } catch {
    return null;
  }
}

/** ИИ-ответчик через Ollama школы (компьютер учителя в Wi-Fi класса). null — сервер Ollama недоступен. */
export async function askOllama(messages: { role: 'user' | 'assistant'; content: string }[], system: string): Promise<string | null> {
  const s = getAi();
  if (s.mode !== 'local') return null;
  try {
    const res = await withTimeout(
      (signal) =>
        fetch(`${s.ollamaUrl.replace(/\/$/, '')}/api/chat`, {
          method: 'POST',
          signal,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: s.model, stream: false, options: { temperature: 0.4, num_predict: 260 }, messages: [{ role: 'system', content: system }, ...messages.slice(-6)] }),
        }),
      30000,
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { message?: { content?: string } };
    return j.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

/** Проверка связи с локальной моделью для экрана настроек. */
export async function pingOllama(url: string): Promise<string[] | null> {
  try {
    const res = await withTimeout((signal) => fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal }), 5000);
    if (!res.ok) return null;
    const j = (await res.json()) as { models?: { name: string }[] };
    return (j.models ?? []).map((m) => m.name);
  } catch {
    return null;
  }
}

// Вызовы API части B из приложения ученика. Любая ошибка — повод для офлайн-замены, а не для падения.
import type { Attempt, Student, Task } from '@shared/types';
import { ApiUnavailable, call } from '../teacher/api';
import type { Score } from '../lib/grade';

const post = <T>(path: string, body: unknown, timeoutMs: number) => call<T>(path, { method: 'POST', body: JSON.stringify(body), timeoutMs });
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Подсказка: ИИ онлайн, иначе статическая. hintLevel 0…2. */
export async function getHint(task: Task, answer: string, hintLevel: 0 | 1 | 2): Promise<string> {
  try {
    const r = await post<{ hint?: string }>('/api/hint', { taskId: task.id, answer, hintLevel }, 6000);
    return text(r.hint) || task.hints[hintLevel];
  } catch {
    return task.hints[hintLevel];
  }
}

export async function gradeFree(taskId: string, answer: string): Promise<{ score: Score; feedback: string }> {
  const r = await post<{ score?: number; feedback?: string }>('/api/grade', { taskId, answer }, 15000);
  if (r.score !== 0 && r.score !== 0.5 && r.score !== 1) throw new ApiUnavailable('Неверный ответ сервера');
  return { score: r.score, feedback: text(r.feedback) };
}

export async function checkWhy(taskId: string, reason: string): Promise<{ ok: boolean; feedback: string }> {
  const r = await post<{ ok?: boolean; feedback?: string }>('/api/why', { taskId, reason }, 10000);
  return { ok: r.ok === true, feedback: text(r.feedback) };
}

export const syncAttempts = (student: Student, attempts: Attempt[]) => post<unknown>('/api/sync', { student, attempts }, 15000);

export const fetchPack = () => call<unknown>('/api/pack?v=1');

// Клиент API части B (PLAN.md, раздел 6). Всё работает и без него: ошибки превращаются в ApiUnavailable.
import type { Attempt, Task } from '@shared/types';

export class ApiUnavailable extends Error {}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new ApiUnavailable('Нет интернета');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15000);
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (!res.ok || !isJson) {
      const msg = isJson ? ((await res.json()) as { error?: string }).error : undefined;
      throw new ApiUnavailable(msg ?? (res.status === 404 ? 'Сервер ещё не подключён' : `Ошибка сервера (${res.status})`));
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiUnavailable) throw e;
    throw new ApiUnavailable(ctrl.signal.aborted ? 'Сервер не ответил вовремя' : 'Сервер недоступен');
  } finally {
    clearTimeout(timer);
  }
}

export function createClassOnServer(name: string) {
  return call<{ classCode: string; teacherKey: string }>('/api/class', { method: 'POST', body: JSON.stringify({ name }) });
}

export interface ServerClassData {
  attempts?: (Attempt & { number: number; via?: 'online' | 'qr' | 'bot' })[];
}

export function fetchClassFromServer(code: string, teacherKey: string) {
  return call<ServerClassData>(`/api/class/${encodeURIComponent(code)}`, { headers: { 'x-teacher-key': teacherKey } });
}

export function photoToTasks(imageBase64: string, grade: number, lang: 'ru' | 'kk') {
  return call<Task[] | { tasks: Task[] }>('/api/photo-tasks', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, grade, lang }),
    timeoutMs: 70000,
  }).then((r) => (Array.isArray(r) ? r : r.tasks));
}

/** Сжать фото перед отправкой: длинная сторона до 1600px, JPEG. Экономит трафик на слабой сети. */
export async function imageFileToBase64(file: File, maxSide = 1600): Promise<{ base64: string; dataUrl: string; kb: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  const base64 = dataUrl.split(',')[1];
  return { base64, dataUrl, kb: Math.round((base64.length * 3) / 4 / 1024) };
}

/** Отдать проверенные учителем задания классу (часть B: POST /api/tasks). Ученики получат их через /api/pack?class=. */
export function publishTasks(classCode: string, teacherKey: string, tasks: Task[]) {
  return call<{ saved: number }>('/api/tasks', {
    method: 'POST',
    headers: { 'x-teacher-key': teacherKey },
    body: JSON.stringify({ classCode, tasks }),
  });
}

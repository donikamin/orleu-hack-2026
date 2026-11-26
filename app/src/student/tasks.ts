// Задания ученика: пакет из сборки (есть всегда) + новые задания с сервера, сохранённые в dexie.
import type { Task } from '@shared/types';
import { PACK } from '../teacher/pack';
import { db } from '../lib/db';
import { fetchPack } from './api';

const isInts = (v: unknown, max: number) => Array.isArray(v) && v.length > 0 && v.every((i) => Number.isInteger(i) && i >= 0 && i < max);
const isStrs = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** Битое задание с сервера не должно попасть в базу и сломать плеер офлайн. */
export function isTask(v: unknown): v is Task {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Partial<Task>;
  if (typeof t.id !== 'string' || typeof t.title !== 'string' || typeof t.question !== 'string' || typeof t.explanation !== 'string') return false;
  if (!['locate', 'understand', 'evaluate'].includes(t.skill!) || ![1, 2, 3].includes(t.difficulty!) || !['ru', 'kk'].includes(t.lang!)) return false;
  if (!Array.isArray(t.docs) || !t.docs.every((d) => typeof d?.title === 'string' && typeof d?.body === 'string')) return false;
  if (!isStrs(t.hints) || t.hints.length !== 3) return false;
  const a = t.answer;
  switch (a?.type) {
    case 'choice': return isStrs(a.options) && Number.isInteger(a.correct) && a.correct >= 0 && a.correct < a.options.length;
    case 'multi': return isStrs(a.options) && isInts(a.correct, a.options.length);
    case 'spans': return isStrs(a.sentences) && isInts(a.correct, a.sentences.length);
    case 'free': return isStrs(a.rubric);
    default: return false;
  }
}

export async function loadTasks(): Promise<Task[]> {
  const bundled = new Set(PACK.map((t) => t.id));
  const extra = await db.pack.toArray();
  return [...PACK, ...extra.filter((t) => !bundled.has(t.id))];
}

export async function refreshPack(classCode?: string): Promise<void> {
  try {
    const data = await fetchPack(classCode);
    if (Array.isArray(data)) await db.pack.bulkPut(data.filter(isTask));
  } catch {
    // нет сети или сервера: работаем на том, что есть
  }
}

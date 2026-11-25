import fs from 'node:fs';
import path from 'node:path';
import type { Task } from '../shared/types';

export const readContent = (file: string) => fs.readFileSync(path.join(process.cwd(), 'content', file), 'utf8');

let cache: Task[] | undefined;
export const pack = (): Task[] => (cache ??= JSON.parse(readContent('pack-v1.json')) as Task[]);

const isStrs = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim() !== '');
const isIdx = (v: unknown, n: number) =>
  Array.isArray(v) && v.length > 0 && new Set(v).size === v.length && v.every((i) => Number.isInteger(i) && i >= 0 && i < n);

export function isTask(v: unknown): v is Task {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Partial<Task>;
  if (![t.title, t.question, t.explanation].every((s) => typeof s === 'string' && s.trim())) return false;
  if (typeof t.id !== 'string' || !/^[\w-]{1,64}$/.test(t.id)) return false;
  if (!['classic', 'investigation', 'fake', 'family', 'ask'].includes(t.format!)) return false;
  if (!['locate', 'understand', 'evaluate'].includes(t.skill!) || ![1, 2, 3].includes(t.difficulty!) || !['ru', 'kk'].includes(t.lang!)) return false;
  if (!Array.isArray(t.docs) || !t.docs.length || !t.docs.every((d) => typeof d?.title === 'string' && typeof d?.body === 'string')) return false;
  if (!isStrs(t.hints) || t.hints.length !== 3) return false;
  const a = t.answer;
  switch (a?.type) {
    case 'choice':
      return isStrs(a.options) && a.options.length >= 2 && new Set(a.options).size === a.options.length && Number.isInteger(a.correct) && a.correct >= 0 && a.correct < a.options.length;
    case 'multi':
      return isStrs(a.options) && isIdx(a.correct, a.options.length);
    case 'spans':
      return isStrs(a.sentences) && isIdx(a.correct, a.sentences.length);
    case 'free':
      return isStrs(a.rubric) && a.rubric.length > 0;
    default:
      return false;
  }
}

import type { Attempt } from '../shared/types';
import { body, classCodeOf, handle, HttpError, json, limit, studentNumber } from '../server/http';
import { record } from '../server/store';

function attempt(v: unknown): Attempt {
  const a = (v ?? {}) as Partial<Attempt>;
  const ok =
    typeof a.taskId === 'string' &&
    /^[\w-]{1,64}$/.test(a.taskId) &&
    [0, 0.5, 1].includes(a.score!) &&
    [0, 1, 2, 3].includes(a.hintsUsed!) &&
    (a.confidence == null || [1, 2, 3].includes(a.confidence)) &&
    (a.answer == null || typeof a.answer === 'string') &&
    Number.isInteger(a.ts) &&
    a.ts! > 1_500_000_000 &&
    a.ts! < Date.now() / 1000 + 86400;
  if (!ok) throw new HttpError(400, 'Неверная попытка');
  return {
    taskId: a.taskId!,
    score: a.score!,
    hintsUsed: a.hintsUsed!,
    ...(a.confidence ? { confidence: a.confidence } : {}),
    ...(a.answer ? { answer: a.answer.slice(0, 1500) } : {}),
    ts: a.ts!,
  };
}

export const POST = handle(async (req) => {
  limit(req, 'sync', 120); // весь класс может сидеть за одним школьным IP
  const b = await body(req, 500_000);
  const s = (b.student ?? {}) as Record<string, unknown>;
  const student = { classCode: classCodeOf(s.classCode), number: studentNumber(s.number) };
  if (!Array.isArray(b.attempts) || b.attempts.length > 500) throw new HttpError(400, 'Неверный список попыток');
  const { skills } = await record(student, b.attempts.map(attempt), 'online');
  return json({ skills });
});

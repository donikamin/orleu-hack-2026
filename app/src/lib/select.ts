// Диагностика и выбор следующего задания.
import { DIFFICULTY_RATING } from '@shared/elo';
import { SKILLS, type Attempt, type Lang, type SkillState, type Task } from '@shared/types';

/** 9 заданий: по 3 на навык, по возможности сложности 1, 2, 3. Навыки чередуются, сложность растёт. */
export function pickDiagnostic(tasks: Task[], lang: Lang): string[] {
  const rounds: string[][] = [[], [], []];
  for (const skill of SKILLS) {
    const pool = tasks.filter((t) => t.lang === lang && t.skill === skill && t.answer.type !== 'free');
    const picked: Task[] = [];
    for (const d of [1, 2, 3]) {
      const t = pool.find((x) => x.difficulty === d);
      if (t) picked.push(t);
    }
    for (const t of pool) if (picked.length < 3 && !picked.includes(t)) picked.push(t);
    picked.sort((a, b) => a.difficulty - b.difficulty).forEach((t, i) => rounds[i].push(t.id));
  }
  return rounds.flat();
}

/** Самый слабый навык → сначала нерешённые → сложность ближе к рейтингу → давно не решали. */
export function nextTask(tasks: Task[], attempts: Attempt[], skills: SkillState[], lastId?: string): Task | undefined {
  const pool = tasks.length > 1 ? tasks.filter((t) => t.id !== lastId) : tasks;
  const weakest = [...skills].sort((a, b) => a.rating - b.rating).find((s) => pool.some((t) => t.skill === s.skill));
  if (!weakest) return pool[0];
  const stats = new Map<string, { n: number; last: number }>();
  for (const a of attempts) {
    const s = stats.get(a.taskId) ?? { n: 0, last: 0 };
    stats.set(a.taskId, { n: s.n + 1, last: Math.max(s.last, a.ts) });
  }
  const n = (t: Task) => stats.get(t.id)?.n ?? 0;
  const last = (t: Task) => stats.get(t.id)?.last ?? 0;
  const gap = (t: Task) => Math.abs(DIFFICULTY_RATING[t.difficulty] - weakest.rating);
  return pool.filter((t) => t.skill === weakest.skill).sort((a, b) => n(a) - n(b) || gap(a) - gap(b) || last(a) - last(b))[0];
}

/** Какие задания списка ещё не решены с момента since. */
export function remaining(ids: string[], attempts: Attempt[], since = 0): string[] {
  const done = new Set(attempts.filter((a) => a.ts >= since).map((a) => a.taskId));
  return ids.filter((id) => !done.has(id));
}

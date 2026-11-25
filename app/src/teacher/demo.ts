// Демо-класс для жюри и для проверки без учеников. Данные выдуманные и помечены как демо.
import type { Attempt, Skill } from '@shared/types';
import { db, saveAttempts } from './db';
import { PACK } from './pack';

export const DEMO_CODE = 'DEMO';

/** Детерминированный генератор, чтобы демо выглядело одинаково у всех. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Сила ученика по навыкам (0…1): разные профили, чтобы на карте было что увидеть.
const PROFILES: Record<Skill, number>[] = [
  { locate: 0.9, understand: 0.4, evaluate: 0.3 },
  { locate: 0.8, understand: 0.8, evaluate: 0.7 },
  { locate: 0.5, understand: 0.3, evaluate: 0.2 },
  { locate: 0.95, understand: 0.9, evaluate: 0.85 },
  { locate: 0.7, understand: 0.5, evaluate: 0.6 },
  { locate: 0.6, understand: 0.6, evaluate: 0.25 },
  { locate: 0.4, understand: 0.35, evaluate: 0.3 },
  { locate: 0.85, understand: 0.45, evaluate: 0.5 },
  { locate: 0.75, understand: 0.7, evaluate: 0.35 },
  { locate: 0.9, understand: 0.6, evaluate: 0.8 },
  { locate: 0.55, understand: 0.25, evaluate: 0.45 },
  { locate: 0.65, understand: 0.55, evaluate: 0.55 },
];

export function demoAttemptsFor(number: number, seed = number * 97): Attempt[] {
  const rand = rng(seed);
  const p = PROFILES[(number - 1) % PROFILES.length];
  const now = Math.floor(Date.now() / 1000);
  const out: Attempt[] = [];
  const rounds = 5 + Math.floor(rand() * 3); // ~5–7 недель занятий: хватает данных, чтобы профили различались
  for (let r = 0; r < rounds; r++) {
    PACK.forEach((t, i) => {
      if (rand() < 0.25) return;
      const chance = p[t.skill] - (t.difficulty - 2) * 0.12;
      const hintsUsed = (rand() < 0.5 ? 0 : Math.min(3, Math.floor(rand() * 4))) as 0 | 1 | 2 | 3;
      const ok = rand() < chance + hintsUsed * 0.08;
      const score = (ok ? 1 : rand() < 0.2 ? 0.5 : 0) as 0 | 0.5 | 1;
      // часть учеников уверенно ошибается на «Оценить» — ложные представления
      const confidence = (!ok && p.evaluate < 0.4 && t.skill === 'evaluate' ? 3 : ok ? (rand() < 0.6 ? 3 : 2) : rand() < 0.3 ? 3 : 1) as 1 | 2 | 3;
      out.push({ taskId: t.id, score, hintsUsed, confidence, ts: now - (rounds - r) * 2 * 86400 - (PACK.length - i) * 300 - number * 7 });
    });
  }
  return out;
}

export async function seedDemoClass(): Promise<string> {
  await db.transaction('rw', db.classes, db.attempts, async () => {
    await db.classes.put({ code: DEMO_CODE, name: 'Демо: 8 «Б», чтение', grade: 8, size: 14, teacherKey: 'DEMO-KEY', createdAt: Date.now(), synced: false });
    await db.attempts.where('classCode').equals(DEMO_CODE).delete();
  });
  for (let n = 1; n <= 12; n++) await saveAttempts(DEMO_CODE, n, demoAttemptsFor(n), 'qr');
  return DEMO_CODE;
}

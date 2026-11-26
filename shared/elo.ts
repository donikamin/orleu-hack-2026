// Модель навыков из PLAN.md, раздел 6. Одинаковая в приложении ученика, у учителя и на сервере.
import type { Attempt, Skill, SkillState } from './types';
import { SKILLS } from './types';

export const START_RATING = 1200;
export const K = 32;
export const DIFFICULTY_RATING: Record<1 | 2 | 3, number> = { 1: 1100, 2: 1250, 3: 1400 };
/** Границы уровней 1…5. */
export const LEVEL_BOUNDS = [1050, 1150, 1250, 1350] as const;

export function expected(rating: number, difficulty: 1 | 2 | 3): number {
  return 1 / (1 + 10 ** ((DIFFICULTY_RATING[difficulty] - rating) / 400));
}

/** S = score × (1 − 0.2 × hintsUsed) */
export function effectiveScore(score: number, hintsUsed: number): number {
  return Math.max(0, score * (1 - 0.2 * hintsUsed));
}

export function updateRating(rating: number, difficulty: 1 | 2 | 3, score: number, hintsUsed: number): number {
  return rating + K * (effectiveScore(score, hintsUsed) - expected(rating, difficulty));
}

export function level(rating: number): 1 | 2 | 3 | 4 | 5 {
  let l = 1;
  for (const b of LEVEL_BOUNDS) if (rating >= b) l++;
  return l as 1 | 2 | 3 | 4 | 5;
}

export interface TaskMeta {
  skill: Skill;
  difficulty: 1 | 2 | 3;
}

/** Пересчитать навыки по списку попыток (в порядке времени). Неизвестные задания пропускаются. */
export function computeSkills(attempts: Attempt[], taskMeta: (taskId: string) => TaskMeta | undefined): SkillState[] {
  const state = new Map<Skill, SkillState>(SKILLS.map((s) => [s, { skill: s, rating: START_RATING, attempts: 0 }]));
  for (const a of [...attempts].sort((x, y) => x.ts - y.ts)) {
    const meta = taskMeta(a.taskId);
    if (!meta) continue;
    const st = state.get(meta.skill)!;
    st.rating = updateRating(st.rating, meta.difficulty, a.score, a.hintsUsed);
    st.attempts++;
  }
  return SKILLS.map((s) => state.get(s)!);
}

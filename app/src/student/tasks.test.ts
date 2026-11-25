import { expect, it } from 'vitest';
import { PACK } from '../teacher/pack';
import { isTask } from './tasks';

it('весь пакет проходит проверку, битые задания — нет', () => {
  expect(PACK.every(isTask)).toBe(true);
  const t = PACK[0];
  for (const bad of [null, {}, { ...t, hints: ['a'] }, { ...t, answer: { type: 'choice', options: ['a'], correct: 3 } }, { ...t, difficulty: 7 }, { ...t, docs: undefined }]) expect(isTask(bad)).toBe(false);
});

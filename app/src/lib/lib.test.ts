import { describe, expect, it } from 'vitest';
import type { Attempt, Task } from '@shared/types';
import { updateRating } from '@shared/elo';
import { decodeResults, MAX_QR_BYTES, rowToAttempt } from '@shared/qr-protocol';
import { resolveTaskRef, PACK } from '../teacher/pack';
import { gradeOffline, rubricScore } from './grade';
import { nextTask, pickDiagnostic, remaining } from './select';
import { attemptsToQr } from './qr';
import { uniqueMinuteTs } from './time';

const mk = (id: string, skill: Task['skill'], difficulty: 1 | 2 | 3, answer: Task['answer'] = { type: 'choice', options: ['a', 'b'], correct: 0 }): Task => ({
  id, skill, difficulty, answer, format: 'classic', lang: 'ru', title: id, docs: [], question: '', hints: ['', '', ''], explanation: '',
});
const at = (taskId: string, ts = 60): Attempt => ({ taskId, score: 1, hintsUsed: 0, ts });

// elo.ts общий (shared/), здесь контрольные числа по формуле из плана
describe('Elo: 3 случая по формуле', () => {
  it('верно без подсказок, равный рейтинг: +16', () => expect(updateRating(1250, 2, 1, 0)).toBeCloseTo(1266));
  it('ошибка, равный рейтинг: −16', () => expect(updateRating(1250, 2, 0, 0)).toBeCloseTo(1234));
  it('верно с 2 подсказками: S=0.6, +3.2', () => expect(updateRating(1250, 2, 1, 2)).toBeCloseTo(1253.2));
});

describe('проверка офлайн', () => {
  it('choice', () => {
    const t = mk('a', 'locate', 1);
    expect(gradeOffline(t, [0])).toBe(1);
    expect(gradeOffline(t, [1])).toBe(0);
    expect(gradeOffline(t, [])).toBe(0);
  });
  it('spans/multi: точно, частично, «отметил всё»', () => {
    const t = mk('a', 'evaluate', 1, { type: 'spans', sentences: ['1', '2', '3', '4'], correct: [0, 2] });
    expect(gradeOffline(t, [2, 0])).toBe(1);
    expect(gradeOffline(t, [0])).toBe(0.5);
    expect(gradeOffline(t, [0, 1, 2])).toBe(0.5);
    expect(gradeOffline(t, [0, 1, 2, 3])).toBe(0);
    expect(gradeOffline(t, [1])).toBe(0);
  });
  it('самопроверка по рубрике', () => {
    expect([rubricScore(3, 3), rubricScore(2, 3), rubricScore(1, 3), rubricScore(0, 0)]).toEqual([1, 0.5, 0, 0]);
  });
});

describe('выбор заданий', () => {
  it('диагностика: 9 заданий, 3 на навык, все сложности', () => {
    const ids = pickDiagnostic(PACK, 'ru');
    expect(ids).toHaveLength(9);
    for (const s of ['locate', 'understand', 'evaluate']) {
      const ts = PACK.filter((t) => ids.includes(t.id) && t.skill === s);
      expect(ts.map((t) => t.difficulty).sort()).toEqual([1, 2, 3]);
    }
  });
  it('диагностика не берёт свободные ответы и добирает при нехватке сложности', () => {
    const tasks = [1, 2, 3, 4].map((i) => mk(`l${i}`, 'locate', 1)).concat(mk('free', 'locate', 2, { type: 'free', rubric: [] }));
    expect(pickDiagnostic(tasks, 'ru')).toEqual(['l1', 'l2', 'l3']);
  });
  it('следующее: слабый навык, близкая сложность, сначала нерешённые', () => {
    const tasks = [mk('l1', 'locate', 1), mk('u1', 'understand', 1), mk('u2', 'understand', 2), mk('u3', 'understand', 3)];
    const skills = [{ skill: 'locate' as const, rating: 1300, attempts: 1 }, { skill: 'understand' as const, rating: 1240, attempts: 1 }];
    expect(nextTask(tasks, [], skills)!.id).toBe('u2');
    expect(nextTask(tasks, [at('u2')], skills)!.id).toBe('u1');
    expect(nextTask(tasks, [], skills, 'u2')!.id).toBe('u1');
    expect(nextTask([], [], skills)).toBeUndefined();
    expect(nextTask([tasks[0]], [], skills, 'l1')!.id).toBe('l1');
  });
  it('остаток списка с момента выдачи', () => {
    expect(remaining(['a', 'b'], [at('a', 100)], 50)).toEqual(['b']);
    expect(remaining(['a', 'b'], [at('a', 10)], 50)).toEqual(['a', 'b']);
  });
});

describe('QR', () => {
  it('сканер учителя восстанавливает все попытки', () => {
    const list: Attempt[] = Array.from({ length: 200 }, (_, i) => ({
      taskId: i % 10 === 9 ? 'photo-abc' : PACK[i % 9].id, score: ([0, 0.5, 1] as const)[i % 3], hintsUsed: (i % 4) as 0, confidence: 3, ts: 1_800_000_000 + i * 60,
    }));
    const parts = attemptsToQr({ classCode: 'DEMO', number: 5 }, list);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(MAX_QR_BYTES);
    const back = parts.flatMap((p) => decodeResults(p).rows).map((r) => rowToAttempt(r, resolveTaskRef));
    expect(back).toEqual(list);
  });
  it('повтор задания в ту же минуту не теряется при округлении', () => {
    expect(uniqueMinuteTs(125, undefined)).toBe(125);
    expect(uniqueMinuteTs(125, 121)).toBe(180);
    expect(uniqueMinuteTs(200, 121)).toBe(200);
  });
});

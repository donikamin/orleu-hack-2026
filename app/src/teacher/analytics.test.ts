import { describe, expect, it } from 'vitest';
import { confidentWrong, summarizeClass, tomorrowGroups } from './analytics';
import { makeTaskLookup, PACK, resolveTaskRef } from './pack';
import type { AttemptRow } from './db';

const lookup = makeTaskLookup();
const row = (number: number, taskId: string, score: 0 | 0.5 | 1, confidence?: 1 | 2 | 3, ts = 1): AttemptRow => ({
  key: `X|${number}|${taskId}|${ts}`,
  classCode: 'X',
  number,
  taskId,
  score,
  hintsUsed: 0,
  confidence,
  ts,
  via: 'qr',
  importedAt: 0,
});

describe('pack', () => {
  it('45 заданий по-русски (15 на навык) и 9 по-казахски, все с 3 подсказками', () => {
    expect(PACK).toHaveLength(54);
    for (const s of ['locate', 'understand', 'evaluate']) expect(PACK.filter((t) => t.skill === s && t.lang === 'ru')).toHaveLength(15);
    for (const t of PACK) expect(t.hints).toHaveLength(3);
  });
  it('taskRef: число → id из пакета, строка → как есть', () => {
    expect(resolveTaskRef(0)).toBe(PACK[0].id);
    expect(resolveTaskRef('photo-1')).toBe('photo-1');
    expect(resolveTaskRef(999)).toBeUndefined();
  });
});

describe('analytics', () => {
  const attempts = [
    row(1, 'c-eva-01', 0, 3, 1),
    row(2, 'c-eva-01', 0, 3, 2),
    row(2, 'c-loc-01', 1, 3, 3),
    row(3, 'c-und-01', 0, 1, 4),
  ];

  it('уверенно ошибаются: только confidence 3 и score 0', () => {
    const r = confidentWrong(attempts, lookup);
    expect(r).toHaveLength(1);
    expect(r[0].taskId).toBe('c-eva-01');
    expect(r[0].students).toEqual([1, 2]);
  });

  it('карта класса показывает всех учеников 1…size, даже без данных', () => {
    const s = summarizeClass(5, attempts, lookup);
    expect(s.map((x) => x.number)).toEqual([1, 2, 3, 4, 5]);
    expect(s[3].attempts).toBe(0);
    expect(s[1].confidentWrong).toBe(1);
  });

  it('группы на завтра: ученик в группе своего слабого навыка', () => {
    const s = summarizeClass(3, attempts, lookup);
    const g = tomorrowGroups(s, attempts, lookup);
    const evaluate = g.find((x) => x.skill === 'evaluate');
    expect(evaluate?.students).toContain(1);
    expect(evaluate?.tasks.length).toBeGreaterThan(0);
  });
});

import { taskStats, toCsv, weeklyTrend } from './analytics';

describe('новая аналитика', () => {
  const week = 7 * 86400;
  const base = 1_800_000_000;
  const list = [
    row(1, 'c-eva-01', 0, 3, base),
    row(2, 'c-eva-01', 0, 3, base + 10),
    row(3, 'c-eva-01', 1, 2, base + 20),
    row(1, 'c-loc-01', 1, 3, base + week),
    row(2, 'c-loc-01', 1, 2, base + week + 5),
  ];

  it('разбор заданий: уверенные ошибки помечаются как ложное представление и идут первыми', () => {
    const s = taskStats(list, lookup);
    expect(s[0].taskId).toBe('c-eva-01');
    expect(s[0].verdict).toBe('guess');
    expect(s[0].correctRate).toBeCloseTo(1 / 3);
    expect(s.find((x) => x.taskId === 'c-loc-01')!.verdict).toBe('easy');
  });

  it('динамика: точки по неделям, пустой навык — null', () => {
    const p = weeklyTrend(list, lookup);
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p[0].values.evaluate).toBeCloseTo(1 / 3);
    expect(p[p.length - 1].values.locate).toBe(1);
    expect(p[0].values.understand).toBeNull();
  });

  it('CSV для русского Excel: BOM, «;», экранирование', () => {
    const csv = toCsv([['a;b', 'he said "hi"'], [1, 2]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"a;b";"he said ""hi"""');
    expect(csv).toContain('\r\n1;2');
  });
});

import { describe, expect, it } from 'vitest';
import { computeSkills, expected, level, updateRating, START_RATING } from './elo';
import {
  attemptToRow,
  crc32,
  decodeAssignment,
  decodeResults,
  encodeAssignment,
  encodeResults,
  MAX_QR_BYTES,
  QrDecodeError,
  rowToAttempt,
  type Row,
} from './qr-protocol';

describe('elo', () => {
  it('ожидание 0.5 при равных рейтингах', () => {
    expect(expected(1250, 2)).toBeCloseTo(0.5);
  });
  it('верный ответ без подсказок повышает рейтинг, с 3 подсказками почти не повышает', () => {
    const clean = updateRating(START_RATING, 2, 1, 0);
    const hinted = updateRating(START_RATING, 2, 1, 3);
    expect(clean).toBeGreaterThan(START_RATING);
    expect(hinted).toBeLessThan(clean);
  });
  it('ошибка понижает рейтинг', () => {
    expect(updateRating(START_RATING, 1, 0, 0)).toBeLessThan(START_RATING);
  });
  it('уровни по границам 1050/1150/1250/1350', () => {
    expect(level(1000)).toBe(1);
    expect(level(1100)).toBe(2);
    expect(level(1200)).toBe(3);
    expect(level(1300)).toBe(4);
    expect(level(1400)).toBe(5);
  });
  it('computeSkills считает только известные задания', () => {
    const s = computeSkills(
      [
        { taskId: 'a', score: 1, hintsUsed: 0, ts: 1 },
        { taskId: 'zzz', score: 1, hintsUsed: 0, ts: 2 },
      ],
      (id) => (id === 'a' ? { skill: 'locate', difficulty: 1 } : undefined),
    );
    expect(s.find((x) => x.skill === 'locate')!.attempts).toBe(1);
    expect(s.find((x) => x.skill === 'evaluate')!.attempts).toBe(0);
  });
});

describe('qr-protocol', () => {
  const rows: Row[] = Array.from({ length: 150 }, (_, i) => [i % 45, (i % 3) as 0 | 1 | 2, (i % 4) as 0 | 1 | 2 | 3, ((i % 3) + 1) as 1 | 2 | 3, 29000000 + i]);

  it('crc32 совпадает с эталоном', () => {
    expect(crc32('123456789')).toBe(0xcbf43926);
  });

  it('разбивает на части не длиннее лимита и собирает обратно', () => {
    const parts = encodeResults('7A-2026', 12, rows);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(MAX_QR_BYTES);
    const decoded = parts.map(decodeResults);
    expect(decoded.every((d) => d.classCode === '7A-2026' && d.number === 12 && d.total === parts.length)).toBe(true);
    expect(decoded.flatMap((d) => d.rows)).toEqual(rows);
  });

  it('пустой список даёт одну часть', () => {
    const parts = encodeResults('X1', 1, []);
    expect(parts).toHaveLength(1);
    expect(decodeResults(parts[0]).rows).toEqual([]);
  });

  it('поломанный код отвергается', () => {
    const [p] = encodeResults('X1', 3, rows.slice(0, 5));
    const broken = p.slice(0, -4) + (p.endsWith('A') ? 'BBBB' : 'AAAA');
    expect(() => decodeResults(broken)).toThrow(QrDecodeError);
    expect(() => decodeResults('hello')).toThrow(QrDecodeError);
  });

  it('attempt ↔ row', () => {
    const a = { taskId: 'c-loc-01', score: 0.5 as const, hintsUsed: 2 as const, confidence: 3 as const, ts: 1_800_000_000 };
    const row = attemptToRow(a, 0);
    expect(rowToAttempt(row, (r) => (r === 0 ? 'c-loc-01' : undefined))).toEqual({ ...a, ts: Math.floor(a.ts / 60) * 60 });
  });

  it('задание учителя', () => {
    const s = encodeAssignment('7A', ['c-loc-01', 'photo-x']);
    expect(decodeAssignment(s)).toEqual({ classCode: '7A', taskIds: ['c-loc-01', 'photo-x'] });
  });
});

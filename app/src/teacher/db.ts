// Локальная база учителя (IndexedDB). Работает без интернета; сервер — дополнительный источник.
import Dexie, { type EntityTable } from 'dexie';
import type { Attempt, Task } from '@shared/types';

export interface ClassRow {
  code: string;
  name: string;
  grade: 7 | 8 | 9;
  size: number; // сколько учеников (номера 1…size)
  teacherKey: string;
  createdAt: number;
  synced: boolean; // создан ли класс на сервере
}

export type AttemptSource = 'qr' | 'online' | 'bot' | 'manual';

export interface AttemptRow extends Attempt {
  key: string; // classCode|number|taskId|ts — защита от дублей при повторном скане
  classCode: string;
  number: number;
  via: AttemptSource;
  importedAt: number;
}

export interface ClassTask extends Task {
  classCode: string;
  createdAt: number;
}

export const db = new Dexie('oqy-teacher') as Dexie & {
  classes: EntityTable<ClassRow, 'code'>;
  attempts: EntityTable<AttemptRow, 'key'>;
  tasks: EntityTable<ClassTask, 'id'>;
};

db.version(1).stores({
  classes: 'code, createdAt',
  attempts: 'key, classCode, [classCode+number], ts',
  tasks: 'id, classCode, createdAt',
});

export function attemptKey(classCode: string, number: number, a: Pick<Attempt, 'taskId' | 'ts'>) {
  return `${classCode}|${number}|${a.taskId}|${a.ts}`;
}

/** Сохранить попытки. Возвращает, сколько новых (без дублей). */
export async function saveAttempts(classCode: string, number: number, attempts: Attempt[], via: AttemptSource): Promise<number> {
  const rows: AttemptRow[] = attempts.map((a) => ({
    ...a,
    key: attemptKey(classCode, number, a),
    classCode,
    number,
    via,
    importedAt: Date.now(),
  }));
  const existing = await db.attempts.bulkGet(rows.map((r) => r.key));
  const fresh = rows.filter((_, i) => !existing[i]);
  if (fresh.length) await db.attempts.bulkAdd(fresh);
  return fresh.length;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов O/0, I/1

export function randomToken(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function makeClassCode(grade: number) {
  return `${grade}${randomToken(4)}`;
}

// Локальная база ученика (IndexedDB). Имён нет: только код класса и номер.
import Dexie, { type EntityTable, type Table } from 'dexie';
import { START_RATING, updateRating } from '@shared/elo';
import { SKILLS, type Attempt, type Lang, type SkillState, type Student, type Task } from '@shared/types';
import { uniqueMinuteTs } from './time';

export interface StudentRow extends Student {
  key: string; // classCode|number: на одном телефоне могут заниматься несколько учеников
  lang: Lang;
  diagIds: string[];
  assigned?: { ids: string[]; at: number };
}

export interface StudentAttempt extends Attempt {
  id: number;
  student: string;
  synced: 0 | 1; // отправлено на сервер
  exported: 0 | 1; // отдано учителю по QR
}

export interface SkillRow extends SkillState {
  student: string;
}

export const db = new Dexie('oqy-student') as Dexie & {
  students: EntityTable<StudentRow, 'key'>;
  attempts: EntityTable<StudentAttempt, 'id'>;
  skills: Table<SkillRow, [string, string]>;
  pack: EntityTable<Task, 'id'>;
  meta: EntityTable<{ key: string; value: string }, 'key'>;
};

db.version(1).stores({
  students: 'key',
  attempts: '++id, student, [student+synced], [student+taskId]',
  skills: '[student+skill], student',
  pack: 'id',
  meta: 'key',
});

export const studentKey = (s: Student) => `${s.classCode}|${s.number}`;

export async function login(s: Student, lang: Lang): Promise<void> {
  const key = studentKey(s);
  await db.transaction('rw', db.students, db.meta, async () => {
    const old = await db.students.get(key);
    // новый язык — диагностика начинается заново на этом языке, прогресс не теряется
    if (!old) await db.students.add({ ...s, key, lang, diagIds: [] });
    else if (old.lang !== lang) await db.students.update(key, { lang, diagIds: [] });
    await db.meta.put({ key: 'active', value: key });
  });
}

export async function getActive(): Promise<StudentRow | null> {
  const key = (await db.meta.get('active'))?.value;
  return (key && (await db.students.get(key))) || null;
}

export async function getSkills(student: string): Promise<SkillState[]> {
  const rows = await db.skills.where('student').equals(student).toArray();
  return SKILLS.map((skill) => rows.find((r) => r.skill === skill) ?? { skill, rating: START_RATING, attempts: 0 });
}

export function getAttempts(student: string): Promise<StudentAttempt[]> {
  return db.attempts.where('student').equals(student).sortBy('id');
}

/** Сохранить попытку и пересчитать навык одной транзакцией. */
export async function addAttempt(student: string, task: Task, data: Omit<Attempt, 'taskId' | 'ts'>): Promise<void> {
  await db.transaction('rw', db.attempts, db.skills, async () => {
    const prev = await db.attempts.where('[student+taskId]').equals([student, task.id]).toArray();
    const prevTs = prev.length ? Math.max(...prev.map((p) => p.ts)) : undefined;
    const ts = uniqueMinuteTs(Math.floor(Date.now() / 1000), prevTs);
    await db.attempts.add({ ...data, taskId: task.id, ts, student, synced: 0, exported: 0 });
    const st = (await db.skills.get([student, task.skill])) ?? { skill: task.skill, rating: START_RATING, attempts: 0 };
    await db.skills.put({
      student,
      skill: task.skill,
      rating: updateRating(st.rating, task.difficulty, data.score, data.hintsUsed),
      attempts: st.attempts + 1,
    });
  });
}

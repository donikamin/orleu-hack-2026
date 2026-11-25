// Аналитика для учителя: карта класса, «уверенно ошибаются», «что делать завтра».
import { computeSkills, level } from '@shared/elo';
import { SKILLS, type Skill, type SkillState, type Task } from '@shared/types';
import type { AttemptRow } from './db';
import type { TaskLookup } from './pack';

export interface StudentSummary {
  number: number;
  skills: SkillState[];
  attempts: number;
  lastTs: number | null;
  confidentWrong: number;
  weakest: SkillState | null;
}

export function summarizeStudent(number: number, attempts: AttemptRow[], lookup: TaskLookup): StudentSummary {
  const mine = attempts.filter((a) => a.number === number);
  const skills = computeSkills(mine, lookup.meta);
  const withData = skills.filter((s) => s.attempts > 0);
  return {
    number,
    skills,
    attempts: mine.length,
    lastTs: mine.length ? Math.max(...mine.map((a) => a.ts)) : null,
    confidentWrong: mine.filter((a) => a.confidence === 3 && a.score === 0).length,
    weakest: withData.length ? withData.reduce((a, b) => (b.rating < a.rating ? b : a)) : null,
  };
}

export function summarizeClass(size: number, attempts: AttemptRow[], lookup: TaskLookup): StudentSummary[] {
  const numbers = new Set<number>(Array.from({ length: size }, (_, i) => i + 1));
  for (const a of attempts) numbers.add(a.number);
  return [...numbers].sort((a, b) => a - b).map((n) => summarizeStudent(n, attempts, lookup));
}

/** Средний рейтинг класса по каждому навыку (только по ученикам с данными). */
export function classAverages(students: StudentSummary[]) {
  return SKILLS.map((skill) => {
    const vals = students.map((s) => s.skills.find((x) => x.skill === skill)!).filter((s) => s.attempts > 0);
    const rating = vals.length ? vals.reduce((sum, s) => sum + s.rating, 0) / vals.length : 0;
    return { skill, rating, students: vals.length, attempts: vals.reduce((n, s) => n + s.attempts, 0) };
  });
}

export interface ConfidentWrongItem {
  task: Task | undefined;
  taskId: string;
  students: number[];
}

/** Задания, где ученики были уверены (3) и ошиблись. Это ложные представления — разбирать первыми. */
export function confidentWrong(attempts: AttemptRow[], lookup: TaskLookup): ConfidentWrongItem[] {
  const map = new Map<string, Set<number>>();
  for (const a of attempts) {
    if (a.confidence === 3 && a.score === 0) {
      if (!map.has(a.taskId)) map.set(a.taskId, new Set());
      map.get(a.taskId)!.add(a.number);
    }
  }
  return [...map.entries()]
    .map(([taskId, s]) => ({ taskId, task: lookup.get(taskId), students: [...s].sort((x, y) => x - y) }))
    .sort((a, b) => b.students.length - a.students.length);
}

export interface TomorrowGroup {
  skill: Skill;
  students: number[];
  tasks: Task[];
}

/** Группы на завтра: ученик попадает в группу своего самого слабого навыка, если уровень ≤ 3. */
export function tomorrowGroups(students: StudentSummary[], attempts: AttemptRow[], lookup: TaskLookup): TomorrowGroup[] {
  const groups = new Map<Skill, number[]>(SKILLS.map((s) => [s, []]));
  for (const s of students) {
    if (s.weakest && level(s.weakest.rating) <= 3) groups.get(s.weakest.skill)!.push(s.number);
  }
  return SKILLS.map((skill) => {
    const nums = groups.get(skill)!;
    const done = new Set(attempts.filter((a) => nums.includes(a.number)).map((a) => a.taskId));
    const tasks = lookup
      .all()
      .filter((t) => t.skill === skill)
      .sort((a, b) => Number(done.has(a.id)) - Number(done.has(b.id)) || a.difficulty - b.difficulty)
      .slice(0, 3);
    return { skill, students: nums, tasks };
  }).filter((g) => g.students.length > 0);
}

export function formatDate(tsSeconds: number) {
  return new Date(tsSeconds * 1000).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

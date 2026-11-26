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

// ---------- Разбор заданий: что трудно всему классу ----------
export interface TaskStat {
  task: Task | undefined;
  taskId: string;
  tries: number;
  students: number;
  correctRate: number; // доля полностью верных
  hintRate: number; // среднее число подсказок
  confidentWrongRate: number;
  verdict: 'hard' | 'guess' | 'ok' | 'easy';
}

export function taskStats(attempts: AttemptRow[], lookup: TaskLookup): TaskStat[] {
  const by = new Map<string, AttemptRow[]>();
  for (const a of attempts) by.set(a.taskId, [...(by.get(a.taskId) ?? []), a]);
  return [...by.entries()]
    .map(([taskId, list]) => {
      const tries = list.length;
      const correctRate = list.filter((a) => a.score === 1).length / tries;
      const hintRate = list.reduce((s, a) => s + a.hintsUsed, 0) / tries;
      const withConf = list.filter((a) => a.confidence);
      const confidentWrongRate = withConf.length ? withConf.filter((a) => a.confidence === 3 && a.score === 0).length / withConf.length : 0;
      const verdict: TaskStat['verdict'] =
        confidentWrongRate >= 0.25 ? 'guess' : correctRate < 0.45 ? 'hard' : correctRate > 0.85 && hintRate < 0.5 ? 'easy' : 'ok';
      return { taskId, task: lookup.get(taskId), tries, students: new Set(list.map((a) => a.number)).size, correctRate, hintRate, confidentWrongRate, verdict };
    })
    .sort((a, b) => a.correctRate - b.correctRate);
}

// ---------- Динамика по неделям ----------
export interface WeekPoint {
  week: number; // начало недели, unix-секунды (понедельник)
  label: string;
  values: Record<Skill, number | null>; // доля верных за неделю, 0…1
  tries: number;
}

const WEEK = 7 * 86400;
function weekStart(ts: number) {
  const d = new Date(ts * 1000);
  const day = (d.getDay() + 6) % 7; // пн = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return Math.floor(d.getTime() / 1000);
}

export function weeklyTrend(attempts: AttemptRow[], lookup: TaskLookup, maxWeeks = 8): WeekPoint[] {
  if (!attempts.length) return [];
  const last = weekStart(Math.max(...attempts.map((a) => a.ts)));
  const first = Math.max(weekStart(Math.min(...attempts.map((a) => a.ts))), last - (maxWeeks - 1) * WEEK);
  const points: WeekPoint[] = [];
  for (let w = first; w <= last; w += WEEK) {
    const inWeek = attempts.filter((a) => a.ts >= w && a.ts < w + WEEK);
    const values = Object.fromEntries(
      SKILLS.map((s) => {
        const list = inWeek.filter((a) => lookup.get(a.taskId)?.skill === s);
        return [s, list.length ? list.reduce((sum, a) => sum + a.score, 0) / list.length : null];
      }),
    ) as Record<Skill, number | null>;
    points.push({ week: w, label: new Date(w * 1000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), values, tries: inWeek.length });
  }
  return points;
}

// ---------- Отчёт ученика: сильное, слабое, что делать дома ----------
export const HOME_ADVICE: Record<Skill, string> = {
  locate: 'Дома: дайте ребёнку расписание, чек или инструкцию и спросите один конкретный факт («во сколько?», «сколько стоит?»). Пусть покажет пальцем, где это написано.',
  understand: 'Дома: после новости или рассказа спросите «Что из этого следует?» и «Почему ты так думаешь?». Важна причина, а не пересказ.',
  evaluate: 'Дома: разберите вместе рассылку из WhatsApp. Кто автор? Чем он докажет? Где эмоции вместо фактов? Хорошая привычка — проверять источник.',
};

export function strongest(s: StudentSummary) {
  const withData = s.skills.filter((x) => x.attempts > 0);
  return withData.length ? withData.reduce((a, b) => (b.rating > a.rating ? b : a)) : null;
}

// ---------- Экспорт в Excel (CSV с BOM и «;», как ждёт русский Excel) ----------
export function toCsv(rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// «Задача дня»: одна на день, одинаковая у всего класса (зависит только от даты) — её удобно обсуждать на уроке.
// Решил сегодня — +20 XP бонусом, один раз в день.
import { MATH } from './content/math';
import { PLAYABLE } from './SiteTrain';
import { addXp, dayKey } from './streak';

const BONUS_KEY = 'oqy-daily-bonus';
export const DAILY_BONUS = 20;

function seed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Чётные дни — математика, нечётные — чтение. */
export function dailyTask(date = dayKey()) {
  const n = seed(date);
  const day = Number(date.slice(8));
  if (day % 2 === 0) {
    const m = MATH[n % MATH.length];
    return { id: m.id, title: m.title, subject: 'math' as const, teaser: m.context.body, href: `/train/${m.id}` };
  }
  const list = PLAYABLE.filter((t) => t.lang === 'ru');
  const t = list[n % list.length];
  const doc = t.docs[0];
  const teaser = doc ? `${doc.title}: ${doc.body.replace(/\s+/g, ' ').slice(0, 90)}…` : t.question;
  return { id: t.id, title: t.title, subject: 'reading' as const, teaser, href: `/train/${t.id}` };
}

/** Начисляет бонус, если задача дня решена сегодня и бонус ещё не выдавался. */
export function claimDaily(solvedTodayIds: Set<string>): boolean {
  const today = dayKey();
  const d = dailyTask(today);
  if (!solvedTodayIds.has(d.id)) return false;
  try {
    if (localStorage.getItem(BONUS_KEY) === today) return false;
    localStorage.setItem(BONUS_KEY, today);
  } catch {
    return false;
  }
  addXp(DAILY_BONUS);
  return true;
}

export function dailyClaimed() {
  try {
    return localStorage.getItem(BONUS_KEY) === dayKey();
  } catch {
    return false;
  }
}

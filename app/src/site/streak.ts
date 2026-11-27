// Мотивация как в Duolingo: очки опыта (XP), цель дня, серия дней подряд и «заморозки».
// Заморозка тратится сама, если ученик пропустил день: серия не сгорает. Новая — каждые 5 дней серии
// или за 100 XP. Держать можно не больше двух. Всё хранится на телефоне и работает без интернета.
import { useSyncExternalStore } from 'react';

export const MAX_FREEZES = 2;
export const FREEZE_PRICE = 100;
export const GOALS = [20, 30, 50] as const;

interface Store {
  xp: Record<string, number>; // день → XP
  frozen: string[]; // дни, которые спасла заморозка
  freezes: number;
  spent: number; // XP, потраченные на заморозки
  goal: number;
  rewarded: number; // за какую длину серии уже выдана заморозка
  best: number;
  seen: string; // последний день, когда приложение открывали
}

export type StreakEvent =
  | { type: 'xp'; amount: number }
  | { type: 'goal'; streak: number }
  | { type: 'streak'; streak: number }
  | { type: 'freeze-earned'; freezes: number }
  | { type: 'freeze-used'; days: string[]; streak: number };

const KEY = 'oqy-streak-v1';
const listeners = new Set<() => void>();
const eventListeners = new Set<(e: StreakEvent) => void>();
let cache: Store | null = null;
let snapshot: StreakView | null = null;

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

function load(): Store {
  if (cache) return cache;
  let s: Partial<Store> = {};
  try {
    s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Store>;
  } catch {
    /* пусто */
  }
  cache = { xp: s.xp ?? {}, frozen: s.frozen ?? [], freezes: s.freezes ?? 1, spent: s.spent ?? 0, goal: s.goal ?? 30, rewarded: s.rewarded ?? 0, best: s.best ?? 0, seen: s.seen ?? dayKey() };
  return cache;
}

function save(s: Store) {
  cache = s;
  snapshot = null;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим */
  }
  listeners.forEach((l) => l());
}

const emit = (e: StreakEvent) => eventListeners.forEach((l) => l(e));
export function onStreakEvent(fn: (e: StreakEvent) => void) {
  eventListeners.add(fn);
  return () => void eventListeners.delete(fn);
}

const active = (s: Store, d: string) => (s.xp[d] ?? 0) > 0;
const kept = (s: Store, d: string) => active(s, d) || s.frozen.includes(d);

/** Серия, которая заканчивается днём end: считаются дни с занятиями, замороженные дни только связывают цепочку. */
function streakEnding(s: Store, end: string) {
  let n = 0;
  let d = end;
  for (let guard = 0; guard < 2000 && kept(s, d); guard++) {
    if (active(s, d)) n++;
    d = addDays(d, -1);
  }
  return n;
}

function currentStreak(s: Store) {
  const today = dayKey();
  return active(s, today) ? streakEnding(s, today) : streakEnding(s, addDays(today, -1));
}

/** Раз в день при открытии: если были пропуски, тратим заморозки, чтобы серия не сгорела. */
export function reconcile() {
  const s = { ...load(), frozen: [...load().frozen] };
  const today = dayKey();
  if (s.seen >= today) return;
  const used: string[] = [];
  for (let d = addDays(s.seen, 1); d < today; d = addDays(d, 1)) {
    if (kept(s, d)) continue;
    if (s.freezes > 0 && streakEnding(s, addDays(d, -1)) > 0) {
      s.freezes--;
      s.frozen.push(d);
      used.push(d);
    }
  }
  s.seen = today;
  save(s);
  if (used.length) emit({ type: 'freeze-used', days: used, streak: currentStreak(s) });
}

export function xpFor(kind: 'reading' | 'math' | 'text' | 'lesson', score: number) {
  if (kind === 'lesson') return 15;
  if (kind === 'text') return score >= 1 ? 5 : 3;
  return score >= 1 ? 10 : score > 0 ? 6 : 2;
}

export function addXp(amount: number) {
  const s = { ...load(), xp: { ...load().xp } };
  const today = dayKey();
  const before = s.xp[today] ?? 0;
  const firstToday = before === 0;
  s.xp[today] = before + amount;
  s.seen = today;
  const streak = currentStreak(s);
  s.best = Math.max(s.best, streak);
  let earned = false;
  if (streak >= 5 && Math.floor(streak / 5) > Math.floor(s.rewarded / 5) && s.freezes < MAX_FREEZES) {
    s.freezes++;
    s.rewarded = streak;
    earned = true;
  }
  save(s);
  emit({ type: 'xp', amount });
  if (firstToday) emit({ type: 'streak', streak });
  if (before < s.goal && s.xp[today] >= s.goal) emit({ type: 'goal', streak });
  if (earned) emit({ type: 'freeze-earned', freezes: s.freezes });
}

export function buyFreeze(): boolean {
  const s = load();
  const v = view();
  if (s.freezes >= MAX_FREEZES || v.balance < FREEZE_PRICE) return false;
  save({ ...s, freezes: s.freezes + 1, spent: s.spent + FREEZE_PRICE });
  return true;
}

export function setGoal(goal: number) {
  save({ ...load(), goal });
}

export function resetStreak() {
  cache = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
  snapshot = null;
  listeners.forEach((l) => l());
}

export interface DayCell {
  key: string;
  label: string;
  state: 'done' | 'frozen' | 'missed' | 'today' | 'future';
  xp: number;
}

export interface StreakView {
  streak: number;
  best: number;
  freezes: number;
  goal: number;
  today: number;
  total: number;
  balance: number;
  alive: boolean; // занимался ли сегодня
  week: DayCell[];
  cells: (from: string, days: number) => DayCell[];
}

const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function cellsFor(s: Store, from: string, days: number): DayCell[] {
  const today = dayKey();
  return Array.from({ length: days }, (_, i) => {
    const key = addDays(from, i);
    const [y, m, d] = key.split('-').map(Number);
    const state: DayCell['state'] = key > today ? 'future' : active(s, key) ? 'done' : s.frozen.includes(key) ? 'frozen' : key === today ? 'today' : 'missed';
    return { key, label: WD[new Date(y, m - 1, d).getDay()], state, xp: s.xp[key] ?? 0 };
  });
}

function view(): StreakView {
  if (snapshot) return snapshot;
  const s = load();
  const today = dayKey();
  const total = Object.values(s.xp).reduce((a, b) => a + b, 0);
  const streak = currentStreak(s);
  // неделя с понедельника
  const [y, m, d] = today.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
  snapshot = {
    streak,
    best: Math.max(s.best, streak),
    freezes: s.freezes,
    goal: s.goal,
    today: s.xp[today] ?? 0,
    total,
    balance: total - s.spent,
    alive: active(s, today),
    week: cellsFor(s, addDays(today, -wd), 7),
    cells: (from, days) => cellsFor(s, from, days),
  };
  return snapshot;
}

export function useStreak() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    view,
    view,
  );
}

/** Уровни по общему XP (как клубы лояльности у спортивных брендов): каждый следующий чуть дальше. */
const LEVELS = [0, 50, 120, 220, 350, 520, 750, 1000, 1300, 1700, 2200, 2800];
export const LEVEL_NAMES = ['Новичок', 'Читатель', 'Счётчик', 'Аналитик', 'Знаток', 'Исследователь', 'Эксперт', 'Мастер', 'Гуру', 'Легенда', 'Чемпион PISA', 'Профессор'];
export function levelOf(totalXp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && totalXp >= LEVELS[i + 1]) i++;
  const from = LEVELS[i];
  const to = LEVELS[i + 1] ?? from + 600;
  return { n: i + 1, name: LEVEL_NAMES[i], from, to, into: totalXp - from, need: to - from };
}

export function daysWord(n: number) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return 'день';
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дня';
  return 'дней';
}

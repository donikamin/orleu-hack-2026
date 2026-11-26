// Прогресс ученика на этом устройстве (localStorage). Работает без интернета.
// Попытки по заданиям базы хранятся в формате контракта Attempt, чтобы их можно было упаковать в QR.
import { useSyncExternalStore } from 'react';
import type { Attempt } from '@shared/types';

export interface SiteAttempt extends Attempt {
  kind: 'reading' | 'math' | 'text' | 'lesson';
}

const KEY = 'oqy-progress-v1';
const listeners = new Set<() => void>();
let cache: SiteAttempt[] | null = null;

function read(): SiteAttempt[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SiteAttempt[];
  } catch {
    cache = [];
  }
  return cache;
}

export function recordAttempt(a: SiteAttempt) {
  const list = [...read().filter((x) => x.taskId !== a.taskId), a];
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* приватный режим: прогресс живёт до закрытия вкладки */
  }
  listeners.forEach((l) => l());
}

export function resetProgress() {
  cache = [];
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ничего */
  }
  listeners.forEach((l) => l());
}

export function useProgress() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    read,
  );
}

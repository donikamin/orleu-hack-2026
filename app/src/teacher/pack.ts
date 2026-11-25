// База заданий: общий пакет pack-v1 (часть B) + задания класса из фото.
import packJson from '../../../content/pack-v1.json';
import type { Task } from '@shared/types';
import type { TaskMeta } from '@shared/elo';
import type { TaskRef } from '@shared/qr-protocol';

export const PACK: Task[] = packJson as Task[];

const byId = new Map(PACK.map((t) => [t.id, t]));

/** taskRef из QR: число — индекс в pack-v1, строка — id задания. */
export function resolveTaskRef(ref: TaskRef): string | undefined {
  if (typeof ref === 'number') return PACK[ref]?.id;
  return ref;
}

export function makeTaskLookup(extra: Task[] = []) {
  const map = new Map(byId);
  for (const t of extra) map.set(t.id, t);
  return {
    get: (id: string) => map.get(id),
    meta: (id: string): TaskMeta | undefined => {
      const t = map.get(id);
      return t ? { skill: t.skill, difficulty: t.difficulty } : undefined;
    },
    all: () => [...map.values()],
  };
}

export type TaskLookup = ReturnType<typeof makeTaskLookup>;

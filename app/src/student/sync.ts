// Очередь отправки: всё, что не дошло до сервера, лежит в dexie с synced = 0.
import type { Attempt } from '@shared/types';
import { db, type StudentRow } from '../lib/db';
import { floorMinute } from '../lib/time';
import { syncAttempts } from './api';

let running = false;

/** Время округляем до минуты, как в QR: у учителя одна попытка из двух каналов не задвоится. */
export async function syncNow(me: StudentRow): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const rows = await db.attempts.where('[student+synced]').equals([me.key, 0]).limit(100).toArray();
      if (!rows.length) return;
      const attempts: Attempt[] = rows.map((r) => ({
        taskId: r.taskId,
        score: r.score,
        hintsUsed: r.hintsUsed,
        ...(r.confidence ? { confidence: r.confidence } : {}),
        ...(r.answer ? { answer: r.answer } : {}),
        ts: floorMinute(r.ts),
      }));
      await syncAttempts({ classCode: me.classCode, number: me.number }, attempts);
      await db.attempts.where('id').anyOf(rows.map((r) => r.id)).modify({ synced: 1 });
    }
  } catch {
    // не вышло: попытки остались в очереди, отправим при следующем случае
  } finally {
    running = false;
  }
}

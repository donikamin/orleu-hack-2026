// Попытки ученика → QR-части (деление, сжатие, CRC32 — в shared/qr-protocol).
import { attemptToRow, encodeResults } from '@shared/qr-protocol';
import type { Attempt, Student } from '@shared/types';

/**
 * Пишем id задания, а не индекс: протокол принимает оба. Если у ученика офлайн осталась старая версия пакета,
 * индекс указал бы учителю на чужое задание, а id всегда верен.
 */
export function attemptsToQr(student: Student, attempts: Attempt[]): string[] {
  return encodeResults(student.classCode, student.number, attempts.map((a) => attemptToRow(a, a.taskId)));
}

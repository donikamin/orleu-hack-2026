// QR-протокол из PLAN.md, раздел 6.
//
// Ученик → учитель:  OQ1|<classCode>|<number>|<part>/<total>|<base64url(deflate(JSON))>
//   JSON = [[taskRef, score*2, hintsUsed, confidence, tsMinutes], ..., crc32]
//   taskRef — индекс задания в pack-v1 (число) или id задания строкой (для заданий из фото).
//   Последний элемент массива — CRC32 от JSON.stringify(строк без CRC).
//   Каждая часть самостоятельна: её можно расшифровать отдельно, порядок сканирования не важен.
//
// Учитель → ученик:  OQA|<classCode>|<taskId,taskId,...>
import { deflate, inflate } from 'pako';
import type { Attempt } from './types';

export const MAX_QR_BYTES = 800;

export type TaskRef = number | string;
export type Row = [TaskRef, 0 | 1 | 2, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, number];

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(str: string): number {
  const bytes = new TextEncoder().encode(str);
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- base64url ----------
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Attempt <-> Row ----------
export function attemptToRow(a: Attempt, taskRef: TaskRef): Row {
  return [taskRef, (a.score * 2) as 0 | 1 | 2, a.hintsUsed, a.confidence ?? 0, Math.floor(a.ts / 60)];
}

export function rowToAttempt(row: Row, resolveTaskId: (ref: TaskRef) => string | undefined): Attempt | null {
  const [ref, score2, hints, conf, tsMin] = row;
  const taskId = resolveTaskId(ref);
  if (!taskId) return null;
  return {
    taskId,
    score: (score2 / 2) as 0 | 0.5 | 1,
    hintsUsed: hints,
    ...(conf ? { confidence: conf as 1 | 2 | 3 } : {}),
    ts: tsMin * 60,
  };
}

function encodePart(classCode: string, number: number, part: number, total: number, rows: Row[]): string {
  const json = JSON.stringify(rows);
  const body = JSON.stringify([...rows, crc32(json)]);
  return `OQ1|${classCode}|${number}|${part}/${total}|${toBase64Url(deflate(new TextEncoder().encode(body)))}`;
}

/** Упаковать строки в QR-части, каждая не длиннее MAX_QR_BYTES. */
export function encodeResults(classCode: string, number: number, rows: Row[], maxBytes = MAX_QR_BYTES): string[] {
  if (/[|]/.test(classCode)) throw new Error('classCode не должен содержать «|»');
  const chunks: Row[][] = [];
  let current: Row[] = [];
  for (const row of rows) {
    const candidate = [...current, row];
    if (current.length && encodePart(classCode, number, 99, 99, candidate).length > maxBytes) {
      chunks.push(current);
      current = [row];
    } else {
      current = candidate;
    }
  }
  if (current.length || !chunks.length) chunks.push(current);
  return chunks.map((c, i) => encodePart(classCode, number, i + 1, chunks.length, c));
}

export interface DecodedPart {
  classCode: string;
  number: number;
  part: number;
  total: number;
  rows: Row[];
}

export class QrDecodeError extends Error {}

/** Расшифровать одну часть. Бросает QrDecodeError, если код не наш или повреждён. */
export function decodeResults(text: string): DecodedPart {
  const parts = text.trim().split('|');
  if (parts.length !== 5 || parts[0] !== 'OQ1') throw new QrDecodeError('Это не QR-код результатов Oqy');
  const [, classCode, numStr, partStr, payload] = parts;
  const number = Number(numStr);
  const m = /^(\d+)\/(\d+)$/.exec(partStr);
  if (!Number.isInteger(number) || number < 1 || !m) throw new QrDecodeError('Неверный заголовок QR-кода');
  const part = Number(m[1]);
  const total = Number(m[2]);
  if (part < 1 || part > total) throw new QrDecodeError('Неверный номер части');
  let arr: unknown;
  try {
    arr = JSON.parse(new TextDecoder().decode(inflate(fromBase64Url(payload))));
  } catch {
    throw new QrDecodeError('QR-код повреждён, отсканируйте ещё раз');
  }
  if (!Array.isArray(arr) || arr.length < 1) throw new QrDecodeError('QR-код повреждён');
  const crc = arr[arr.length - 1];
  const rows = arr.slice(0, -1) as Row[];
  if (crc !== crc32(JSON.stringify(rows))) throw new QrDecodeError('Контрольная сумма не сошлась, отсканируйте ещё раз');
  return { classCode, number, part, total, rows };
}

// ---------- Задание от учителя ----------
export function encodeAssignment(classCode: string, taskIds: string[]): string {
  if (taskIds.some((id) => /[|,]/.test(id))) throw new Error('id задания не должен содержать «|» или «,»');
  return `OQA|${classCode}|${taskIds.join(',')}`;
}

export function decodeAssignment(text: string): { classCode: string; taskIds: string[] } {
  const parts = text.trim().split('|');
  if (parts.length !== 3 || parts[0] !== 'OQA') throw new QrDecodeError('Это не QR-код задания Oqy');
  return { classCode: parts[1], taskIds: parts[2].split(',').filter(Boolean) };
}

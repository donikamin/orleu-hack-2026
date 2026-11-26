// Общая обвязка: JSON, понятные ошибки, простой лимит запросов.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

type Handler = (req: Request) => Promise<Response>;

export const handle =
  (fn: Handler): Handler =>
  async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e); // детали только в журнал сервера
      return json({ error: 'Ошибка сервера. Попробуйте ещё раз.' }, 500);
    }
  };

export async function body(req: Request, maxChars = 200_000): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > maxChars) throw new HttpError(413, 'Слишком большой запрос');
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Неверный JSON');
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new HttpError(400, 'Неверный запрос');
  return v as Record<string, unknown>;
}

export function str(v: unknown, name: string, max: number, min = 1): string {
  if (typeof v !== 'string' || v.trim().length < min || v.length > max) throw new HttpError(400, `Неверное поле «${name}»`);
  return v.trim();
}

export function classCodeOf(v: unknown): string {
  const s = str(v, 'classCode', 16).toUpperCase();
  if (!/^[A-Z0-9-]{2,16}$/.test(s)) throw new HttpError(400, 'Неверный код класса');
  return s;
}

export function studentNumber(v: unknown): number {
  if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 99) throw new HttpError(400, 'Неверный номер ученика');
  return v as number;
}

// Лимит в памяти экземпляра: от случайного цикла запросов, не от целенаправленной атаки.
const hits = new Map<string, number[]>();
export function limit(req: Request, name: string, max: number, windowMs = 60_000): void {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
  const key = `${name}|${ip}`;
  const now = Date.now();
  if (hits.size > 5000) hits.clear();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) throw new HttpError(429, 'Слишком много запросов, подождите минуту');
  list.push(now);
  hits.set(key, list);
}

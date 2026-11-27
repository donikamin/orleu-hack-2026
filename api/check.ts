// Одна функция на три адреса: /api/hint, /api/grade, /api/why (см. rewrites в vercel.json).
// Бесплатный тариф Vercel разрешает не больше 12 серверных функций, поэтому близкие по смыслу проверки объединены.
import { handle, HttpError } from '../server/http';
import * as grade from '../server/routes/grade';
import * as hint from '../server/routes/hint';
import * as why from '../server/routes/why';

const ROUTES: Record<string, (req: Request) => Promise<Response>> = { hint: hint.POST, grade: grade.POST, why: why.POST };

export const POST = handle(async (req) => {
  const fn = ROUTES[new URL(req.url).searchParams.get('r') ?? ''];
  if (!fn) throw new HttpError(404, 'Нет такого адреса');
  return fn(req);
});

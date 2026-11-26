import { body, handle, HttpError, json, limit, str } from '../../server/http';
import { hashKey, store, token } from '../../server/store';

export const POST = handle(async (req) => {
  limit(req, 'class', 10);
  const name = str((await body(req)).name, 'name', 80);
  const prefix = /[789]/.exec(name)?.[0] ?? 'K'; // «8 Б» → код вида 8K3TQ, как в приложении
  for (let i = 0; i < 5; i++) {
    const classCode = prefix + token(4);
    const teacherKey = token(16);
    if (await store().addClass(classCode, name, hashKey(teacherKey))) return json({ classCode, teacherKey });
  }
  throw new HttpError(503, 'Не удалось создать код, попробуйте ещё раз');
});

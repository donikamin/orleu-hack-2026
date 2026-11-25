import { webhookCallback } from 'grammy';
import { makeBot } from '../server/bot';
import { handle, HttpError } from '../server/http';
import { sameSecret } from '../server/store';

let hook: ((req: Request) => Promise<Response>) | undefined;

export const POST = handle(async (req) => {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secretToken } = process.env;
  // Без секрета любой мог бы прислать поддельные ответы от имени ученика
  if (!token || !secretToken) throw new HttpError(503, 'Бот ещё не подключён');
  if (!sameSecret(req.headers.get('x-telegram-bot-api-secret-token') ?? '', secretToken)) throw new HttpError(401, 'Нет доступа');
  hook ??= webhookCallback(makeBot(token), 'std/http', { secretToken, timeoutMilliseconds: 50_000 });
  return hook(req);
});

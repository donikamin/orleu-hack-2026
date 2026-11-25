import { makeBot, parentReport, sendDaily } from '../server/bot';
import { handle, HttpError, json } from '../server/http';
import { sameSecret, store } from '../server/store';

// Vercel Cron: ежедневно задание ученикам, по воскресеньям ещё и отчёт родителям.
export const GET = handle(async (req) => {
  const { CRON_SECRET: secret, TELEGRAM_BOT_TOKEN: token } = process.env;
  if (!secret || !token) throw new HttpError(503, 'Рассылка не настроена');
  if (!sameSecret(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) throw new HttpError(401, 'Нет доступа');
  const bot = makeBot(token);
  const jobs: (() => Promise<unknown>)[] = (await store().linkedChats('student')).map((s) => () => sendDaily(bot, s.chatId, s));
  if (new Date().getUTCDay() === 0)
    for (const p of await store().linkedChats('parent'))
      jobs.push(async () => bot.api.sendMessage(p.chatId, `Отчёт за неделю, ${p.classCode}-${p.number}\n\n${await parentReport(p)}`));
  let sent = 0;
  let failed = 0;
  // пачками: у функции 60 секунд, у Telegram лимит 30 сообщений в секунду
  for (let i = 0; i < jobs.length; i += 10)
    for (const r of await Promise.allSettled(jobs.slice(i, i + 10).map((j) => j()))) r.status === 'fulfilled' ? sent++ : failed++;
  return json({ sent, failed });
});

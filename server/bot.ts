// Telegram-бот: задание дня для ученика, недельный отчёт для родителя.
import { Bot, InlineKeyboard } from 'grammy';
import { level } from '../shared/elo';
import { SKILL_LABEL, type SkillState, type Student, type Task } from '../shared/types';
import { ask, hasAi, obj } from './ai';
import { pack } from './pack';
import { record, skillsFor, store, type Role, type StoredAttempt } from './store';

export const parseId = (s: string): Student | null => {
  const m = /^([A-Za-z0-9]{2,16})-(\d{1,2})$/.exec(s.trim());
  return m && Number(m[2]) >= 1 ? { classCode: m[1].toUpperCase(), number: Number(m[2]) } : null;
};

/** Самый слабый навык → сначала нерешённое → сложность ближе к рейтингу. */
export function pickDaily(skills: SkillState[], attempts: StoredAttempt[]): { task: Task; index: number } {
  const weakest = [...skills].sort((a, b) => a.rating - b.rating)[0];
  const done = new Map<string, number>();
  for (const a of attempts) done.set(a.taskId, (done.get(a.taskId) ?? 0) + 1);
  const gap = (t: Task) => Math.abs(1100 + (t.difficulty - 1) * 150 - weakest.rating);
  return pack()
    .map((task, index) => ({ task, index }))
    .filter(({ task: t }) => t.lang === 'ru' && t.answer.type === 'choice' && t.skill === weakest.skill)
    .sort((a, b) => (done.get(a.task.id) ?? 0) - (done.get(b.task.id) ?? 0) || gap(a.task) - gap(b.task))[0];
}

async function stateOf(s: Student) {
  const attempts = await store().attemptsOf(s.classCode, s.number);
  return { attempts, skills: (await skillsFor(attempts))(s.number) };
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export async function sendDaily(bot: Bot, chatId: number, s: Student) {
  const { attempts, skills } = await stateOf(s);
  const { task, index } = pickDaily(skills, attempts);
  if (task.answer.type !== 'choice') return;
  const text = [
    `Задание дня: ${task.title}`,
    ...task.docs.map((d) => `${d.title}\n${d.body}`),
    task.question,
    task.answer.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('\n'),
  ].join('\n\n');
  const kb = new InlineKeyboard();
  task.answer.options.forEach((_, i) => kb.text(LETTERS[i], `a:${s.classCode}:${s.number}:${index}:${i}`));
  await bot.api.sendMessage(chatId, text, { reply_markup: kb });
}

const STRONG = { locate: 'находит в тексте нужные сведения', understand: 'делает выводы и связывает факты', evaluate: 'проверяет, можно ли верить тексту' };
const ASK_HOME = {
  locate: 'Попросите найти в квитанции или расписании одну нужную строку и показать, где она.',
  understand: 'После новости или рассказа спросите: «Почему так вышло и из чего это видно?»',
  evaluate: 'Покажите рекламу или пересланное сообщение и спросите: «Чему тут можно верить и почему?»',
};

/** Отчёт без ИИ: работает всегда. */
export function plainReport(skills: SkillState[], week: StoredAttempt[]): string {
  const seen = skills.filter((s) => s.attempts > 0).sort((a, b) => b.rating - a.rating);
  if (!seen.length || !week.length) return 'За эту неделю новых заданий пока нет. Пары заданий в день достаточно, чтобы увидеть сильные стороны.';
  const best = seen[0];
  const worst = seen[seen.length - 1];
  const lines = [`За неделю решено попыток: ${week.length}.`];
  if (seen.length === 1) lines.push(`Пока есть данные по одному навыку: «${SKILL_LABEL[best.skill]}».`);
  else lines.push(`Лучше всего ваш ребёнок ${STRONG[best.skill]}. Труднее пока навык «${SKILL_LABEL[worst.skill]}».`);
  if (week.length < 5) lines.push('Попыток мало, поэтому выводы предварительные.');
  lines.push(`Дома: ${ASK_HOME[worst.skill]}`);
  return lines.join(' ');
}

export async function parentReport(s: Student): Promise<string> {
  const { attempts, skills } = await stateOf(s);
  const week = attempts.filter((a) => a.ts > Date.now() / 1000 - 7 * 86400);
  const plain = plainReport(skills, week);
  if (!hasAi() || !week.length) return plain;
  try {
    const data = {
      попыток_за_неделю: week.length,
      верно_за_неделю: week.filter((a) => a.score === 1).length,
      навыки: skills.filter((k) => k.attempts).map((k) => ({ навык: SKILL_LABEL[k.skill], уровень_из_5: level(k.rating), попыток_всего: k.attempts })),
      идеи_вопросов_дома: ASK_HOME,
    };
    const r = await ask<{ report: string }>({ prompt: 'parent-report', content: JSON.stringify(data), schema: obj({ report: { type: 'string' } }), timeoutMs: 8000, maxTokens: 2000 });
    return r.report.trim().slice(0, 1500) || plain;
  } catch {
    return plain;
  }
}

/** Ключ хранится только на сервере. botInfo не запрашиваем заранее: grammY сделает это сам. */
export function makeBot(token: string): Bot {
  const bot = new Bot(token);
  const HELP =
    'Oqy: читай и понимай.\n\nУченик: /start КОД-НОМЕР, например /start 8K3TQ-5\nЗадание: /task\nРодитель: /parent КОД-НОМЕР, отчёт: /report\nОтвязать чат: /stop\n\nИмя и телефон не нужны: только код класса и номер в журнале.';

  async function link(chatId: number, raw: string, role: Role): Promise<{ s?: Student; error?: string }> {
    const s = parseId(raw);
    if (!s) return { error: 'Нужен код класса и номер через дефис, например 8K3TQ-5.' };
    if (!(await store().getClass(s.classCode))) return { error: 'Такого класса нет на сервере. Проверь код у учителя.' };
    await store().ensureStudent(s);
    const owner = await store().chatOf(s, role);
    if (owner && owner !== chatId) return { error: 'Этот номер уже привязан к другому чату. Его владелец может отвязать чат командой /stop.' };
    if (role === 'student') for (const old of await store().studentsByChat(chatId, 'student')) await store().setChat(old, 'student', null); // один чат — один ученик
    await store().setChat(s, role, chatId);
    return { s };
  }

  bot.use(async (ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') return; // в группах отчёты не показываем
    await next();
  });

  bot.command('start', async (ctx) => {
    const raw = String(ctx.match ?? '');
    if (!raw) return void (await ctx.reply(HELP));
    const { s, error } = await link(ctx.chat.id, raw, 'student');
    if (!s) return void (await ctx.reply(error!));
    await ctx.reply('Готово! Каждый день пришлю одно задание. Новое прямо сейчас:');
    await sendDaily(bot, ctx.chat.id, s);
  });
  bot.command('parent', async (ctx) => {
    const { s, error } = await link(ctx.chat.id, String(ctx.match ?? ''), 'parent');
    await ctx.reply(s ? `Отчёт будет приходить по воскресеньям. Сейчас:\n\n${await parentReport(s)}` : error!);
  });
  bot.command('task', async (ctx) => {
    const [s] = await store().studentsByChat(ctx.chat.id, 'student');
    if (s) await sendDaily(bot, ctx.chat.id, s);
    else await ctx.reply('Сначала привяжи себя: /start КОД-НОМЕР');
  });
  bot.command('report', async (ctx) => {
    const kids = await store().studentsByChat(ctx.chat.id, 'parent');
    if (!kids.length) await ctx.reply('Сначала привяжите ребёнка: /parent КОД-НОМЕР');
    for (const s of kids) await ctx.reply(`${s.classCode}-${s.number}\n\n${await parentReport(s)}`);
  });
  bot.command('stop', async (ctx) => {
    for (const role of ['student', 'parent'] as const) for (const s of await store().studentsByChat(ctx.chat.id, role)) await store().setChat(s, role, null);
    await ctx.reply('Чат отвязан.');
  });

  bot.callbackQuery(/^a:([A-Z0-9]+):(\d+):(\d+):(\d)$/, async (ctx) => {
    const [, classCode, num, idx, opt] = ctx.match as RegExpMatchArray;
    const s = { classCode, number: Number(num) };
    const task = pack()[Number(idx)];
    const chatId = ctx.chat?.id;
    if (!chatId || task?.answer.type !== 'choice' || (await store().chatOf(s, 'student')) !== chatId) return void (await ctx.answerCallbackQuery('Этот чат уже не привязан'));
    const ok = task.answer.correct === Number(opt);
    // Время отправки задания — ключ попытки: второе нажатие не создаст новую.
    const sent = ctx.callbackQuery.message?.date || Math.floor(Date.now() / 1000);
    const { added } = await record(s, [{ taskId: task.id, score: ok ? 1 : 0, hintsUsed: 0, ts: Math.floor(sent / 60) * 60 }], 'bot');
    if (!added) return void (await ctx.answerCallbackQuery('Ответ уже записан'));
    await ctx.answerCallbackQuery();
    await ctx.reply(`${ok ? 'Верно.' : 'Пока неверно. Разберём.'}\n\n${task.explanation}\n\nЕщё одно: /task`);
  });
  bot.on('message', (ctx) => ctx.reply(HELP));
  bot.catch((e) => console.error('bot', e.error));
  return bot;
}

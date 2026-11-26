import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/types';

const create = vi.fn();
vi.mock('@anthropic-ai/sdk', async (orig) => {
  const mod = await orig<typeof import('@anthropic-ai/sdk')>();
  class Fake {
    beta = { messages: { create } };
  }
  for (const k of ['APIError', 'APIConnectionTimeoutError', 'RateLimitError'] as const) Object.assign(Fake, { [k]: mod.default[k] });
  return { ...mod, default: Fake };
});

const generate = vi.fn();
vi.mock('@google/genai', async (orig) => {
  const mod = await orig<typeof import('@google/genai')>();
  class Fake {
    models = { generateContent: generate };
  }
  return { ...mod, GoogleGenAI: Fake };
});

import * as bot from '../api/bot';
import * as classGet from '../api/class/[code]';
import * as classNew from '../api/class/index';
import * as cron from '../api/cron';
import * as grade from '../api/grade';
import * as hint from '../api/hint';
import * as packApi from '../api/pack';
import * as photo from '../api/photo-tasks';
import * as sync from '../api/sync';
import * as tasksApi from '../api/tasks';
import * as why from '../api/why';
import { makeBot, parseId, pickDaily, plainReport } from './bot';
import { revealsAnswer } from './leak';
import { isTask, pack } from './pack';
import { MemoryStore, setStore, store } from './store';

const url = (p: string) => `http://x/api/${p}`;
let ip = 0;
const post = (p: string, b: unknown, headers: Record<string, string> = {}) =>
  new Request(url(p), { method: 'POST', body: typeof b === 'string' ? b : JSON.stringify(b), headers: { 'x-real-ip': `ip${ip}`, ...headers } });
const get = (p: string, headers: Record<string, string> = {}) => new Request(url(p), { headers: { 'x-real-ip': `ip${ip}`, ...headers } });
const ai = (v: unknown, stop = 'end_turn') => create.mockResolvedValueOnce({ stop_reason: stop, content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }] });
const newClass = async () => (await (await classNew.POST(post('class', { name: '8 «Б»' }))).json()) as { classCode: string; teacherKey: string };
const T0 = 1_790_000_040;

beforeEach(() => {
  ip++;
  vi.unstubAllEnvs();
  create.mockReset();
  setStore(new MemoryStore());
  vi.stubEnv('ANTHROPIC_API_KEY', 'test');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('переключатель AI_PROVIDER=gemini', () => {
  beforeEach(() => {
    generate.mockReset();
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('GEMINI_API_KEY', 'test');
  });
  const gem = (v: unknown, finishReason = 'STOP') => generate.mockResolvedValueOnce({ text: JSON.stringify(v), candidates: [{ finishReason }] });

  it('подсказка и проверка идут через Gemini, Claude не вызывается', async () => {
    gem({ hint: 'По каким дням ходит выбранный рейс?' });
    expect(await (await hint.POST(post('hint', { taskId: 'c-loc-01', answer: '', hintLevel: 0 }))).json()).toEqual({ hint: 'По каким дням ходит выбранный рейс?' });
    gem({ met: [true, true, true, true], feedback: 'ок' });
    expect(((await (await grade.POST(post('grade', { taskId: 'fam-01', answer: 'x' }))).json()) as { score: number }).score).toBe(1);
    expect(create).not.toHaveBeenCalled();
    const cfg = generate.mock.calls[0][0];
    expect(cfg.model).toBe('gemini-3.8-flash');
    expect(JSON.stringify(cfg.config.responseJsonSchema)).not.toContain('additionalProperties');
    expect(cfg.config.systemInstruction).toContain('репетитор');
  });
  it('фото уходит картинкой, сложность без enum', async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString('base64');
    gem({ readable: false, tasks: [] });
    expect((await photo.POST(post('photo-tasks', { imageBase64: jpeg, grade: 8, lang: 'ru' }))).status).toBe(422);
    const { contents, config } = generate.mock.calls[0][0];
    expect(contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: jpeg });
    expect(JSON.stringify(config.responseJsonSchema)).toContain('"minimum":1');
  });
  it('без ключа Gemini и при блокировке — статическая подсказка; ключ Claude не считается', async () => {
    const same = async () => expect(await (await hint.POST(post('hint', { taskId: 'c-loc-01', answer: '', hintLevel: 1 }))).json()).toEqual({ hint: pack()[0].hints[1] });
    gem({ hint: 'x' }, 'SAFETY');
    await same();
    generate.mockRejectedValueOnce(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    await same();
    vi.stubEnv('GEMINI_API_KEY', '');
    await same();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', 'test');
    gem({ ok: true, feedback: 'да' });
    expect((await why.POST(post('why', { taskId: 'c-loc-01', reason: 'потому что' }))).status).toBe(200);
  });
});

describe('база заданий', () => {
  it('45 русских (по 5 на навык и сложность) и 9 казахских, индексы первых 9 не сдвинуты', () => {
    const p = pack();
    expect(p).toHaveLength(54);
    expect(p.every(isTask)).toBe(true);
    expect(new Set(p.map((t) => t.id)).size).toBe(54);
    expect(p.slice(0, 9).map((t) => t.id)).toEqual(['c-loc-01', 'c-loc-02', 'c-loc-03', 'c-und-01', 'c-und-02', 'c-und-03', 'c-eva-01', 'c-eva-02', 'c-eva-03']);
    for (const s of ['locate', 'understand', 'evaluate'])
      for (const d of [1, 2, 3]) {
        const n = (l: string) => p.filter((t) => t.skill === s && t.difficulty === d && t.lang === l).length;
        expect([n('ru'), n('kk')]).toEqual([5, 1]);
      }
  });
  it('подсказки не раскрывают ответ', () => {
    for (const t of pack()) for (const h of t.hints) expect([t.id, h, revealsAnswer(h, t)]).toEqual([t.id, h, false]);
  });
});

describe('фильтр ответа', () => {
  const by = (id: string) => pack().find((t) => t.id === id)!;
  it.each([
    ['c-loc-01', 'Ей подойдёт рейс 08:15.'],
    ['c-loc-09', 'Получится 160, проверь.'],
    ['c-und-06', 'Сначала Камиле было скучно, а потом книга её увлекла.'],
    ['c-loc-01', 'Посмотри на вариант Б.'],
    ['c-loc-01', 'Проверь вариант 2.'],
    ['c-loc-01', 'Правильный ответ где-то в субботе.'],
    ['fake-01', 'Обрати внимание на предложение 2.'],
  ])('%s: «%s» — раскрывает', (id, h) => expect(revealsAnswer(h, by(id))).toBe(true));
  it('обычная подсказка проходит', () => {
    for (const h of ['Какие рейсы есть именно в субботу?', 'Ищи ответ в тексте о субботе.']) expect(revealsAnswer(h, by('c-loc-01'))).toBe(false);
  });
});

describe('hint', () => {
  const t = () => pack()[0];
  const call = async (b: object = {}) => hint.POST(post('hint', { taskId: 'c-loc-01', answer: '06:40', hintLevel: 0, ...b }));
  it('отдаёт подсказку ИИ', async () => {
    ai({ hint: 'По каким дням ходит выбранный рейс?' });
    expect(await (await call()).json()).toEqual({ hint: 'По каким дням ходит выбранный рейс?' });
  });
  it('заменяет раскрывающую, битую, отказ, ошибку и отсутствие ключа статической', async () => {
    const same = async () => expect(await (await call()).json()).toEqual({ hint: t().hints[0] });
    ai({ hint: 'Это 08:15' });
    await same();
    ai('{"hint": "обор');
    await same();
    ai({ hint: 'x' }, 'refusal');
    await same();
    create.mockRejectedValueOnce(new Error('network'));
    await same();
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await same();
  });
  it('плохой ввод — 400, неизвестное задание — 404', async () => {
    expect((await call({ hintLevel: 3 })).status).toBe(400);
    expect((await call({ taskId: 'нет' })).status).toBe(404);
    expect((await hint.POST(post('hint', 'не json'))).status).toBe(400);
  });
});

describe('grade и why', () => {
  const g = async (met: boolean[]) => {
    ai({ met, feedback: 'ок' });
    return (await (await grade.POST(post('grade', { taskId: 'fam-01', answer: 'ответ' }))).json()) as { score: number };
  };
  it('балл по рубрике', async () => {
    expect((await g([true, true, true, true])).score).toBe(1);
    expect((await g([true, true, false, false])).score).toBe(0.5);
    expect((await g([true, false, false, false])).score).toBe(0);
  });
  it('неполный ответ ИИ — 502, закрытое задание — 400, нет ключа — 503', async () => {
    ai({ met: [true], feedback: '' });
    expect((await grade.POST(post('grade', { taskId: 'fam-01', answer: 'x' }))).status).toBe(502);
    expect((await grade.POST(post('grade', { taskId: 'c-loc-01', answer: 'x' }))).status).toBe(400);
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await why.POST(post('why', { taskId: 'c-loc-01', reason: 'потому что' }))).status).toBe(503);
  });
  it('why', async () => {
    ai({ ok: true, feedback: 'Опора на расписание.' });
    expect(await (await why.POST(post('why', { taskId: 'c-loc-01', reason: 'суббота' }))).json()).toEqual({ ok: true, feedback: 'Опора на расписание.' });
  });
});

describe('классы и синхронизация', () => {
  it('создать → отправить → прочитать; повтор не задваивает; ключ обязателен', async () => {
    const { classCode, teacherKey } = await newClass();
    expect(classCode).toMatch(/^8[A-Z2-9]{4}$/);
    const a = { taskId: 'c-loc-01', score: 1, hintsUsed: 0, confidence: 3, ts: T0 };
    const send = () => sync.POST(post('sync', { student: { classCode, number: 5 }, attempts: [a, a] }));
    const { skills } = (await (await send()).json()) as { skills: { skill: string; rating: number; attempts: number }[] };
    expect(skills.find((s) => s.skill === 'locate')).toMatchObject({ attempts: 1 });
    expect(skills[0].rating).toBeGreaterThan(1200);
    await send();
    const data = (await (await classGet.GET(get(`class/${classCode}`, { 'x-teacher-key': teacherKey }))).json()) as { attempts: unknown[]; students: unknown[] };
    expect(data.attempts).toEqual([{ ...a, number: 5, via: 'online' }]);
    expect(data.students).toHaveLength(1);
    for (const r of [get(`class/${classCode}`), get(`class/${classCode}`, { 'x-teacher-key': 'NO' }), get('class/DEMO'), get('class/ZZZZ')]) expect((await classGet.GET(r)).status).toBe(403);
  });
  it('плохие попытки и неизвестный класс', async () => {
    const s = (b: object) => sync.POST(post('sync', { student: { classCode: 'DEMO', number: 1 }, attempts: [], ...b }));
    expect((await s({})).status).toBe(200);
    expect((await s({ student: { classCode: '8NONE', number: 1 } })).status).toBe(404);
    expect((await s({ student: { classCode: 'DEMO', number: 0 } })).status).toBe(400);
    for (const bad of [null, { taskId: 'c-loc-01', score: 5, hintsUsed: 0, ts: T0 }, { taskId: 'c-loc-01', score: 1, hintsUsed: 0, ts: 9e12 }, { taskId: '<b>', score: 1, hintsUsed: 0, ts: T0 }]) expect((await s({ attempts: [bad] })).status).toBe(400);
  });
  it('без базы на Vercel — 503, а база заданий работает', async () => {
    setStore(undefined);
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('SUPABASE_URL', '');
    expect((await classNew.POST(post('class', { name: '7А' }))).status).toBe(503);
    expect(await (await packApi.GET(get('pack?v=1'))).json()).toHaveLength(54);
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await hint.POST(post('hint', { taskId: 'c-loc-01', answer: '', hintLevel: 0 }))).status).toBe(200);
  });
});

describe('фото → задания', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString('base64');
  const draft = { title: 'Степь', passage: 'Тюльпаны зацветают в конце апреля.', skill: 'locate', difficulty: 1, question: 'Когда цветут тюльпаны?', options: ['В конце апреля', 'В мае', 'В июне', 'Зимой'], correct: 0, hints: ['Найди время.', 'Перечитай начало.', 'Это в конце апреля.'], explanation: 'Так в тексте.' };
  const call = (b: object = {}) => photo.POST(post('photo-tasks', { imageBase64: jpeg, grade: 8, lang: 'ru', ...b }));
  it('делает задания, чистит раскрывающую подсказку, отбрасывает битое; учитель раздаёт классу', async () => {
    ai({ readable: true, tasks: [draft, draft, draft, { ...draft, correct: 9 }] });
    const tasks = (await (await call()).json()) as Task[];
    expect(tasks).toHaveLength(3);
    expect(tasks.every(isTask)).toBe(true);
    expect(tasks[0].hints[2]).not.toContain('апреля');
    const { classCode, teacherKey } = await newClass();
    const edited = { ...tasks[0], question: 'Исправлено учителем?' };
    const save = (key: string) => tasksApi.POST(post('tasks', { classCode, tasks: [edited] }, { 'x-teacher-key': key }));
    expect((await save('NO')).status).toBe(403);
    expect((await save(teacherKey)).status).toBe(200);
    const p = (await (await packApi.GET(get(`pack?v=1&class=${classCode}`))).json()) as Task[];
    expect(p).toHaveLength(55);
    expect(p[54].question).toBe('Исправлено учителем?');
    // другой класс перезаписать не может
    const other = await newClass();
    expect((await tasksApi.POST(post('tasks', { classCode: other.classCode, tasks: [edited] }, { 'x-teacher-key': other.teacherKey }))).status).toBe(403);
    // попытка по фото-заданию влияет на навык
    const r = (await (await sync.POST(post('sync', { student: { classCode, number: 1 }, attempts: [{ taskId: edited.id, score: 1, hintsUsed: 0, ts: T0 }] }))).json()) as { skills: { attempts: number }[] };
    expect(r.skills[0].attempts).toBe(1);
  });
  it('кривая картинка, нечитаемая страница, мало заданий', async () => {
    expect((await call({ imageBase64: 'A'.repeat(400) })).status).toBe(400);
    expect((await call({ imageBase64: '' })).status).toBe(400);
    ai({ readable: false, tasks: [] });
    expect((await call()).status).toBe(422);
    ai({ readable: true, tasks: [draft] });
    expect((await call()).status).toBe(502);
  });
});

describe('бот', () => {
  it('разбор кода и отчёт без ИИ', () => {
    expect(parseId('8k3tq-5')).toEqual({ classCode: '8K3TQ', number: 5 });
    for (const bad of ['8K3TQ', '8K3TQ-0', '8K3TQ-100', '']) expect(parseId(bad)).toBeNull();
    const sk = (['locate', 'understand', 'evaluate'] as const).map((skill, i) => ({ skill, rating: 1300 - i * 50, attempts: 3 }));
    expect(plainReport(sk, [{} as never])).toContain('«Оценить»');
    expect(plainReport(sk, [])).toContain('пока нет');
    expect(pickDaily(sk, []).task).toMatchObject({ skill: 'evaluate', lang: 'ru' });
  });
  it('вебхук и рассылка закрыты без секретов', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect((await bot.POST(post('bot', {}))).status).toBe(503);
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '1:a');
    vi.stubEnv('CRON_SECRET', 'secret');
    expect((await cron.GET(get('cron', { authorization: 'Bearer no' }))).status).toBe(401);
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'right');
    expect((await bot.POST(post('bot', {}, { 'x-telegram-bot-api-secret-token': 'wrong' }))).status).toBe(401);
  });
  it('привязка → задание → ответ; повтор и чужой чат не проходят', async () => {
    const b = makeBot('1:a');
    b.botInfo = { id: 1, is_bot: true, first_name: 'o', username: 'oqy_bot' } as never;
    const calls: { method: string; payload: Record<string, any> }[] = [];
    b.api.config.use(async (_prev, method, payload) => {
      calls.push({ method, payload: payload as never });
      return { ok: true, result: true } as never;
    });
    let n = 0;
    const msg = (id: number, text: string) =>
      b.handleUpdate({ update_id: ++n, message: { message_id: n, date: T0, chat: { id, type: 'private', first_name: 'a' }, from: { id, is_bot: false, first_name: 'a' }, text, entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } } as never);
    await msg(10, '/start DEMO-5');
    const kb = calls.at(-1)!.payload.reply_markup.inline_keyboard.flat() as { callback_data: string }[];
    expect(kb).toHaveLength(4);
    expect(kb.every((k) => k.callback_data.length <= 64)).toBe(true);
    const press = (id: number, data: string) =>
      b.handleUpdate({ update_id: ++n, callback_query: { id: 'q', chat_instance: 'c', from: { id, is_bot: false, first_name: 'a' }, data, message: { message_id: 1, date: T0 + 20, chat: { id, type: 'private', first_name: 'a' } } } } as never);
    await press(10, kb[0].callback_data);
    await press(10, kb[1].callback_data);
    expect(calls.at(-1)).toMatchObject({ method: 'answerCallbackQuery', payload: { text: 'Ответ уже записан' } });
    await press(99, kb[0].callback_data);
    expect(await store().attemptsOf('DEMO', 5)).toMatchObject([{ via: 'bot', ts: T0 }]);
    await msg(99, '/start DEMO-5');
    expect(calls.at(-1)!.payload.text).toContain('уже привязан');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await msg(20, '/parent DEMO-5');
    expect(calls.at(-1)!.payload.text).toContain('по воскресеньям');
    await msg(20, '/stop');
    expect(await store().chatOf({ classCode: 'DEMO', number: 5 }, 'parent')).toBeNull();
  });
});

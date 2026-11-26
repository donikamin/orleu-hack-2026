import { randomUUID } from 'node:crypto';
import type { Skill, Task } from '../shared/types';
import { ask, obj } from '../server/ai';
import { body, handle, HttpError, json, limit, str } from '../server/http';
import { revealsAnswer } from '../server/leak';
import { isTask } from '../server/pack';
import { hasStore, store } from '../server/store';

interface Draft {
  title: string;
  passage: string;
  skill: Skill;
  difficulty: 1 | 2 | 3;
  question: string;
  options: string[];
  correct: number;
  hints: string[];
  explanation: string;
}

const s = { type: 'string' };
const list = { type: 'array', items: s };
const SCHEMA = obj({
  readable: { type: 'boolean' },
  tasks: {
    type: 'array',
    items: obj({
      title: s,
      passage: s,
      skill: { type: 'string', enum: ['locate', 'understand', 'evaluate'] },
      difficulty: { type: 'integer', enum: [1, 2, 3] },
      question: s,
      options: list,
      correct: { type: 'integer' },
      hints: list,
      explanation: s,
    }),
  },
});

function mediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const h = Buffer.from(b64.slice(0, 24), 'base64');
  if (h[0] === 0xff && h[1] === 0xd8) return 'image/jpeg';
  if (h.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (h.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  throw new HttpError(400, 'Нужна фотография в формате JPEG, PNG или WebP');
}

export const POST = handle(async (req) => {
  limit(req, 'photo', 10);
  const b = await body(req, 4_300_000); // предел Vercel — 4,5 МБ
  const data = str(b.imageBase64, 'imageBase64', 4_200_000, 100).replace(/^data:image\/[\w+]+;base64,/, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new HttpError(400, 'Фото повреждено, снимите ещё раз');
  const type = mediaType(data);
  if (![7, 8, 9].includes(b.grade as number)) throw new HttpError(400, 'Класс должен быть 7, 8 или 9');
  if (b.lang !== 'ru' && b.lang !== 'kk') throw new HttpError(400, 'Неверный язык');
  const lang = b.lang;

  const r = await ask<{ readable: boolean; tasks: Draft[] }>({
    prompt: 'photo-tasks',
    content: { imageBase64: { mediaType: type, data }, text: `Класс: ${b.grade}. Язык заданий: ${lang === 'kk' ? 'казахский' : 'русский'}.` },
    schema: SCHEMA,
    timeoutMs: 55_000,
    maxTokens: 12_000,
    photo: true,
  });
  if (!r.readable) throw new HttpError(422, 'Не удалось прочитать текст. Снимите ровнее и при хорошем свете.');

  const tasks = r.tasks
    .map(
      (d): Task => ({
        id: `photo-${randomUUID()}`,
        format: 'classic',
        skill: d.skill,
        difficulty: d.difficulty,
        lang,
        title: d.title,
        docs: [{ title: lang === 'kk' ? 'Оқулықтан үзінді' : 'Отрывок из учебника', body: d.passage }],
        question: d.question,
        answer: { type: 'choice', options: d.options, correct: d.correct },
        hints: d.hints as Task['hints'],
        explanation: d.explanation,
        source: 'photo',
      }),
    )
    .filter((t) => isTask(t) && t.docs[0].body.trim() && t.answer.type === 'choice' && t.answer.options.length === 4)
    // выдающая ответ подсказка не доходит до учеников
    .map((t) => ({
      ...t,
      hints: t.hints.map((h) => (revealsAnswer(h, t) ? (lang === 'kk' ? 'Сұраққа қатысты жолды мәтіннен қайта оқы.' : 'Перечитай в тексте место, к которому относится вопрос.') : h)) as Task['hints'],
    }))
    .slice(0, 6);
  if (tasks.length < 3) throw new HttpError(502, 'ИИ составил слишком мало заданий, попробуйте ещё раз');

  // Чтобы сервер знал навык и сложность при синхронизации. Сбой базы не мешает учителю.
  if (hasStore()) await store().saveTasks(tasks, null).catch((e) => console.error(e));
  return json(tasks);
});

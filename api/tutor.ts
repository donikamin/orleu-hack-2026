// POST /api/tutor — ИИ-наставник по фото задачи или вопросу (идея OpenMath / MathBot):
// не решает за ученика, а ведёт наводящими вопросами шаг за шагом.
// Тело: { imageBase64?: string, messages: [{ role: 'student' | 'tutor', text }] }
// Фото сжимается на телефоне до ~40–80 КБ, поэтому запрос проходит и на 2G.
import { ask, obj, studentText } from '../server/ai';
import { body, handle, HttpError, json, limit, str } from '../server/http';

const SCHEMA = obj({
  reply: { type: 'string' },
  stage: { type: 'string', enum: ['question', 'solved', 'unreadable'] },
});

function mediaType(b64: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const h = Buffer.from(b64.slice(0, 24), 'base64');
  if (h[0] === 0xff && h[1] === 0xd8) return 'image/jpeg';
  if (h.subarray(1, 4).toString('latin1') === 'PNG') return 'image/png';
  if (h.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  throw new HttpError(400, 'Нужна фотография JPEG, PNG или WebP');
}

export const POST = handle(async (req) => {
  limit(req, 'tutor', 30);
  const b = await body(req, 1_500_000);
  const msgs = Array.isArray(b.messages) ? (b.messages as { role?: unknown; text?: unknown }[]).slice(-12) : [];
  if (!msgs.length && !b.imageBase64) throw new HttpError(400, 'Пришли фото задачи или напиши вопрос');

  let image: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string } | undefined;
  if (b.imageBase64) {
    const data = str(b.imageBase64, 'imageBase64', 1_400_000, 100).replace(/^data:image\/[\w+]+;base64,/, '');
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) throw new HttpError(400, 'Фото повреждено, сними ещё раз');
    image = { mediaType: mediaType(data), data };
  }
  const dialog = msgs
    .map((m) => (m.role === 'tutor' ? `Наставник: ${str(m.text, 'text', 2000)}` : `Ученик: ${studentText(str(m.text, 'text', 1000))}`))
    .join('\n');
  // формат ask() из части B: работает и с Claude, и с Gemini
  const content = { text: dialog ? `Диалог до этого момента:\n${dialog}\n\nОтветь наставником.` : 'Ученик прислал фото задачи. Начни разбор.', imageBase64: image };

  const r = await ask<{ reply: string; stage: 'question' | 'solved' | 'unreadable' }>({
    prompt: 'tutor',
    content,
    schema: SCHEMA,
    timeoutMs: 40_000,
    maxTokens: 1_200,
    photo: !!b.imageBase64,
  });
  return json(r);
});

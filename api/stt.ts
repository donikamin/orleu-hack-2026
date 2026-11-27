// POST /api/stt — распознавание речи для микрофона ИИ-ответчика, когда встроенное распознавание браузера недоступно.
// Тело: { audioBase64: string (WAV 16 кГц моно, до ~15 с), lang?: 'ru-RU' | 'kk-KZ' }. Ответ: { text }.
// Работает от GEMINI_API_KEY при любом AI_PROVIDER (Gemini понимает русскую и казахскую речь).
import { ApiError, GoogleGenAI } from '@google/genai';
import { body, handle, HttpError, json, limit, str } from '../server/http';

export const POST = handle(async (req) => {
  limit(req, 'stt', 40);
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, 'Распознавание речи на сервере не подключено');
  const b = await body(req, 1_200_000);
  const audio = str(b.audioBase64, 'audioBase64', 1_100_000, 200);
  if (!/^[A-Za-z0-9+/]+=*$/.test(audio)) throw new HttpError(400, 'Запись повреждена, скажи ещё раз');
  if (Buffer.from(audio.slice(0, 8), 'base64').subarray(0, 4).toString('latin1') !== 'RIFF') throw new HttpError(400, 'Нужна запись WAV');
  const kk = b.lang === 'kk-KZ';
  const model = process.env.STT_MODEL?.trim() || process.env.AI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  try {
    const res = await new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' }).models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'audio/wav', data: audio } },
            { text: `Это вопрос школьника ${kk ? 'на казахском' : 'на русском или казахском'} языке. Запиши дословно, что он сказал, с пунктуацией. Верни только текст, без пояснений. Если речи нет — верни пустую строку.` },
          ],
        },
      ],
      config: { maxOutputTokens: 300, abortSignal: AbortSignal.timeout(20_000) },
    });
    const text = (res.text ?? '').trim().replace(/^["«]|["»]$/g, '');
    if (!text) throw new HttpError(422, 'Не расслышал, скажи ещё раз чуть громче');
    return json({ text: text.slice(0, 500) });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new HttpError(504, 'Распознавание заняло слишком долго');
    if (e instanceof ApiError) {
      console.error('Gemini STT', e.status, e.message);
      throw new HttpError(e.status === 429 ? 503 : 502, 'Распознавание речи сейчас недоступно');
    }
    throw e;
  }
});

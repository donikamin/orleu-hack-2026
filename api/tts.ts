// POST /api/tts — живой голос для озвучки текстов и ответов наставника, по-русски и по-казахски.
// 1) ElevenLabs (ELEVENLABS_API_KEY): модель eleven_v3 знает казахский, звук mp3 22 кГц 32 кбит/с — ~4 КБ на секунду речи, лёгкий для 2G.
// 2) Иначе Gemini TTS (GEMINI_API_KEY), WAV 24 кГц. Нужен API v1beta: в v1 нет настройки голоса (speechConfig).
// Тело: { text: string, voice?: 'female' | 'male', lang?: 'ru' | 'kk' }.
// Клиент озвучивает по одному предложению и кэширует звук на телефоне: второй раз текст звучит без сети.
// Нет ключа GEMINI_API_KEY или нет сети — клиент сам переходит на голос телефона.
import { ApiError, GoogleGenAI } from '@google/genai';
import { body, handle, HttpError, limit, str } from '../server/http';

const VOICES = { female: 'Kore', male: 'Charon' } as const;

/** Gemini может вернуть «сырой» PCM без заголовка — оборачиваем в WAV, чтобы играл любой телефон. */
function toWav(pcm: Buffer, mime: string): Buffer {
  if (pcm.subarray(0, 4).toString('latin1') === 'RIFF') return pcm;
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8, 'latin1');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // моно
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'latin1');
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Голоса ElevenLabs по языку: казахский текст читают казахские голоса, русский — русские (выбраны командой).
// Чтобы голос из библиотеки работал через API, его надо добавить в «My Voices» аккаунта ElevenLabs.
// Если голос недоступен, читает стандартный голос ElevenLabs (Sarah / Adam), он есть у всех аккаунтов.
// Rachel (21m00…) новым аккаунтам недоступна.
const env = (k: string) => process.env[k]?.trim() || undefined;
const EL_VOICES = {
  kk: { female: env('ELEVENLABS_VOICE_KK_FEMALE') ?? 'biokABXKofsvZPlKbROC', male: env('ELEVENLABS_VOICE_KK_MALE') ?? 'wbGUrCE6cHpRbU9idaMy' },
  ru: { female: env('ELEVENLABS_VOICE_FEMALE') ?? 't6lBrEl93uCiLR1Lgm8v', male: env('ELEVENLABS_VOICE_MALE') ?? 'RjY1wx8VeYo2R2WFDXfX' },
};
const EL_DEFAULT = { female: 'EXAVITQu4vr4xnSDxMaL', male: 'pNInz6obpgDQGcFmaJgB' };

async function eleven(text: string, gender: 'female' | 'male', lang: 'ru' | 'kk'): Promise<Response> {
  const model = process.env.ELEVENLABS_MODEL?.trim() || 'eleven_v3';
  const call = (voice: string, withLang: boolean) =>
    fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_22050_32`, {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY!, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, ...(withLang ? { language_code: lang } : {}) }),
      signal: AbortSignal.timeout(20_000),
    });
  const voice = EL_VOICES[lang][gender];
  // Бесплатный план не даёт голоса из библиотеки (402): запоминаем и сразу берём стандартный, без лишней секунды
  if (blocked.has(voice)) return finish(await call(EL_DEFAULT[gender], true));
  let r = await call(voice, true);
  if (r.status === 400 || r.status === 422) r = await call(voice, false); // модель не принимает language_code — определит язык сама
  if (!r.ok && r.status !== 401 && r.status !== 429) {
    console.error('ElevenLabs voice', voice, r.status, (await r.text().catch(() => '')).slice(0, 200));
    if (r.status === 402 || r.status === 403 || r.status === 404) blocked.add(voice);
    r = await call(EL_DEFAULT[gender], true); // голос из библиотеки недоступен — стандартный голос
  }
  return finish(r);
}

const blocked = new Set<string>();

async function finish(r: Response): Promise<Response> {
  if (!r.ok) {
    console.error('ElevenLabs TTS', r.status, (await r.text().catch(() => '')).slice(0, 200));
    throw new HttpError(r.status === 429 ? 503 : 502, 'Живой голос сейчас недоступен');
  }
  return new Response(await r.arrayBuffer(), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=31536000, immutable' } });
}

export const POST = handle(async (req) => {
  limit(req, 'tts', 90);
  if (!process.env.ELEVENLABS_API_KEY && !process.env.GEMINI_API_KEY) throw new HttpError(503, 'Живой голос не подключён');
  const b = await body(req, 4_000);
  const text = str(b.text, 'text', 700);
  const gender = b.voice === 'male' ? 'male' : 'female';
  const lang = b.lang === 'kk' || /[әғқңөұүһі]/i.test(text) ? 'kk' : 'ru';
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      return await eleven(text, gender, lang);
    } catch (e) {
      if (!process.env.GEMINI_API_KEY) throw e instanceof HttpError ? e : new HttpError(504, 'Голос генерируется слишком долго');
    }
  }
  const voice = VOICES[gender];
  const model = process.env.TTS_MODEL?.trim() || 'gemini-3.8-flash-lite-tts';

  try {
    const res = await new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' }).models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: lang === 'kk' ? `Read aloud in Kazakh with native Kazakh pronunciation: ${text}` : text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        abortSignal: AbortSignal.timeout(25_000),
      },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new HttpError(502, 'Голос не сгенерировался');
    const wav = toWav(Buffer.from(part.inlineData.data, 'base64'), part.inlineData.mimeType ?? '');
    return new Response(new Uint8Array(wav), { headers: { 'content-type': 'audio/wav', 'cache-control': 'public, max-age=31536000, immutable' } });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError') throw new HttpError(504, 'Голос генерируется слишком долго');
    if (e instanceof ApiError) {
      console.error('Gemini TTS', e.status, e.message);
      throw new HttpError(e.status === 429 ? 503 : 502, 'Живой голос сейчас недоступен');
    }
    throw e;
  }
});

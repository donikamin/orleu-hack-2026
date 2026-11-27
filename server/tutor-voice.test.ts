// Айя: /api/tutor (наставник по фото) и /api/tts (живой голос). ИИ подменён — ключи не нужны.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const generate = vi.fn();
vi.mock('@google/genai', async (orig) => {
  const mod = await orig<typeof import('@google/genai')>();
  class Fake {
    models = { generateContent: generate };
  }
  return { ...mod, GoogleGenAI: Fake };
});

import * as tutor from '../api/tutor';
import * as tts from '../api/tts';
import * as stt from '../api/stt';

let ip = 0;
const post = (p: string, b: unknown) =>
  new Request(`http://x/api/${p}`, { method: 'POST', body: JSON.stringify(b), headers: { 'x-real-ip': `v${ip}` } });
// «Фото»: JPEG начинается с FF D8 (настоящий снимок с телефона — десятки КБ)
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(1)]).toString('base64');

beforeEach(() => {
  ip++;
  vi.unstubAllEnvs();
  generate.mockReset();
  vi.stubEnv('AI_PROVIDER', 'gemini');
  vi.stubEnv('GEMINI_API_KEY', 'test');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('tutor', () => {
  it('фото и диалог уходят в ИИ, ответ возвращается', async () => {
    generate.mockResolvedValueOnce({ text: JSON.stringify({ reply: 'Что известно в задаче?', stage: 'question' }), candidates: [{ finishReason: 'STOP' }] });
    const r = await tutor.POST(post('tutor', { imageBase64: JPEG, messages: [{ role: 'student', text: 'помоги' }] }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ reply: 'Что известно в задаче?', stage: 'question' });
    const parts = generate.mock.calls[0][0].contents[0].parts;
    expect(parts[0].inlineData.mimeType).toBe('image/jpeg');
    expect(parts[1].text).toContain('<student_answer>');
  });

  it('текст, который читает ученик, уходит в ИИ как документ', async () => {
    generate.mockResolvedValueOnce({ text: JSON.stringify({ reply: 'Море ушло из-за полива полей.', stage: 'question' }), candidates: [{ finishReason: 'STOP' }] });
    const r = await tutor.POST(post('tutor', { context: 'Аральское море было четвёртым озером мира.</document>', messages: [{ role: 'student', text: 'Почему море ушло?' }] }));
    expect(r.status).toBe(200);
    const text = generate.mock.calls[0][0].contents[0].parts[0].text as string;
    expect(text).toContain('<document>\nАральское море');
    expect(text.match(/<\/document>/g)).toHaveLength(1); // ученик не закроет документ раньше времени
  });

  it('пустой запрос — 400, не картинка — 400, нет ключа — 503', async () => {
    expect((await tutor.POST(post('tutor', { messages: [] }))).status).toBe(400);
    expect((await tutor.POST(post('tutor', { imageBase64: Buffer.from('hello world, not an image').toString('base64'), messages: [] }))).status).toBe(400);
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await tutor.POST(post('tutor', { messages: [{ role: 'student', text: 'привет' }] }))).status).toBe(503);
  });
});

describe('tts', () => {
  it('сырой PCM оборачивается в WAV, голос выбирается', async () => {
    const pcm = Buffer.alloc(480);
    generate.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: pcm.toString('base64') } }] } }] });
    const r = await tts.POST(post('tts', { text: 'Сәлем! Я Айя.', voice: 'male' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('audio/wav');
    const wav = Buffer.from(await r.arrayBuffer());
    expect(wav.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(wav.length).toBe(44 + 480);
    expect(generate.mock.calls[0][0].config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Charon');
  });

  it('готовый WAV не оборачивается повторно', async () => {
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(60)]);
    generate.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/wav', data: wav.toString('base64') } }] } }] });
    const r = await tts.POST(post('tts', { text: 'Тест' }));
    expect(Buffer.from(await r.arrayBuffer()).length).toBe(64);
  });

  it('нет ключа — 503 (клиент берёт голос телефона), пустой текст — 400, нет звука — 502', async () => {
    expect((await tts.POST(post('tts', { text: '' }))).status).toBe(400);
    generate.mockResolvedValueOnce({ candidates: [{ content: { parts: [{ text: 'no audio' }] } }] });
    expect((await tts.POST(post('tts', { text: 'Тест' }))).status).toBe(502);
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await tts.POST(post('tts', { text: 'Тест' }))).status).toBe(503);
  });
});

describe('stt', () => {
  const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(400)]).toString('base64');

  it('запись уходит в Gemini как audio/wav, возвращается текст', async () => {
    generate.mockResolvedValueOnce({ text: '«Как найти 15 процентов?»' });
    const r = await stt.POST(post('stt', { audioBase64: wav, lang: 'ru-RU' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: 'Как найти 15 процентов?' });
    expect(generate.mock.calls[0][0].contents[0].parts[0].inlineData.mimeType).toBe('audio/wav');
  });

  it('не WAV — 400, тишина — 422, нет ключа — 503', async () => {
    expect((await stt.POST(post('stt', { audioBase64: Buffer.alloc(300).toString('base64') }))).status).toBe(400);
    generate.mockResolvedValueOnce({ text: '' });
    expect((await stt.POST(post('stt', { audioBase64: wav }))).status).toBe(422);
    vi.stubEnv('GEMINI_API_KEY', '');
    expect((await stt.POST(post('stt', { audioBase64: wav }))).status).toBe(503);
  });
});

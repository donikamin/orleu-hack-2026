// Голосовой ввод: нажал — говоришь — текст появляется в поле. Остановка сама, когда замолчал.
// Голос приложение ВСЕГДА записывает само (полоска громкости показывает, что тебя слышно). Параллельно работает
// встроенное распознавание браузера — оно даёт текст на лету. Если браузер ничего не распознал (так бывает
// в Edge на ПК, во встроенных браузерах, без доступа к серверам Google), запись распознаётся:
//   1) на сервере Oqy (/api/stt, Gemini), если есть интернет;
//   2) прямо на устройстве — Whisper base (≈ 75 МБ, один раз), без интернета.
// На Android второй поток с микрофона мешает встроенному распознаванию, поэтому там запись включается,
// только если браузерное распознавание уже подвело.

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void;
  onend: () => void;
  onerror: (e?: { error?: string }) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
const RecCtor: (new () => Rec) | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as { SpeechRecognition?: new () => Rec }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition)
    : undefined;

export const canListen = () => !!RecCtor || !!navigator.mediaDevices?.getUserMedia;

export type ListenState = 'idle' | 'listening' | 'recording' | 'recognizing';
export interface ListenHandlers {
  lang?: 'ru-RU' | 'kk-KZ';
  onState: (s: ListenState) => void;
  /** Распознанный текст по ходу речи. */
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  /** Служебные подсказки («Говори…», «Распознаю…») — не текст ученика. */
  onStatus?: (message: string) => void;
  /** Громкость с микрофона 0..1 — видно, что тебя слышно. */
  onLevel?: (level: number) => void;
}

const ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const KEY = 'oqy-stt-browser-broken';
let browserBroken = (() => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
function markBroken() {
  browserBroken = true;
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* приватный режим */
  }
}

const SPEECH = 0.1; // громкость, начиная с которой считаем, что человек говорит
const SILENCE_MS = 1200; // столько тишины после речи — фраза закончена
const NOBODY_MS = 8000; // никто не заговорил — выключаемся
const MAX_MS = 20_000;

/** Начать слушать. Возвращает функцию «стоп» (второе нажатие на микрофон). */
export function listen(h: ListenHandlers): () => void {
  let stopFn: () => void = () => {};
  let done = false;
  let recorder: Recorder | null = null;
  let browserText = '';
  let browserLive = false;
  let browserFailed = false;
  let r: Rec | null = null;

  const finish = async () => {
    if (done) return;
    done = true;
    r?.stop();
    const audio = recorder?.stop() ?? null;
    if (browserText) {
      h.onLevel?.(0);
      h.onFinal(browserText);
      return h.onState('idle');
    }
    // браузер ничего не дал — распознаём свою запись
    if (audio && audio.spoke) {
      if (RecCtor && !browserFailed) markBroken(); // в следующий раз сразу свой путь — быстрее
      h.onState('recognizing');
      h.onLevel?.(0);
      try {
        const text = await transcribe(audio.pcm16k, h.lang === 'kk-KZ' ? 'kk' : 'ru', (s) => h.onStatus?.(s));
        if (!text) throw new Error('Не разобрал слова. Скажи ещё раз чуть громче и ближе к микрофону');
        h.onPartial(text);
        h.onFinal(text);
      } catch (e) {
        h.onPartial('');
        h.onError((e as Error).message);
      }
      return h.onState('idle');
    }
    h.onLevel?.(0);
    h.onPartial('');
    if (!recorder && browserLive) {
      // Android: распознавание браузера промолчало — в следующий раз пишем голос сами
      markBroken();
      h.onError('Не расслышал. Нажми микрофон ещё раз — включу другой способ распознавания');
    } else if (audio && !audio.spoke) {
      h.onError('Не слышу тебя: микрофон молчит. Проверь, что он не выключен, и говори ближе');
    }
    h.onState('idle');
  };

  // 1) своя запись: громкость, автостоп по тишине, запасное распознавание
  const wantRecorder = !RecCtor || browserBroken || !ANDROID;
  if (wantRecorder) {
    recorder = new Recorder(h, () => void finish());
    void recorder.start().then((ok) => {
      if (!ok && !browserLive) {
        done = true;
        h.onState('idle');
      }
    });
  }

  // 2) встроенное распознавание браузера — текст по ходу речи
  if (RecCtor && !browserBroken) {
    r = new RecCtor();
    r.lang = h.lang ?? 'ru-RU';
    r.interimResults = true;
    r.continuous = true;
    let silence: number | undefined;
    r.onresult = (e) => {
      if (done) return; // поздний результат после остановки не должен вернуть текст в поле
      browserText = Array.from(e.results).map((x) => x[0].transcript).join(' ').replace(/\s+/g, ' ').trim();
      if (browserText) h.onPartial(browserText);
      if (!recorder) {
        window.clearTimeout(silence);
        silence = window.setTimeout(() => void finish(), SILENCE_MS + 200);
      }
    };
    r.onerror = (e) => {
      const why = e?.error;
      if (why === 'no-speech' || why === 'aborted') return;
      browserFailed = true;
      if (why === 'not-allowed' && !recorder) {
        done = true;
        h.onError('Нет доступа к микрофону. Нажми на замок у адреса сайта → Микрофон → Разрешить');
        return h.onState('idle');
      }
      markBroken(); // network / service-not-allowed / language-not-supported — дальше только свой путь
    };
    r.onend = () => {
      browserLive = false;
      window.clearTimeout(silence);
      // без своей записи конец распознавания = конец фразы; со своей — ждём тишины в записи
      if (!recorder || browserText) void finish();
    };
    try {
      r.start();
      browserLive = true;
    } catch {
      r = null;
      markBroken();
      if (!recorder) {
        recorder = new Recorder(h, () => void finish());
        void recorder.start();
      }
    }
    if (!recorder) window.setTimeout(() => !browserText && !done && r?.stop(), NOBODY_MS);
  }

  h.onState(recorder ? 'recording' : 'listening');
  h.onStatus?.('Слушаю… говори, я остановлюсь сам, когда замолчишь');
  stopFn = () => void finish();
  return () => stopFn();
}

/* ---------- своя запись с микрофона ---------- */

class Recorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private chunks: Float32Array[] = [];
  private spoke = false;
  private noise = 0.05;
  private quietSince = 0;
  private started = 0;
  private timer: number | undefined;
  private stopped = false;
  constructor(private h: ListenHandlers, private onAutoStop: () => void) {}

  async start(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.h.onError('Этот браузер не даёт доступ к микрофону. Напиши вопрос текстом внизу');
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      this.h.onError('Нет доступа к микрофону. Нажми на замок у адреса сайта → Микрофон → Разрешить');
      return false;
    }
    if (this.stopped) {
      this.stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    const ctx = (this.ctx = new AudioContext());
    const src = ctx.createMediaStreamSource(this.stream);
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    this.started = this.quietSince = performance.now();
    proc.onaudioprocess = (e) => {
      if (this.stopped) return;
      const data = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i += 2) sum += data[i] * data[i];
      const level = Math.min(1, Math.sqrt(sum / (data.length / 2)) * 7);
      this.h.onLevel?.(level);
      const now = performance.now();
      // уровень шума класса подстраивается сам: речь — заметно громче фона
      if (level < this.noise * 2) this.noise = this.noise * 0.95 + level * 0.05;
      if (level > Math.max(SPEECH, this.noise * 2.5)) {
        this.spoke = true;
        this.quietSince = now;
      } else if (this.spoke && now - this.quietSince > SILENCE_MS) this.onAutoStop();
      else if (!this.spoke && now - this.started > NOBODY_MS) this.onAutoStop();
    };
    src.connect(proc);
    proc.connect(ctx.destination);
    this.timer = window.setTimeout(() => this.onAutoStop(), MAX_MS);
    return true;
  }

  /** Остановить запись. Возвращает звук 16 кГц и то, был ли в нём голос. */
  stop(): { pcm16k: Float32Array; spoke: boolean } | null {
    if (this.stopped) return null;
    this.stopped = true;
    window.clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    const rate = this.ctx?.sampleRate ?? 48000;
    void this.ctx?.close();
    if (!this.ctx) return null;
    return { pcm16k: downsample(this.chunks, rate), spoke: this.spoke };
  }
}

function downsample(chunks: Float32Array[], inRate: number, outRate = 16000): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  const ratio = inRate / outRate;
  const out = new Float32Array(Math.floor(total / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(total, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let k = from; k < to; k++) s += all[k];
    out[i] = s / Math.max(1, to - from);
  }
  return out;
}

function wav16k(pcm: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const d = new DataView(buf);
  const w = (p: number, s: string) => [...s].forEach((ch, i) => d.setUint8(p + i, ch.charCodeAt(0)));
  w(0, 'RIFF');
  d.setUint32(4, 36 + pcm.length * 2, true);
  w(8, 'WAVEfmt ');
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, 16000, true);
  d.setUint32(28, 32000, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  w(36, 'data');
  d.setUint32(40, pcm.length * 2, true);
  const out = new Int16Array(buf, 44);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/* ---------- распознавание записи: сервер → устройство ---------- */

let serverDown = false;

async function viaServer(pcm: Float32Array, lang: 'ru' | 'kk'): Promise<string | null> {
  if (serverDown || !navigator.onLine) return null;
  const b64 = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] ?? '');
    fr.onerror = rej;
    fr.readAsDataURL(wav16k(pcm));
  });
  try {
    const r = await fetch('/api/stt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audioBase64: b64, lang: lang === 'kk' ? 'kk-KZ' : 'ru-RU' }),
      signal: AbortSignal.timeout(12_000),
    });
    const j = (await r.json().catch(() => ({}))) as { text?: string };
    if (r.status === 503 || r.status === 404) serverDown = true; // ключа нет — дальше сразу на устройстве
    return r.ok && j.text ? j.text : null;
  } catch {
    return null;
  }
}

let sttWorker: Worker | null = null;
let sttSeq = 0;
const sttWait = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();
let onProgress: ((s: string) => void) | null = null;

function getSttWorker() {
  if (sttWorker) return sttWorker;
  sttWorker = new Worker(new URL('./stt.worker.ts', import.meta.url), { type: 'module' });
  // файл распознавания не скачан, а сети нет — не висим на «Распознаю…»
  sttWorker.onerror = () => {
    const err = new Error('Распознаванию на устройстве нужен интернет один раз. Подключись к Wi-Fi или напиши вопрос текстом');
    sttWait.forEach((w) => w.reject(err));
    sttWait.clear();
    sttWorker = null;
  };
  sttWorker.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; id?: number; text?: string; message?: string; progress?: number; mb?: number };
    if (m.type === 'progress') onProgress?.(`Скачиваю распознавание речи на устройство (один раз, ${m.mb || 75} МБ): ${Math.round((m.progress ?? 0) * 100)}%`);
    else if (m.type === 'text' && m.id) {
      sttWait.get(m.id)?.resolve(m.text ?? '');
      sttWait.delete(m.id);
    } else if (m.type === 'error') {
      const err = new Error(/fetch|network/i.test(m.message ?? '') ? 'Распознаванию на устройстве нужен интернет один раз — скачать модель. Подключись к Wi-Fi или напиши вопрос текстом' : 'Не получилось распознать речь. Напиши вопрос текстом внизу');
      if (m.id) {
        sttWait.get(m.id)?.reject(err);
        sttWait.delete(m.id);
      } else sttWait.forEach((w) => w.reject(err));
    }
  };
  return sttWorker;
}

// Whisper иногда «слышит» в шуме фразы из субтитров — их не считаем речью
const HALLUCINATION = /^(продолжение следует|субтитры|спасибо за просмотр|редактор субтитров|подписывайтесь)/i;

function viaDevice(pcm: Float32Array, lang: 'ru' | 'kk', status: (s: string) => void): Promise<string> {
  onProgress = status;
  const id = ++sttSeq;
  return new Promise((resolve, reject) => {
    sttWait.set(id, { resolve, reject });
    getSttWorker().postMessage({ type: 'run', id, audio: pcm, lang }, [pcm.buffer]);
  });
}

export async function transcribe(pcm: Float32Array, lang: 'ru' | 'kk', status: (s: string) => void): Promise<string> {
  status('Распознаю речь…');
  const server = await viaServer(pcm, lang);
  if (server) return server;
  status('Распознаю речь на устройстве…');
  const text = (await viaDevice(pcm, lang, status)).replace(/^[\s.…,-]+|[\s…-]+$/g, '').trim();
  return HALLUCINATION.test(text) ? '' : text;
}

/** Заранее скачать распознавание на устройство (кнопка «Слышать без интернета»). */
export function preloadDeviceStt(status: (s: string) => void): Promise<void> {
  onProgress = status;
  return new Promise((resolve, reject) => {
    const w = getSttWorker();
    const prev = w.onmessage;
    w.onmessage = (e) => {
      const m = e.data as { type: string; message?: string };
      if (m.type === 'ready') {
        w.onmessage = prev;
        resolve();
      } else if (m.type === 'error' && !('id' in m && (m as { id?: number }).id)) {
        w.onmessage = prev;
        reject(new Error(m.message));
      } else prev?.call(w, e);
    };
    w.postMessage({ type: 'load' });
  });
}

/** Если браузер уже подвёл и модель скачана — заранее поднимаем её с диска, чтобы первый ответ был быстрым. */
export async function warmUpDeviceStt() {
  if (RecCtor && !browserBroken) return;
  try {
    const keys = await (await caches.open('transformers-cache')).keys();
    if (keys.some((k) => k.url.includes('whisper-base'))) await preloadDeviceStt(() => {});
  } catch {
    /* нет кэша — скачается при первом вопросе */
  }
}
// Озвучка: сначала живой голос ИИ (Gemini TTS через /api/tts), иначе голос телефона (Web Speech API).
// Живой голос идёт по одному предложению: первое звучит через 1–2 с, следующее грузится, пока играет текущее.
// Каждое предложение кэшируется на телефоне (Cache API): повторно текст звучит без интернета.
// На 2G и в режиме экономии трафика сразу берётся голос телефона — он ничего не скачивает.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { isKazakh, kkForRussianVoice } from './knowledge';

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
const CACHE = 'oqy-voice-v2';

/* ---------- настройки голоса ---------- */
export type VoicePref = 'auto' | 'device';
export type VoiceGender = 'female' | 'male';
const PREF_KEY = 'oqy-voice';
export function getVoicePref(): { pref: VoicePref; gender: VoiceGender } {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') as { pref?: VoicePref; gender?: VoiceGender };
    return { pref: v.pref === 'device' ? 'device' : 'auto', gender: v.gender === 'male' ? 'male' : 'female' };
  } catch {
    return { pref: 'auto', gender: 'female' };
  }
}
export function setVoicePref(v: { pref: VoicePref; gender: VoiceGender }) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(v));
  } catch {
    /* приватный режим */
  }
}

function slowNet() {
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  return !!c && (c.saveData === true || /2g$/.test(c.effectiveType ?? ''));
}

/* ---------- «говорит ли сейчас кто-то» — для анимации аватара ---------- */
let speaking = false;
const speakListeners = new Set<() => void>();
function setSpeaking(v: boolean) {
  if (speaking === v) return;
  speaking = v;
  speakListeners.forEach((l) => l());
}
export function useSpeaking() {
  return useSyncExternalStore(
    (cb) => {
      speakListeners.add(cb);
      return () => speakListeners.delete(cb);
    },
    () => speaking,
    () => false,
  );
}

/* ---------- живой голос с сервера ---------- */
let cloudDown = false; // сервер не ответил — до перезагрузки не мучаем сеть

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(36)}${s.length.toString(36)}`;
}

/** Живой голос для 3D-аватара: звук одного предложения или null (нет сети, 2G, выбран голос телефона, сервер молчит). */
export async function voiceBlob(text: string): Promise<Blob | null> {
  const { pref, gender } = getVoicePref();
  if (pref === 'device') return null;
  try {
    const url = await cloudUrl(text, gender, !slowNet());
    const b = await (await fetch(url)).blob();
    URL.revokeObjectURL(url);
    return b;
  } catch {
    return null;
  }
}

async function cloudUrl(text: string, gender: VoiceGender, allowNet = true): Promise<string> {
  const key = `/voice-cache/${gender}/${hash(text)}`;
  try {
    const hit = await (await caches.open(CACHE)).match(key);
    if (hit) return URL.createObjectURL(await hit.blob());
  } catch {
    /* Cache API недоступен — просто без кэша */
  }
  if (!allowNet) throw new Error('slow');
  if (cloudDown || !navigator.onLine) throw new Error('offline');
  const r = await fetch('/api/tts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, voice: gender, lang: isKazakh(text) ? 'kk' : 'ru' }) });
  if (!r.ok || !r.headers.get('content-type')?.includes('audio')) {
    cloudDown = true;
    throw new Error(`tts ${r.status}`);
  }
  const blob = await r.blob();
  try {
    await (await caches.open(CACHE)).put(key, new Response(blob, { headers: { 'content-type': r.headers.get('content-type') ?? 'audio/mpeg' } }));
  } catch {
    /* нет места — не страшно */
  }
  return URL.createObjectURL(blob);
}

/* ---------- голос телефона ---------- */
// Имена голосов Windows/Edge, Android, macOS/iOS. Google «русский» — женский.
const FEMALE = /(svetlana|dariya|irina|milena|ekaterina|katya|anna|alena|aigul|madina|google)/i;
const MALE = /(dmitry|pavel|maxim|yuri|daulet|artem|aleksandr)/i;

/** Голос по полу: сначала нужный пол, внутри — самый естественный (нейросетевой). */
function score(v: SpeechSynthesisVoice, gender: VoiceGender) {
  const n = v.name.toLowerCase();
  let s = 0;
  const isF = FEMALE.test(n);
  const isM = MALE.test(n);
  if (gender === 'female' ? isF : isM) s += 100;
  else if (gender === 'female' ? isM : isF) s -= 100;
  if (/natural|neural|online/.test(n)) s += 10;
  if (/google/.test(n)) s += 6;
  if (v.localService) s += 1;
  return s;
}
export function deviceVoices(lang: 'ru' | 'kk', gender: VoiceGender = getVoicePref().gender) {
  if (!synth) return [];
  const all = synth.getVoices();
  const mine = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const list = mine.length ? mine : all.filter((v) => v.lang.toLowerCase().startsWith('ru'));
  return [...list].sort((a, b) => score(b, gender) - score(a, gender));
}
/**
 * Реплика для голоса телефона. Казахский текст читает казахский голос (Edge: Aigul/Daulet, Android: kk-KZ),
 * а если его нет — русский голос по «казахской» транскрипции: «сәлем» звучит как «сэлем», а не «слим».
 */
export function deviceUtterance(text: string, o: { lang?: 'ru' | 'kk'; voice?: SpeechSynthesisVoice; rate?: number } = {}) {
  const kk = o.lang === 'kk' || isKazakh(text);
  const kkVoice = kk ? (synth?.getVoices() ?? []).filter((v) => v.lang.toLowerCase().startsWith('kk')) : [];
  const g = getVoicePref().gender;
  const v = kk && kkVoice.length ? [...kkVoice].sort((a, b) => score(b, g) - score(a, g))[0] : (o.voice ?? deviceVoices('ru')[0]);
  const native = !!v && v.lang.toLowerCase().startsWith('kk');
  const u = new SpeechSynthesisUtterance(kk && !native ? kkForRussianVoice(text) : text);
  if (v) u.voice = v;
  u.lang = v?.lang ?? (kk ? 'kk-KZ' : 'ru-RU');
  u.rate = (o.rate ?? 1) * (kk && !native ? 0.92 : 1); // чужой голос на казахском — чуть медленнее, разборчивее
  return u;
}

export function useVoices(lang: 'ru' | 'kk') {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => deviceVoices(lang));
  useEffect(() => {
    if (!synth) return;
    const load = () => setVoices(deviceVoices(lang));
    load();
    synth.addEventListener('voiceschanged', load);
    return () => synth.removeEventListener('voiceschanged', load);
  }, [lang]);
  return voices;
}

/* ---------- чтец: один на всё приложение, новый запуск останавливает прежний ---------- */
type State = 'idle' | 'loading' | 'playing' | 'paused';
export type Source = 'cloud' | 'device' | null;
interface Hooks {
  state: (s: State) => void;
  current: (i: number) => void;
  source: (s: Source) => void;
}
let active: Narrator | null = null;

class Narrator {
  private token = 0;
  private audio: HTMLAudioElement | null = null;
  constructor(private hooks: Hooks) {}

  stop() {
    this.token++;
    this.audio?.pause();
    this.audio = null;
    synth?.cancel();
    setSpeaking(false);
    this.hooks.current(-1);
    this.hooks.state('idle');
  }

  pause() {
    if (this.audio) this.audio.pause();
    else synth?.pause();
    setSpeaking(false);
    this.hooks.state('paused');
  }

  resume() {
    if (this.audio) void this.audio.play();
    else synth?.resume();
    setSpeaking(true);
    this.hooks.state('playing');
  }

  play(sentences: string[], start: number, o: { lang: 'ru' | 'kk'; rate: number; voice?: SpeechSynthesisVoice }) {
    if (active && active !== this) active.stop();
    active = this;
    this.stop();
    const my = ++this.token;
    const { pref, gender } = getVoicePref();
    const cloud = pref === 'auto' && !cloudDown && navigator.onLine && !slowNet();
    const pending = new Map<number, Promise<string | null>>();
    const fetchAt = (i: number) => {
      if (i >= sentences.length) return;
      if (!pending.has(i)) pending.set(i, cloudUrl(sentences[i], gender).catch(() => null));
      return pending.get(i);
    };
    const alive = () => my === this.token;

    const done = () => {
      if (!alive()) return;
      this.audio = null;
      setSpeaking(false);
      this.hooks.current(-1);
      this.hooks.state('idle');
    };

    const device = (i: number) => {
      if (!synth) return done();
      const u = deviceUtterance(sentences[i], { lang: o.lang, voice: o.voice, rate: o.rate });
      u.onstart = () => {
        if (!alive()) return;
        this.hooks.current(i);
        this.hooks.source('device');
        this.hooks.state('playing');
        setSpeaking(true);
      };
      u.onend = () => run(i + 1);
      u.onerror = () => alive() && done();
      synth.speak(u);
    };

    const run = async (i: number) => {
      if (!alive()) return;
      if (i >= sentences.length) return done();
      if (cloud && !cloudDown) {
        const url = await fetchAt(i);
        if (!alive()) return;
        if (url) {
          void fetchAt(i + 1); // следующее грузится, пока звучит текущее
          const a = new Audio(url);
          a.playbackRate = o.rate;
          this.audio = a;
          a.onended = () => {
            URL.revokeObjectURL(url);
            void run(i + 1);
          };
          a.onerror = () => device(i);
          this.hooks.current(i);
          this.hooks.source('cloud');
          this.hooks.state('playing');
          setSpeaking(true);
          try {
            await a.play();
          } catch {
            this.audio = null;
            device(i);
          }
          return;
        }
      }
      this.audio = null;
      device(i);
    };

    this.hooks.state(cloud ? 'loading' : 'playing');
    void run(start);
  }
}

/** Читает предложения по очереди и сообщает, какое сейчас звучит (для подсветки). */
export function useSpeaker(sentences: string[], lang: 'ru' | 'kk') {
  const voices = useVoices(lang);
  const [voiceName, setVoiceName] = useState('');
  const [rate, setRate] = useState(1);
  const [current, setCurrent] = useState(-1);
  const [state, setState] = useState<State>('idle');
  const [source, setSource] = useState<Source>(null);
  const n = useRef<Narrator | null>(null);
  if (!n.current) n.current = new Narrator({ state: setState, current: setCurrent, source: setSource });
  const voice = voices.find((v) => v.name === voiceName);

  const stop = useCallback(() => n.current?.stop(), []);
  const playFrom = useCallback((start: number) => n.current?.play(sentences, start, { lang, rate, voice }), [sentences, lang, rate, voice]);
  const toggle = useCallback(() => {
    if (state === 'playing' || state === 'loading') n.current?.pause();
    else if (state === 'paused') n.current?.resume();
    else playFrom(0);
  }, [state, playFrom]);

  useEffect(() => () => n.current?.stop(), []);

  return { supported: true, voices, voice: voice ?? voices[0], setVoiceName, rate, setRate, current, state, source, toggle, stop, playFrom };
}

/** Сказать одну реплику (аватар, ответ наставника). */
export function useSay(lang: 'ru' | 'kk' = 'ru') {
  const [state, setState] = useState<State>('idle');
  const [source, setSource] = useState<Source>(null);
  const n = useRef<Narrator | null>(null);
  if (!n.current) n.current = new Narrator({ state: setState, current: () => {}, source: setSource });
  useEffect(() => () => n.current?.stop(), []);
  const say = useCallback((text: string) => n.current?.play(splitSentences(text), 0, { lang, rate: 1 }), [lang]);
  const stop = useCallback(() => n.current?.stop(), []);
  return { say, stop, state, source };
}

export function splitSentences(text: string) {
  return text.match(/[^.!?…]+[.!?…]+[»"]?|\S[^.!?…]*$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

export function SourceBadge({ source }: { source: Source }) {
  if (!source) return null;
  return <span className={`voice-src ${source === 'cloud' ? 'voice-src--cloud' : ''}`}>{source === 'cloud' ? 'Живой голос ИИ' : 'Голос телефона'}</span>;
}

/** Компактная кнопка «Слушать» для текста задания. */
export function Speak({ text, lang }: { text: string; lang: 'ru' | 'kk'; compact?: boolean }) {
  const sentences = useState(() => splitSentences(text))[0];
  const sp = useSpeaker(sentences, lang);
  const on = sp.state === 'playing' || sp.state === 'loading';
  return (
    <button type="button" onClick={sp.toggle} aria-label={on ? 'Пауза' : 'Слушать текст'} className="voice-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {on ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4v16l13-8z" />}
      </svg>
      {sp.state === 'loading' ? 'Загружаю голос…' : on ? 'Пауза' : sp.state === 'paused' ? 'Дальше' : 'Слушать'}
    </button>
  );
}

// Локальный ИИ прямо на телефоне или ноутбуке: языковая модель Qwen 2.5 (Apache 2.0) через WebLLM и WebGPU.
// Скачивается один раз по Wi-Fi (школа, дом), хранится в браузере и дальше отвечает на любой вопрос БЕЗ интернета.
// Работает в отдельном потоке (llm.worker.ts), поэтому интерфейс и 3D-ответчик не подвисают, пока модель думает.
// Не входит в офлайн-набор приложения (1,1 МБ): ученик сам решает, качать ли модель.
import { useSyncExternalStore } from 'react';
import { factsFor } from './facts';

export const MODELS = {
  lite: { id: 'Qwen2.5-0.5B-Instruct', name: 'Лёгкий', size: '≈ 300 МБ', note: 'для телефона: быстро, отвечает проще' },
  smart: { id: 'Qwen2.5-1.5B-Instruct', name: 'Умный', size: '≈ 900 МБ', note: 'для ноутбука или нового телефона: точнее' },
} as const;
export type ModelKey = keyof typeof MODELS;

export type LlmPhase = 'unsupported' | 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
export interface LlmState {
  phase: LlmPhase;
  gpu: boolean | null; // есть ли WebGPU (null — ещё проверяем)
  model: ModelKey;
  cached: Partial<Record<ModelKey, boolean>>;
  progress: number; // 0..1
  note: string;
  speed?: number; // токенов в секунду в последнем ответе
}

const PREF = 'oqy-llm';
// на телефоне по умолчанию лёгкая модель, на ноутбуке — умная (заметно точнее по-русски)
const PHONE = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);
function readPref(): { model: ModelKey; only: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(PREF) ?? '{}') as { model?: ModelKey; only?: boolean };
    return { model: v.model === 'smart' || v.model === 'lite' ? v.model : PHONE ? 'lite' : 'smart', only: v.only === true };
  } catch {
    return { model: PHONE ? 'lite' : 'smart', only: false };
  }
}
function writePref(p: { model: ModelKey; only: boolean }) {
  try {
    localStorage.setItem(PREF, JSON.stringify(p));
  } catch {
    /* приватный режим */
  }
}

let state: LlmState = { phase: 'idle', gpu: null, model: readPref().model, cached: {}, progress: 0, note: '' };
const listeners = new Set<() => void>();
function set(p: Partial<LlmState>) {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}
export function useLlm() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      void probe();
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
export const llmState = () => state;

/* ---------- WebGPU и поток модели ---------- */
let f16 = false;
let worker: Worker | null = null;
let probed: Promise<void> | null = null;
const waiters = new Map<number, { onText: (t: string) => void; resolve: (t: string) => void; reject: (e: Error) => void }>();
let readyWait: { resolve: () => void; reject: (e: Error) => void } | null = null;
let seq = 0;

const fullId = (k: ModelKey) => `${MODELS[k].id}-${f16 ? 'q4f16_1' : 'q4f32_1'}-MLC`;

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data as { type: string; [k: string]: unknown };
    if (m.type === 'cached') {
      const byId = m.models as Record<string, boolean>;
      set({ cached: { lite: !!byId[fullId('lite')], smart: !!byId[fullId('smart')] } });
    } else if (m.type === 'progress') {
      // уже скачана — это загрузка с диска (секунды), иначе — первое скачивание
      set({ phase: state.cached[state.model] ? 'loading' : 'downloading', progress: Number(m.progress ?? 0), note: String(m.text ?? '').replace(/\s+/g, ' ').slice(0, 90) });
    } else if (m.type === 'ready') {
      set({ phase: 'ready', progress: 1, note: '', cached: { ...state.cached, [state.model]: true } });
      readyWait?.resolve();
      readyWait = null;
    } else if (m.type === 'token') {
      waiters.get(m.id as number)?.onText(String(m.text));
    } else if (m.type === 'done') {
      const w = waiters.get(m.id as number);
      waiters.delete(m.id as number);
      set({ speed: Math.round(Number(m.tokensPerSec ?? 0)) });
      w?.resolve(String(m.text));
    } else if (m.type === 'deleted') {
      set({ phase: 'idle', progress: 0, cached: { ...state.cached, [state.model]: false } });
    } else if (m.type === 'error') {
      const err = new Error(friendly(String(m.message)));
      if (typeof m.id === 'number') {
        waiters.get(m.id)?.reject(err);
        waiters.delete(m.id);
      } else {
        set({ phase: 'error', note: err.message });
        readyWait?.reject(err);
        readyWait = null;
      }
    }
  };
  return worker;
}

function friendly(msg: string) {
  if (/quota|storage|space/i.test(msg)) return 'Не хватает места в памяти браузера. Освободи место или выбери «Лёгкий»';
  if (/network|fetch|failed to fetch/i.test(msg)) return 'Скачивание прервалось — нет интернета. Подключись к Wi-Fi и нажми ещё раз, докачается';
  if (/device|adapter|gpu|webgpu/i.test(msg)) return 'Видеокарта устройства не справилась с моделью. Попробуй «Лёгкий»';
  return msg.slice(0, 160);
}

/** Проверяем WebGPU и что уже скачано. Ничего не качает. */
export function probe() {
  if (probed) return probed;
  probed = (async () => {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<{ features: Set<string> } | null> } }).gpu;
    const adapter = await gpu?.requestAdapter().catch(() => null);
    if (!adapter) {
      set({ gpu: false, phase: 'unsupported' });
      return;
    }
    f16 = adapter.features.has('shader-f16');
    set({ gpu: true });
    getWorker().postMessage({ type: 'cached', models: [fullId('lite'), fullId('smart')] });
  })();
  return probed;
}

export function chooseModel(k: ModelKey) {
  if (state.phase === 'downloading' || state.phase === 'loading') return;
  writePref({ ...readPref(), model: k });
  set({ model: k, phase: state.phase === 'ready' ? 'idle' : state.phase, progress: 0 });
}

/** Скачать (первый раз) или поднять с диска выбранную модель. */
export async function loadModel(): Promise<void> {
  await probe();
  if (!state.gpu) throw new Error('На этом устройстве нет WebGPU — локальный ИИ не запустится. Подойдёт Chrome или Edge на ноутбуке либо новом Android');
  if (state.phase === 'ready') return;
  if (readyWait) return new Promise((resolve, reject) => {
    const prev = readyWait!;
    readyWait = { resolve: () => (prev.resolve(), resolve()), reject: (e) => (prev.reject(e), reject(e)) };
  });
  set({ phase: state.cached[state.model] ? 'loading' : 'downloading', progress: 0, note: '' });
  // просим браузер не удалять скачанную модель при нехватке места
  void navigator.storage?.persist?.().catch(() => false);
  return new Promise((resolve, reject) => {
    readyWait = { resolve, reject };
    getWorker().postMessage({ type: 'load', model: fullId(state.model) });
  });
}

export function deleteModel() {
  getWorker().postMessage({ type: 'delete', model: fullId(state.model) });
}

/** Готов ли локальный ИИ ответить прямо сейчас (или поднимется с диска за несколько секунд). */
export const llmAvailable = () => state.phase === 'ready' || (!!state.gpu && !!state.cached[state.model]);
export const onlyLocal = () => readPref().only;
export function setOnlyLocal(v: boolean) {
  writePref({ ...readPref(), only: v });
  listeners.forEach((l) => l());
}

export const TUTOR_SYSTEM =
  'Ты — ИИ-ответчик Оқу, доброжелательный помощник ученика 7–9 класса сельской школы Казахстана. ' +
  'Отвечай коротко: 2–4 предложения, простыми словами, без списков и разметки. ' +
  'Отвечай на языке вопроса: по-русски или по-казахски. ' +
  'Если ученик просит решить школьную задачу или тест — не называй готовый ответ: объясни первый шаг и задай один наводящий вопрос. ' +
  'На вопросы о мире, словах, людях и понятиях отвечай прямо. Если дана «Справка», опирайся только на неё. ' +
  'Не выдумывай имена, даты и числа: если не знаешь точно, честно скажи «Точно не знаю, проверь в учебнике» и подскажи, где искать.';

export interface LocalTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Ответ локального ИИ. onText получает текст по мере генерации — ответ «печатается» на глазах. */
export async function askLocal(history: LocalTurn[], context: { title: string; body: string } | null, onText: (t: string) => void): Promise<string> {
  await loadModel();
  const q = [...history].reverse().find((t) => t.role === 'user')?.content ?? '';
  const facts = factsFor(q);
  let system = TUTOR_SYSTEM;
  if (facts) system += `

Справка (проверенные сведения):
${facts}`;
  if (context) system += `

Ученик сейчас читает текст «${context.title}»:
${context.body.slice(0, 1800)}`;
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiters.set(id, { onText, resolve: (t) => resolve(wholeSentences(t)), reject });
    getWorker().postMessage({ type: 'chat', id, maxTokens: 280, messages: [{ role: 'system', content: system }, ...history.slice(-6)] });
  });
}

export function stopLocal() {
  worker?.postMessage({ type: 'stop' });
}

/** Ответ оборвался на лимите слов — обрезаем до последнего законченного предложения. */
export function wholeSentences(t: string) {
  const s = t.trim();
  if (/[.!?…»)]$/.test(s)) return s;
  const cut = Math.max(s.lastIndexOf('. '), s.lastIndexOf('! '), s.lastIndexOf('? '));
  return cut > 40 ? s.slice(0, cut + 1) : s;
}

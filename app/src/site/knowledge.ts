// Знания «обо всём» без ключа ИИ: вопросы «кто такой…», «что такое…», «расскажи про…» ищутся в Википедии
// (бесплатный открытый API, работает при любом интернете). Ответ — 2–3 предложения + источник.
// Ответы кэшируются на телефоне: повторный вопрос отвечается и без сети.

const CACHE_KEY = 'oqy-wiki-cache';
const KK_LETTERS = /[әғқңөұүһі]/i;
// \b в JS не работает с кириллицей — границы слова задаём явно
const KK_WORDS = /(^|[\s,!?.])(сәлем|салем|салам|қалай|қалайсың|рахмет|рақмет|кім|неге|қайда|қашан|сен|мен|бұл|туралы|айтшы|дегеніміз)(?=$|[\s,!?.])/i;

/** Похоже ли на казахский: особые буквы или частые слова. */
export function isKazakh(text: string) {
  return KK_LETTERS.test(text) || KK_WORDS.test(text);
}

const ASK = [
  /^(?:а\s+)?(?:кто|что)\s+(?:такой|такая|такое|такие|был|была|было|были|является)\s+(.+?)[?!.]*$/i,
  /^(?:расскажи|расскажите|напиши)\s+(?:мне\s+)?(?:про|о|об)\s+(.+?)[?!.]*$/i,
  /^(?:что\s+значит|что\s+означает)\s+(.+?)[?!.]*$/i,
  /^(?:где\s+находится|где\s+находятся)\s+(.+?)[?!.]*$/i,
  /^(?:когда\s+(?:был|была|было|жил|жила|родился|родилась))\s+(.+?)[?!.]*$/i,
  /^(.+?)\s+(?:кім|деген\s+не|дегеніміз\s+не)[?!.]*$/i, // «Абай кім?», «фотосинтез деген не?»
  /^(.+?)\s+туралы\s+айтшы[?!.]*$/i,
];

/** Тема вопроса «кто такой Х» → «Х», иначе null. */
export function knowledgeTopic(q: string): string | null {
  const t = q.trim();
  for (const re of ASK) {
    const m = re.exec(t);
    if (m && m[1] && m[1].length <= 80) return m[1].replace(/^(это|этот|эта)\s+/i, '').trim();
  }
  return null;
}

function cacheGet(key: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, string>)[key] ?? null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, value: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, string>;
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]];
    all[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* нет места */
  }
}

function firstSentences(text: string, n = 3, max = 420) {
  // убираем скобки и знаки ударения Википедии («До́нальд»), чтобы голос читал ровно
  const ss = text.replace(/́/g, '').replace(/\s*\([^()]*\)/g, '').replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = '';
  for (const s of ss.slice(0, n)) {
    if ((out + s).length > max) break;
    out += s;
  }
  return (out || ss[0]).trim();
}

async function wiki(lang: 'ru' | 'kk', topic: string, signal: AbortSignal): Promise<{ title: string; text: string } | null> {
  const base = `https://${lang}.wikipedia.org`;
  // полнотекстовый поиск по релевантности: «Абай» → «Абай Кунанбаев», а не страница-список значений
  const s = await fetch(`${base}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&srlimit=4&srprop=&format=json&origin=*`, { signal });
  const titles = ((await s.json()) as { query?: { search?: { title: string }[] } }).query?.search?.map((x) => x.title) ?? [];
  for (const title of titles) {
    const r = await fetch(`${base}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, { signal });
    if (!r.ok) continue;
    const j = (await r.json()) as { title?: string; extract?: string; type?: string };
    if (!j.extract || j.type === 'disambiguation' || /может означать|мағыналары/i.test(j.extract)) continue;
    return { title: j.title ?? title, text: firstSentences(j.extract) };
  }
  return null;
}

/** Ответ из Википедии на вопрос «кто такой / что такое …» или null, если тема не найдена / нет сети. */
export async function askKnowledge(question: string): Promise<string | null> {
  const topic = knowledgeTopic(question);
  if (!topic) return null;
  const kk = isKazakh(question);
  const key = `${kk ? 'kk' : 'ru'}:${topic.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (!navigator.onLine) return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 7000);
  try {
    const found = (kk ? await wiki('kk', topic, ctrl.signal).catch(() => null) : null) ?? (await wiki('ru', topic, ctrl.signal));
    if (!found) return null;
    const answer = `${found.text} ${kk ? 'Дереккөз — Уикипедия.' : 'Источник — Википедия, статья «' + found.title + '».'}`;
    cacheSet(key, answer);
    return answer;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Для озвучки: название приложения произносится по-казахски — «Оқу», а не «оки». */
export function sayable(text: string) {
  return text.replace(/\bOqy\b/gi, 'Оқу');
}

// Казахские звуки для русского голоса телефона: каждая буква → ближайшая по звучанию русская.
// Замена строго «буква на букву», чтобы не сбить синхронизацию губ по позициям слов.
const KK_SOUND: Record<string, string> = { ә: 'э', Ә: 'Э', ғ: 'г', Ғ: 'Г', қ: 'к', Қ: 'К', ң: 'н', Ң: 'Н', ұ: 'у', Ұ: 'У', һ: 'х', Һ: 'Х', і: 'и', І: 'И' };
const KK_SOFT: Record<string, [string, string]> = { ө: ['ё', 'о'], Ө: ['Ё', 'О'], ү: ['ю', 'у'], Ү: ['Ю', 'У'] };

/** «Сәлем, қалайсың?» → «Сэлем, калайсын?» — так русский голос произносит казахский текст почти верно. */
export function kkForRussianVoice(text: string) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const soft = KK_SOFT[c];
    if (soft) {
      // после согласной — смягчение («көп» → «кёп»), в начале слова — чистый гласный («өте» → «оте»)
      const prev = text[i - 1] ?? ' ';
      out += /[бвгджзклмнпрстфхцчшщғқңһ]/i.test(prev) ? soft[0] : soft[1];
    } else out += KK_SOUND[c] ?? c;
  }
  return out;
}

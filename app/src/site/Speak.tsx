// Озвучка текста голосом устройства (Web Speech API).
// Выбирается самый естественный голос: нейросетевые «Natural/Online» (Edge), Google (Chrome), затем системный.
// Работает без нашего сервера; нейросетевые голоса Edge требуют интернет, системные — нет.
import { useCallback, useEffect, useRef, useState } from 'react';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function score(v: SpeechSynthesisVoice) {
  const n = v.name.toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 10;
  if (/google/.test(n)) s += 6;
  if (/(svetlana|dariya|dmitry|aigul|daulet|milena)/.test(n)) s += 3;
  if (v.localService) s += 1;
  return s;
}

export function useVoices(lang: 'ru' | 'kk') {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!supported) return;
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      const mine = all.filter((v) => v.lang.toLowerCase().startsWith(lang));
      // Казахского голоса может не быть — тогда читаем русским
      const list = mine.length ? mine : all.filter((v) => v.lang.toLowerCase().startsWith('ru'));
      setVoices([...list].sort((a, b) => score(b) - score(a)));
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [lang]);
  return voices;
}

/** Читает предложения по очереди и сообщает, какое сейчас звучит (для подсветки). */
export function useSpeaker(sentences: string[], lang: 'ru' | 'kk') {
  const voices = useVoices(lang);
  const [voiceName, setVoiceName] = useState<string>('');
  const [rate, setRate] = useState(1);
  const [current, setCurrent] = useState(-1);
  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const token = useRef(0);

  const voice = voices.find((v) => v.name === voiceName) ?? voices[0];

  const stop = useCallback(() => {
    token.current++;
    if (supported) window.speechSynthesis.cancel();
    setCurrent(-1);
    setState('idle');
  }, []);

  const playFrom = useCallback(
    (start: number) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const my = ++token.current;
      const say = (i: number) => {
        if (my !== token.current) return;
        if (i >= sentences.length) {
          setCurrent(-1);
          setState('idle');
          return;
        }
        const u = new SpeechSynthesisUtterance(sentences[i]);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? (lang === 'kk' ? 'kk-KZ' : 'ru-RU');
        u.rate = rate;
        u.onstart = () => my === token.current && setCurrent(i);
        u.onend = () => say(i + 1);
        u.onerror = () => my === token.current && setState('idle');
        window.speechSynthesis.speak(u);
      };
      setState('playing');
      say(start);
    },
    [sentences, voice, rate, lang],
  );

  const toggle = useCallback(() => {
    if (!supported) return;
    if (state === 'playing') {
      window.speechSynthesis.pause();
      setState('paused');
    } else if (state === 'paused') {
      window.speechSynthesis.resume();
      setState('playing');
    } else playFrom(0);
  }, [state, playFrom]);

  useEffect(() => () => stop(), [stop]);

  return { supported, voices, voice, setVoiceName, rate, setRate, current, state, toggle, stop, playFrom };
}

export function splitSentences(text: string) {
  return text.match(/[^.!?…]+[.!?…]+[»"]?|\S[^.!?…]*$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

/** Компактная кнопка «Слушать» для текста задания. */
export function Speak({ text, lang, compact }: { text: string; lang: 'ru' | 'kk'; compact?: boolean }) {
  const sp = useSpeaker([text], lang);
  if (!sp.supported) return null;
  return (
    <button
      type="button"
      onClick={sp.toggle}
      aria-label={sp.state === 'playing' ? 'Пауза' : 'Слушать текст'}
      className={`inline-flex min-h-11 shrink-0 items-center gap-2 border border-[var(--s-line)] px-3 text-sm font-semibold hover:border-[var(--s-read)] ${compact ? '' : 'px-4'}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {sp.state === 'playing' ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M7 4v16l13-8z" />}
      </svg>
      {sp.state === 'playing' ? 'Пауза' : sp.state === 'paused' ? 'Дальше' : 'Слушать'}
    </button>
  );
}

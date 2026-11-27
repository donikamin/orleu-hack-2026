// 3D-аватар ИИ-ответчика: реалистичный человек (TalkingHead, MIT), губы двигаются в такт голосу.
// Грузится только на экране ИИ-ответчика (~3 МБ модель + three.js), потом лежит в кэше телефона.
// Голос: живой голос ИИ (/api/tts) → губы по словам; нет сети или 2G → голос телефона, губы по оценке длительности.
// Русские и казахские слова переводятся в латиницу — так встроенный английский липсинк даёт правдоподобные формы рта.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';
import { LipsyncEn } from '@met4citizen/talkinghead/modules/lipsync-en.mjs';
import { deviceUtterance, splitSentences, voiceBlob } from './Speak';

const AVATAR_URL = '/avatars/brunette-t.glb';

const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};
const translit = (w: string) => [...w.toLowerCase()].map((c) => TR[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('');

/** Слова и их время внутри предложения: длительность делится пропорционально длине слов. */
function timing(sentence: string, totalMs: number) {
  const words = sentence.split(/\s+/).map(translit).filter(Boolean);
  const weights = words.map((w) => w.length + 1);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const span = totalMs * 0.92;
  let t = totalMs * 0.03;
  const wtimes: number[] = [];
  const wdurations: number[] = [];
  for (const w of weights) {
    const d = (span * w) / sum;
    wtimes.push(t);
    wdurations.push(d);
    t += d;
  }
  return { words, wtimes, wdurations };
}

/** Тишина нужной длины: по ней аватар проигрывает движения губ, пока звук идёт из голоса телефона. */
function silence(h: TalkingHead, ms: number) {
  const rate = h.audioCtx.sampleRate;
  return h.audioCtx.createBuffer(1, Math.max(1, Math.ceil((rate * ms) / 1000)), rate);
}

export type AvatarState = { phase: 'loading'; pct: number } | { phase: 'ready' } | { phase: 'error'; message: string };
export interface AvatarHandle {
  /** Разрешить звук: вызывать прямо в обработчике нажатия, до ожидания ответа сервера. */
  unlock: () => void;
  /** Прочитать текст; onSentence(i) — какое предложение звучит (-1 — закончил). */
  speak: (text: string, onSentence?: (i: number) => void) => Promise<'cloud' | 'device'>;
  stop: () => void;
}

/** Две модели: девушка (Ready Player Me, CC BY-NC 4.0) и парень (AvatarSDK, некоммерческое использование, сжат meshopt до 3,7 МБ). */
const AVATARS = {
  female: { url: AVATAR_URL, body: 'F', baseline: { headRotateX: 0.12 }, camera: { cameraDistance: -1, cameraY: 0.12 } },
  male: { url: '/avatars/male.glb', body: 'M', baseline: { headRotateX: -0.08 }, camera: { cameraDistance: -0.4, cameraY: -0.02 } },
} as const;

export const TalkingAvatar = forwardRef<AvatarHandle, { model?: 'female' | 'male'; onState: (s: AvatarState) => void; onSpeaking: (on: boolean) => void }>(function TalkingAvatar({ model = 'female', onState, onSpeaking }, ref) {
  const node = useRef<HTMLDivElement>(null);
  const head = useRef<TalkingHead | null>(null);
  const token = useRef(0);
  const cps = useRef(13); // символов в секунду у голоса телефона — уточняется по ходу речи
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    const el = node.current;
    if (!el) return;
    try {
      const probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('webgl');
      const h = new TalkingHead(el, {
        ttsEndpoint: '',
        lipsyncModules: [],
        lipsyncLang: 'en',
        cameraView: 'upper', // по пояс, камера ближе: лицо и губы хорошо видно даже на телефоне
        ...AVATARS[model].camera, // у каждой модели свой рост — своя камера
        cameraRotateEnable: false,
        modelFPS: 30,
        modelPixelRatio: 1, // дешёвые телефоны: без двойного разрешения
        avatarMood: 'happy',
        avatarIdleEyeContact: 0.6,
        avatarSpeakingEyeContact: 0.8,
      });
      h.lipsync.en = new LipsyncEn();
      head.current = h;
      onState({ phase: 'loading', pct: 0 });
      const a = AVATARS[model];
      h.showAvatar({ url: a.url, body: a.body, avatarMood: 'happy', lipsyncLang: 'en', baseline: a.baseline }, (e) => {
        if (!dead && e.lengthComputable) onState({ phase: 'loading', pct: Math.round((e.loaded / e.total) * 100) });
      })
        .then(() => {
          if (dead) return;
          setReady(true);
          onState({ phase: 'ready' });
          h.lookAtCamera(800);
        })
        .catch(() => !dead && onState({ phase: 'error', message: 'Не удалось загрузить 3D-модель. Проверьте интернет — после первой загрузки она работает без сети.' }));
    } catch {
      onState({ phase: 'error', message: 'Этот телефон не поддерживает 3D (WebGL). Ответы всё равно звучат голосом и видны текстом.' });
    }
    return () => {
      dead = true;
      token.current++;
      window.speechSynthesis?.cancel();
      head.current?.stop();
      head.current = null;
      el.replaceChildren();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    unlock() {
      void head.current?.audioCtx.resume();
    },
    stop() {
      token.current++;
      window.speechSynthesis?.cancel();
      head.current?.stopSpeaking();
      onSpeaking(false);
    },
    async speak(text, onSentence) {
      this.stop();
      const my = ++token.current;
      const h = head.current;
      void h?.audioCtx.resume(); // звук разрешается только по нажатию — будим сразу
      const ss = splitSentences(text);
      const alive = () => my === token.current;
      onSpeaking(true);
      let source: 'cloud' | 'device' = 'cloud';

      // 1) живой голос: предложения встают в очередь аватара, следующее грузится, пока звучит текущее
      const pending = new Map<number, Promise<Blob | null>>();
      const get = (i: number) => {
        if (!pending.has(i)) pending.set(i, voiceBlob(ss[i]));
        return pending.get(i)!;
      };
      let i = 0;
      // браузер не дал включить звук 3D-движка — живой голос встанет в очередь и «зависнет»; сразу берём голос телефона
      if (h && h.audioCtx.state !== 'running') await Promise.race([h.audioCtx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
      const audioOk = !!h && h.audioCtx.state === 'running';
      if (h && ready && audioOk) {
        for (; i < ss.length; i++) {
          const blob = await get(i);
          if (!alive()) return source;
          if (!blob) break;
          if (i + 1 < ss.length) void get(i + 1);
          try {
            const buf = await h.audioCtx.decodeAudioData(await blob.arrayBuffer());
            if (!alive()) return source;
            const k = i;
            h.speakMarker(() => alive() && onSentence?.(k));
            h.speakAudio({ audio: buf, ...timing(ss[i], buf.duration * 1000) }, { lipsyncLang: 'en' });
            if (i === 0) h.speakWithHands(0, 0.5);
          } catch {
            break;
          }
        }
        if (i === ss.length) {
          await new Promise<void>((res) => h.speakMarker(() => res()));
          if (alive()) {
            onSentence?.(-1);
            onSpeaking(false);
          }
          return source;
        }
        // живой голос оборвался — дожидаемся очереди (не дольше 15 с, чтобы не зависнуть) и продолжаем голосом телефона
        const until = Date.now() + 15_000;
        while (alive() && h.isSpeaking && Date.now() < until) await new Promise((r) => setTimeout(r, 120));
        h.stopSpeaking();
      }

      // 2) голос телефона. Синхронизация губ:
      //    а) голос сообщает о начале каждого слова (onboundary) — рот проговаривает именно это слово в этот момент;
      //    б) если голос слова не сообщает — длительность фразы оценивается по реальной скорости прошлых фраз.
      source = 'device';
      const synth = window.speechSynthesis;
      for (; i < ss.length && alive(); i++) {
        const s = ss[i];
        const k = i;
        await new Promise<void>((res) => {
          const est = Math.max(700, (s.length / cps.current) * 1000);
          let started = 0;
          let words = 0;
          let fallback: number | undefined;
          let guard: number | undefined;
          const finish = () => {
            window.clearTimeout(fallback);
            window.clearTimeout(guard);
            h?.stopSpeaking();
            if (started) {
              // учимся: сколько символов в секунду реально говорит этот голос
              const real = s.length / Math.max(0.3, (performance.now() - started) / 1000);
              cps.current = Math.min(22, Math.max(8, cps.current * 0.6 + real * 0.4));
            }
            res();
          };
          const mouthFor = (text: string, ms: number) => {
            if (!h || !ready || !alive()) return;
            h.stopSpeaking(); // новое слово начинается сейчас — прошлое не должно «догонять»
            h.speakAudio({ audio: silence(h, ms), ...timing(text, ms) }, { lipsyncLang: 'en' });
          };
          if (!synth) {
            onSentence?.(k);
            mouthFor(s, est);
            window.setTimeout(res, est);
            return;
          }
          const u = deviceUtterance(s);
          u.onstart = () => {
            started = performance.now();
            onSentence?.(k);
            // слова не приходят 350 мс — голос их не сообщает: анимируем всю фразу по оценке
            fallback = window.setTimeout(() => !words && mouthFor(s, est), 350);
            // защита от зависания Chrome: фраза не может длиться втрое дольше оценки
            guard = window.setTimeout(() => {
              synth.cancel();
              finish();
            }, est * 3 + 2000);
          };
          u.onboundary = (ev) => {
            if (ev.name && ev.name !== 'word') return;
            words++;
            const rest = s.slice(ev.charIndex);
            const word = (ev.charLength ? rest.slice(0, ev.charLength) : rest.split(/\s/)[0]) || '';
            // длительность слова — по выученной скорости голоса
            mouthFor(word, Math.min(1400, Math.max(140, ((word.length + 1) / cps.current) * 1000)));
          };
          u.onend = finish;
          u.onerror = finish;
          synth.speak(u);
        });
      }
      if (alive()) {
        onSentence?.(-1);
        onSpeaking(false);
      }
      return source;
    },
  }));

  return <div ref={node} className="talking-avatar" aria-hidden="true" />;
});

export default TalkingAvatar;

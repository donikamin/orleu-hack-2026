// ИИ-ответчик: 3D-собеседник. Нажал микрофон — спросил вслух — он отвечает голосом, губы в такт, внизу субтитры.
// Голосом же: «прочитай текст про Арал» — читает текст; «стоп» — замолкает. Можно писать текстом и вставить длинный
// текст из учебника — он его прочитает. Камера — фото задачи прямо в приложении (сжимается до ~50 КБ, уходит на 2G).
// Задачи не решает за ученика (сократический диалог), вопросы о тексте и понятиях объясняет прямо.
// Нет сервера ИИ — отвечает из встроенной базы; нет сети — фото ждёт в очереди.
import { forwardRef, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TEXTS } from './content/texts';
import { ICam, IMic, ISpeaker } from './Icons';
import { getVoicePref, setVoicePref, splitSentences, useSay, type VoiceGender } from './Speak';
import type { AvatarHandle, AvatarState } from './TalkingAvatar';
import { offlineAnswer, offlineKnows } from './offlineAnswer';
import { askKnowledge, isKazakh, knowledgeTopic, sayable } from './knowledge';
import { track } from './analytics';
import { canListen, listen, warmUpDeviceStt, type ListenState } from './voiceInput';
import { askLocal, llmAvailable, onlyLocal, TUTOR_SYSTEM, type LocalTurn } from './localLlm';
import { askOllama } from './ai';
import { LocalAiCard } from './LocalAiCard';
import { CameraCapture } from './CameraCapture';

// 3D-модуль ещё ни разу не скачивался, а сети нет — экран не должен падать: отвечаем голосом телефона и текстом
const NoAvatar = forwardRef<AvatarHandle, { onState: (s: AvatarState) => void }>(function NoAvatar({ onState }, _ref) {
  useEffect(() => onState({ phase: 'error', message: '3D-ответчик загрузится, когда появится интернет. Пока отвечаю голосом телефона и текстом.' }), [onState]);
  return null;
});
const TalkingAvatar = lazy(() =>
  import('./TalkingAvatar').catch(() => ({ default: NoAvatar as unknown as typeof import('./TalkingAvatar').default })),
);

type Msg =
  | { role: 'student'; text: string; photo?: string; voice?: boolean }
  | { role: 'tutor'; text: string; offline?: boolean; source?: 'wiki' | 'local' | 'ollama' }
  | { role: 'read'; title: string; body: string };

const QUEUE = 'oqy-tutor-queue';
const TARGET = 60 * 1024;

async function compress(file: File) {
  const bmp = await createImageBitmap(file);
  let side = 1024;
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    const g = c.getContext('2d')!;
    g.filter = 'grayscale(1) contrast(1.15)';
    g.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.7, 0.55, 0.42]) {
      const url = c.toDataURL('image/jpeg', q);
      const bytes = Math.round(((url.length - 23) * 3) / 4);
      if (bytes <= TARGET || (side <= 640 && q === 0.42)) return { url, bytes };
    }
    side = Math.round(side * 0.8);
  }
  throw new Error('Не удалось сжать фото');
}

async function callTutor(photo: string | undefined, messages: Msg[], context?: string) {
  const dialog = messages.filter((m): m is Exclude<Msg, { role: 'read' }> => m.role !== 'read').map((m) => ({ role: m.role, text: m.text || '(фото)' }));
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64: photo?.split(',')[1], context, messages: dialog }),
  });
  const isJson = res.headers.get('content-type')?.includes('json');
  const j = isJson ? ((await res.json()) as { reply?: string; error?: string }) : {};
  if (!res.ok || !j.reply) throw new Error(j.error ?? 'Сервер ИИ не подключён');
  return j.reply;
}

/* Голосовые команды: какой текст прочитать */
const TEXT_KEYS: Record<string, RegExp> = {
  't-aral': /арал|море/i,
  't-notice': /объявлен|школ|кружк/i,
  't-bus': /автобус|последн/i,
  't-farmer': /фермер|интервью|ферм/i,
  't-news': /новост|учён|учен|фейк/i,
};
function findText(q: string) {
  const byKey = TEXTS.find((t) => TEXT_KEYS[t.id]?.test(q));
  if (byKey) return byKey;
  const low = q.toLowerCase();
  return TEXTS.find((t) => t.title.toLowerCase().split(/\s+/).some((w) => w.length > 3 && low.includes(w.replace(/[«»"]/g, ''))));
}
const READ_CMD = /(прочитай|прочти|почитай|зачитай|читай|оқы)/i;
const STOP_CMD = /^(стоп|хватит|замолчи|тихо|остановись)[.!]?$/i;

const EXAMPLES = ['Прочитай текст про Аральское море', 'Как найти 15% от 24 000?', 'Чем факт отличается от мнения?', 'Как читать масштаб карты?'];

export default function SiteTutor() {
  const [params] = useSearchParams();
  const [avatar, setAvatar] = useState<AvatarState>({ phase: 'loading', pct: 0 });
  const [talking, setTalking] = useState(false);
  const av = useRef<AvatarHandle>(null);
  const fallback = useSay();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queued, setQueued] = useState(() => {
    try { return Boolean(localStorage.getItem(QUEUE)); } catch { return false; }
  });
  // звук включён при каждом открытии: выключенный когда-то звук не должен делать ответчика «немым»
  const [voiceOn, setVoiceOn] = useState(true);
  const [gender, setGender] = useState<VoiceGender>(() => getVoicePref().gender);
  const [lang, setLang] = useState<'ru' | 'kk'>('ru'); // язык распознавания микрофона
  const [ear, setEar] = useState<ListenState>('idle');
  const [heard, setHeard] = useState('');
  // громкость микрофона пишем прямо в CSS-переменную кнопки — без перерисовки всего экрана 20 раз в секунду
  const micRef = useRef<HTMLButtonElement>(null);
  const setLevel = (l: number) => micRef.current?.style.setProperty('--lvl', l.toFixed(2));
  const [subtitle, setSubtitle] = useState('');
  const [current, setCurrent] = useState(-1); // какое предложение читаемого текста звучит
  const [context, setContext] = useState<{ title: string; body: string } | null>(null);
  const [camera, setCamera] = useState(false);
  const stopEar = useRef<(() => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const speaking = talking || fallback.state === 'playing' || fallback.state === 'loading';
  const lastRead = useMemo(() => [...msgs].reverse().find((m) => m.role === 'read') as Extract<Msg, { role: 'read' }> | undefined, [msgs]);
  const readSentences = useMemo(() => (lastRead ? splitSentences(lastRead.body.replace(/\n+/g, ' ')) : []), [lastRead]);

  function speakOut(t: string, onSentence?: (i: number) => void) {
    const ss = splitSentences(t);
    const each = (i: number) => {
      setSubtitle(i >= 0 ? ss[i] ?? '' : '');
      onSentence?.(i);
    };
    const audio = sayable(t); // «Oqy» звучит как «Оқу»
    if (avatar.phase === 'ready' && av.current) void av.current.speak(audio, each);
    else {
      setSubtitle(ss[0] ?? '');
      fallback.say(audio);
    }
  }
  function stopAll() {
    av.current?.stop();
    fallback.stop();
    setCurrent(-1);
    setSubtitle('');
  }

  useEffect(() => {
    if (!msgs.length && !err) return;
    void endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, busy, err]);
  useEffect(() => {
    if (fallback.state === 'idle' && !talking) setSubtitle('');
  }, [fallback.state, talking]);

  // открыли с ?text=… (кнопка «ИИ-ответчик прочитает» в «Текстах») — сразу предлагаем прочитать
  useEffect(() => {
    const t = TEXTS.find((x) => x.id === params.get('text'));
    if (t) setMsgs([{ role: 'read', title: t.title, body: t.paragraphs.join('\n\n') }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // распознавание речи на устройстве уже скачано — поднимаем его заранее, пока ученик смотрит на экран
  useEffect(() => {
    const t = window.setTimeout(() => void warmUpDeviceStt(), 2500);
    return () => window.clearTimeout(t);
  }, []);

  function switchGender(g: VoiceGender) {
    const p = getVoicePref();
    setVoicePref({ ...p, gender: g });
    setGender(g);
    stopAll();
    av.current?.unlock();
    track('answerer_voice_gender', { gender: g });
    // новая 3D-модель грузится пару секунд — поздороваемся, когда она будет готова
    greet.current = g === 'female' ? 'Сәлем! Я ИИ-ответчик Оқу. Спрашивай — отвечу.' : 'Сәлем! Теперь с тобой говорю я. Спрашивай — отвечу.';
  }

  const greet = useRef<string | null>(null);
  useEffect(() => {
    if (avatar.phase !== 'ready' || !greet.current) return;
    const t = greet.current;
    greet.current = null;
    if (voiceOn) speakOut(t);
  }, [avatar.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleVoice() {
    const v = !voiceOn;
    setVoiceOn(v);
    if (!v) stopAll();
  }

  function readText(title: string, body: string, history: Msg[] = msgs) {
    stopAll();
    av.current?.unlock();
    const ctx = { title, body };
    setContext(ctx);
    setMsgs([...history, { role: 'read', title, body }]);
    track('answerer_read_text', { title, avatar: avatar.phase });
    speakOut(body.replace(/\n+/g, ' '), setCurrent);
  }

  /** Главный вход: вопрос голосом или текстом. Сначала команды, потом ИИ. */
  function ask(q: string, voice = false) {
    const t = q.trim();
    if (!t) return;
    if (isKazakh(t)) setLang('kk'); // заговорил по-казахски — микрофон дальше слушает казахский
    if (STOP_CMD.test(t)) return stopAll();
    const student: Msg = { role: 'student', text: t, voice };
    // «прочитай текст про …»
    if (READ_CMD.test(t)) {
      const found = findText(t);
      if (found) return readText(found.title, found.paragraphs.join('\n\n'), [...msgs, student]);
      if (context && /его|это|ещё|еще|снова|текст$/i.test(t)) return readText(context.title, context.body, [...msgs, student]);
    }
    // вставили длинный текст — читаем его вслух и запоминаем, чтобы отвечать по нему
    if (t.length > 280 && !voice) return readText('Твой текст', t, [...msgs, { role: 'student', text: `${t.slice(0, 120)}…` }]);
    void send([...msgs, student]);
  }

  async function answerOffline(next: Msg[], ctx: { title: string; body: string } | null) {
    const q = [...next].reverse().find((m): m is Extract<Msg, { role: 'student' }> => m.role === 'student' && !!m.text)?.text ?? '';
    // «Кто такой…», «что такое…» — ищем в Википедии (если встроенная база этого не знает)
    if (knowledgeTopic(q) && !offlineKnows(q, ctx) && navigator.onLine) {
      setBusy(true);
      const wiki = await askKnowledge(q);
      setBusy(false);
      if (wiki) {
        setMsgs([...next, { role: 'tutor', text: wiki, source: 'wiki' }]);
        track('answerer_wiki', { found: true });
        if (voiceOn) speakOut(wiki);
        return;
      }
      track('answerer_wiki', { found: false });
    }
    // вопрос не из встроенной базы — отвечает локальный ИИ на устройстве, а если его нет — Ollama школы
    if (!offlineKnows(q, ctx)) {
      const turns: LocalTurn[] = next
        .filter((m): m is Exclude<Msg, { role: 'read' }> => m.role !== 'read' && !!m.text)
        .map((m) => ({ role: m.role === 'student' ? 'user' : 'assistant', content: m.text }));
      if (llmAvailable()) {
        setBusy(true);
        try {
          let first = true;
          const out = await askLocal(turns, ctx, (t) => {
            if (first) setBusy(false);
            first = false;
            setMsgs([...next, { role: 'tutor', text: t, source: 'local' }]);
          });
          setMsgs([...next, { role: 'tutor', text: out, source: 'local' }]);
          track('answerer_local_ai', { ok: true });
          if (voiceOn && out) speakOut(out);
          return;
        } catch (e) {
          track('answerer_local_ai', { ok: false });
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }
      const ol = await askOllama(turns, ctx ? `${TUTOR_SYSTEM}

Текст «${ctx.title}»:
${ctx.body.slice(0, 1800)}` : TUTOR_SYSTEM);
      if (ol) {
        setMsgs([...next, { role: 'tutor', text: ol, source: 'ollama' }]);
        if (voiceOn) speakOut(ol);
        return;
      }
    }
    const reply = offlineAnswer(q, ctx);
    setMsgs([...next, { role: 'tutor', text: reply, offline: true }]);
    if (voiceOn) speakOut(reply);
  }

  async function send(next: Msg[], ph?: string, ctx = context) {
    setMsgs(next);
    setErr(null);
    stopAll();
    av.current?.unlock();
    const isPhoto = !!ph;
    track('answerer_question', { photo: isPhoto, about_text: !!ctx, online: navigator.onLine, avatar: avatar.phase });
    // выбран режим «только локальный ИИ» — отвечаем прямо на устройстве, без сервера
    if (!isPhoto && onlyLocal() && llmAvailable()) return answerOffline(next, ctx);
    if (!navigator.onLine) {
      if (!isPhoto) return answerOffline(next, ctx);
      try { localStorage.setItem(QUEUE, JSON.stringify({ photo: ph, msgs: next })); } catch { /* нет места */ }
      setQueued(true);
      return;
    }
    setBusy(true);
    try {
      const reply = await callTutor(ph, next, ctx ? `${ctx.title}\n\n${ctx.body}` : undefined);
      setMsgs([...next, { role: 'tutor', text: reply }]);
      if (voiceOn) speakOut(reply);
    } catch (e) {
      if (isPhoto) setErr(`Фото разбирает только ИИ на сервере, а он сейчас недоступен (${(e as Error).message.toLowerCase()}). Спроси словами — отвечу и без сервера`);
      else answerOffline(next, ctx);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const flush = () => {
      try {
        const q = JSON.parse(localStorage.getItem(QUEUE) ?? 'null') as { photo?: string; msgs: Msg[] } | null;
        if (!q) return;
        localStorage.removeItem(QUEUE);
        setQueued(false);
        void send(q.msgs, q.photo);
      } catch { /* пусто */ }
    };
    window.addEventListener('online', flush);
    if (navigator.onLine) flush();
    return () => window.removeEventListener('online', flush);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(f: File) {
    setCamera(false);
    setErr(null);
    try {
      const c = await compress(f);
      await send([...msgs, { role: 'student', text: '', photo: c.url }], c.url);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function mic() {
    if (ear !== 'idle') {
      stopEar.current?.();
      return;
    }
    stopAll();
    av.current?.unlock();
    setErr(null);
    setText('');
    stopEar.current = listen({
      lang: lang === 'kk' ? 'kk-KZ' : 'ru-RU',
      onState: (s) => {
        setEar(s);
        if (s === 'idle') setLevel(0);
      },
      // распознанные слова сразу видны и на сцене, и в поле ввода — можно поправить и отправить
      onPartial: (t) => {
        setHeard(t);
        setText(t);
      },
      onStatus: setHeard,
      onLevel: setLevel,
      onFinal: (t) => {
        setHeard('');
        setText('');
        ask(t, true);
      },
      onError: (m) => {
        setHeard('');
        setErr(m);
      },
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const t = text;
    setText('');
    ask(t);
  }

  const micLabel = ear === 'listening' || ear === 'recording' ? 'Слушаю… нажми, чтобы закончить' : ear === 'recognizing' ? 'Распознаю…' : 'Нажми и спроси голосом';
  const status =
    avatar.phase === 'loading' ? `Загружаю 3D… ${avatar.pct}%` : ear === 'listening' || ear === 'recording' ? 'Слушаю' : ear === 'recognizing' || busy ? 'Думаю…' : speaking ? 'Говорю' : avatar.phase === 'error' ? 'Без 3D' : 'Готов ответить';

  return (
    <section className="app-screen" aria-labelledby="ans-h">
      <div className="answerer">
        <div className="stage-wrap">
          <div className={`stage ${speaking ? 'stage--talk' : ''} ${ear !== 'idle' ? 'stage--ear' : ''}`}>
            {avatar.phase !== 'error' && (
              <Suspense fallback={null}>
                <TalkingAvatar key={gender} model={gender} ref={av} onState={setAvatar} onSpeaking={setTalking} />
              </Suspense>
            )}
            {avatar.phase === 'loading' && (
              <div className="stage__loading">
                <span className="progress w-40"><i style={{ width: `${avatar.pct}%` }} /></span>
                <span>Загружаю 3D-ответчика…</span>
                <small>Один раз ~3 МБ, потом работает без интернета</small>
              </div>
            )}
            {avatar.phase === 'error' && <p className="stage__loading">{avatar.message}</p>}
            <span className={`stage__status ${speaking || ear !== 'idle' ? 'on' : ''}`} role="status">{status}</span>
            <div className="stage__top">
              <div className="voice-switch" role="group" aria-label="Язык микрофона">
                <button type="button" aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>РУС</button>
                <button type="button" aria-pressed={lang === 'kk'} onClick={() => setLang('kk')}>ҚАЗ</button>
              </div>
              <div className="voice-switch" role="group" aria-label="Голос ответчика">
                <button type="button" aria-pressed={gender === 'female'} onClick={() => switchGender('female')}>Женский</button>
                <button type="button" aria-pressed={gender === 'male'} onClick={() => switchGender('male')}>Мужской</button>
              </div>
              <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} className={`stage__sound ${voiceOn ? 'on' : ''}`} aria-label={voiceOn ? 'Звук ответов включён: выключить' : 'Звук ответов выключен: включить'}>
                <ISpeaker size={18} /> {voiceOn ? 'Звук' : 'Без звука'}
              </button>
            </div>
            {(subtitle || heard) && <p className={`stage__sub ${heard ? 'stage__sub--me' : ''}`} aria-live="polite">{heard || subtitle}</p>}
            <div className="stage__dock">
              <button type="button" className="dock-btn" onClick={() => setCamera(true)} aria-label="Сфотографировать задачу">
                <ICam size={24} />
              </button>
              {canListen() && (
                <button type="button" className={`mic-btn ${ear !== 'idle' ? 'on' : ''}`} ref={micRef} onClick={mic} aria-pressed={ear !== 'idle'} aria-label={micLabel}>
                  <IMic size={34} />
                </button>
              )}
              {speaking ? (
                <button type="button" className="dock-btn" onClick={stopAll} aria-label="Остановить ответ">■</button>
              ) : (
                <button type="button" className="dock-btn" onClick={() => readText(TEXTS[0].title, TEXTS[0].paragraphs.join('\n\n'))} aria-label="Прочитать текст вслух">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4zM12 6v14" /></svg>
                </button>
              )}
            </div>
          </div>
          <p className="stage__hint">{canListen() ? <>Нажми <b>микрофон</b> и спроси вслух. Например: «Прочитай текст про Арал» или «Как найти 15%?»</> : <>Напиши вопрос внизу — ответ прозвучит голосом.</>}</p>
          <p className="muted-s mt-1 text-xs">3D-модели: Ready Player Me (CC BY-NC 4.0) и AvatarSDK (некоммерческое использование) · TalkingHead (MIT). Голос — ElevenLabs или Gemini; без сети — голос телефона, распознавание речи Whisper (MIT) и ИИ Qwen 2.5 (Apache 2.0) прямо на устройстве.</p>
        </div>

        <div className="answer-panel">
          <header>
            <span className="chip chip--ai">ИИ-ответчик · говорит по-русски и по-казахски</span>
            <h1 id="ans-h" className="app-title mt-2">Спроси вслух — он ответит</h1>
          </header>

          <div className="ask-chips" role="group" aria-label="Готовые вопросы">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" className="ask-chip" onClick={() => ask(q)}>{q}</button>
            ))}
          </div>
          <div className="read-chips" role="group" aria-label="Прочитать текст вслух">
            <span className="muted-s">Прочитать вслух:</span>
            {TEXTS.map((t) => (
              <button key={t.id} type="button" className="read-chip" onClick={() => readText(t.title, t.paragraphs.join('\n\n'))}>📖 {t.title}</button>
            ))}
          </div>

          <LocalAiCard />

          {context && (
            <p className="chip chip--read">
              Отвечаю по тексту «{context.title}»
              <button type="button" className="ml-1 font-black" onClick={() => setContext(null)} aria-label="Не учитывать текст">✕</button>
            </p>
          )}

          <div className="tutor__chat" aria-live="polite">
            {msgs.length === 0 && (
              <div className="chat-empty">
                <b>Здесь будет разговор</b>
                <span>Нажми большую кнопку с микрофоном на экране слева или напиши вопрос внизу. Можно вставить сюда длинный текст из учебника — я его прочитаю.</span>
              </div>
            )}
            {msgs.map((m, i) =>
              m.role === 'read' ? (
                <article key={i} className="read-card">
                  <div className="flex items-center justify-between gap-2">
                    <b>📖 {m.title}</b>
                    <button type="button" className="link-btn min-h-0! text-sm" onClick={() => readText(m.title, m.body, msgs.slice(0, i))}>▶ читать</button>
                  </div>
                  <p className="text-read mt-2">
                    {(m === lastRead ? readSentences : splitSentences(m.body.replace(/\n+/g, ' '))).map((s, k) => (
                      <span key={k}>
                        <span className={`rounded px-0.5 transition-colors duration-200 ${m === lastRead && current === k ? 'read-on' : ''}`}>{s}</span>{' '}
                      </span>
                    ))}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['О чём этот текст?', 'Какая главная мысль?', 'Объясни трудное слово'].map((q) => (
                      <button key={q} type="button" className="ask-chip ask-chip--sm" onClick={() => { setContext({ title: m.title, body: m.body }); void send([...msgs, { role: 'student', text: q }], undefined, { title: m.title, body: m.body }); }}>{q}</button>
                    ))}
                  </div>
                </article>
              ) : m.role === 'tutor' ? (
                <div key={i} className="bubble bubble--tutor">
                  <p>{m.text}</p>
                  <span className="bubble__tag">
                    <button type="button" className="link-btn min-h-0! text-xs" onClick={() => speakOut(m.text)}>▶ повторить</button>
                    {m.offline && <span> · ответ из встроенной базы (без сервера ИИ)</span>}
                    {m.source === 'wiki' && <span> · найдено в Википедии</span>}
                    {m.source === 'local' && <span className="tag-local"> · локальный ИИ на устройстве, без интернета. Может ошибаться — сверяйся с учебником</span>}
                    {m.source === 'ollama' && <span className="tag-local"> · ИИ школьного компьютера (Ollama)</span>}
                  </span>
                </div>
              ) : (
                <div key={i} className="bubble bubble--student">
                  {m.photo && <img src={m.photo} alt="Фото задачи" width={240} height={180} className="bubble__img" />}
                  {m.text && <p>{m.voice && <span aria-label="сказано голосом">🎙 </span>}{m.text}</p>}
                </div>
              ),
            )}
            {busy && <div className="bubble bubble--tutor bubble--typing" aria-label="ИИ думает"><i /><i /><i /></div>}
            {queued && <p className="note note--warn">Нет сети. Фото сохранено и отправится само, когда появится связь.</p>}
            {err && <p className="note note--warn">{err}.</p>}
            <div ref={endRef} />
          </div>

          <form className="tutor__bar" onSubmit={submit}>
            <button type="button" className="icon-btn" onClick={() => setCamera(true)} aria-label="Сфотографировать задачу"><ICam size={22} /></button>
            <label htmlFor="tutor-input" className="sr-only">Вопрос или текст, который нужно прочитать</label>
            <input id="tutor-input" name="message" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder="Напиши вопрос или вставь текст…" className="tutor__input" />
            <button type="submit" className="site-btn site-btn--ai site-btn--sm px-3!" disabled={!text.trim() || busy} aria-label="Отправить">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </form>
        </div>
      </div>
      {camera && (
        <CameraCapture
          onShot={onFile}
          onClose={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            fileRef.current?.click();
          }}
        />
      )}
    </section>
  );
}

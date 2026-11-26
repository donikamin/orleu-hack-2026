// «ИИ-наставник» (идея OpenMath / MathBot): фото задачи с камеры → ИИ разбирает наводящими вопросами.
// Фото сжимается на телефоне до ~50 КБ: на 2G уходит за несколько секунд. Нет сети — встаёт в очередь.
import { useEffect, useRef, useState } from 'react';

interface Msg {
  role: 'student' | 'tutor';
  text: string;
  photo?: string;
}

const QUEUE = 'oqy-tutor-queue';
const TARGET = 60 * 1024; // ~60 КБ

/** Сжать фото: сторона до 1024 px, JPEG, понижаем качество, пока не влезет в ~60 КБ. */
async function compress(file: File) {
  const bmp = await createImageBitmap(file);
  let side = 1024;
  for (let attempt = 0; attempt < 6; attempt++) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    const g = c.getContext('2d')!;
    g.filter = 'grayscale(1) contrast(1.15)'; // текст читается лучше, файл легче
    g.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.7, 0.55, 0.42]) {
      const url = c.toDataURL('image/jpeg', q);
      const bytes = Math.round(((url.length - 23) * 3) / 4);
      if (bytes <= TARGET || (side <= 640 && q === 0.42)) return { url, bytes, w: c.width, h: c.height };
    }
    side = Math.round(side * 0.8);
  }
  throw new Error('Не удалось сжать фото');
}

async function callTutor(photo: string | undefined, messages: Msg[]) {
  const res = await fetch('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64: photo?.split(',')[1], messages: messages.map((m) => ({ role: m.role, text: m.text || '(фото)' })) }),
  });
  const isJson = res.headers.get('content-type')?.includes('json');
  const j = isJson ? ((await res.json()) as { reply?: string; stage?: string; error?: string }) : {};
  if (!res.ok || !j.reply) throw new Error(j.error ?? (res.status === 404 || res.status === 502 ? 'Сервер ИИ не подключён' : `Ошибка ${res.status}`));
  return j as { reply: string; stage: string };
}

const EXAMPLES = ['Как найти 15% от 24 000?', 'Не понимаю, как читать масштаб карты', 'Как понять, что новость — фейк?'];

export default function SiteTutor() {
  const [photo, setPhoto] = useState<{ url: string; bytes: number } | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [queued, setQueued] = useState(() => {
    try { return Boolean(localStorage.getItem(QUEUE)); } catch { return false; }
  });
  const [solved, setSolved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // в новых браузерах scrollIntoView возвращает Promise — его нельзя отдавать React как очистку
    void endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, busy]);

  async function send(next: Msg[], ph = photo?.url) {
    setMsgs(next);
    setErr(null);
    if (!navigator.onLine) {
      try { localStorage.setItem(QUEUE, JSON.stringify({ photo: ph, msgs: next })); } catch { /* нет места */ }
      setQueued(true);
      return;
    }
    setBusy(true);
    try {
      const r = await callTutor(ph, next);
      setMsgs([...next, { role: 'tutor', text: r.reply }]);
      setSolved(r.stage === 'solved');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Появилась сеть — отправляем то, что ждало в очереди
  useEffect(() => {
    const flush = () => {
      try {
        const q = JSON.parse(localStorage.getItem(QUEUE) ?? 'null') as { photo?: string; msgs: Msg[] } | null;
        if (!q) return;
        localStorage.removeItem(QUEUE);
        setQueued(false);
        if (q.photo) setPhoto({ url: q.photo, bytes: Math.round((q.photo.length * 3) / 4) });
        void send(q.msgs, q.photo);
      } catch { /* пусто */ }
    };
    window.addEventListener('online', flush);
    if (navigator.onLine) flush();
    return () => window.removeEventListener('online', flush);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFile(f: File) {
    setErr(null);
    try {
      const c = await compress(f);
      setPhoto(c);
      setSolved(false);
      await send([{ role: 'student', text: '', photo: c.url }], c.url);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText('');
    void send([...msgs, { role: 'student', text: t }]);
  }

  return (
    <section className="app-screen" aria-labelledby="tutor-h">
      <header className="app-head">
        <span className="chip chip--ai">ИИ-наставник</span>
        <h1 id="tutor-h" className="app-title">Сфоткай задачу — разберём вместе</h1>
        <p className="app-sub">Наставник не даёт готовый ответ. Он задаёт вопросы, пока ты не решишь сам.</p>
      </header>

      <div className="tutor">
        <div className="tutor__chat" aria-live="polite">
          {msgs.length === 0 && (
            <div className="tutor__empty">
              <button type="button" className="camera-btn" onClick={() => fileRef.current?.click()}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                <span>Сфотографировать задачу</span>
                <small>Фото сожмётся до ~50 КБ: уйдёт даже на 2G</small>
              </button>
              <p className="muted-s">или спроси словами:</p>
              <div className="tutor__examples">
                {EXAMPLES.map((q) => (
                  <button key={q} type="button" className="pill" onClick={() => send([{ role: 'student', text: q }])}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`bubble bubble--${m.role}`}>
              {m.photo && <img src={m.photo} alt="Фото задачи" width={240} height={180} className="bubble__img" />}
              {m.text && <p>{m.text}</p>}
              {m.role === 'tutor' && <span className="bubble__tag">наставник · ответ не раскрывает</span>}
            </div>
          ))}
          {busy && <div className="bubble bubble--tutor bubble--typing" aria-label="Наставник печатает"><i /><i /><i /></div>}
          {solved && <p className="tutor__solved">Решено самостоятельно. Это и есть функциональная грамотность.</p>}
          {queued && <p className="note note--warn">Нет сети. Вопрос сохранён и отправится сам, когда появится связь — даже слабая.</p>}
          {err && (
            <p className="note note--warn">
              {err}. Ключ ИИ подключается на сервере (часть B). Пока можно решать задания в тренажёре — там подсказки работают без сети.
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form className="tutor__bar" onSubmit={submit}>
          <button type="button" className="icon-btn" onClick={() => fileRef.current?.click()} aria-label="Сфотографировать задачу">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </button>
          <label htmlFor="tutor-input" className="sr-only">Твой ответ или вопрос</label>
          <input id="tutor-input" name="message" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} placeholder={msgs.length ? 'Твой ответ…' : 'Задай вопрос…'} className="tutor__input" />
          <button type="submit" className="btn btn--primary" disabled={!text.trim() || busy}>Отправить</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </form>
        {photo && <p className="muted-s">Фото: {Math.round(photo.bytes / 1024)} КБ · на 2G ≈ {Math.max(1, Math.round((photo.bytes * 8) / 100000))} с</p>}
      </div>
    </section>
  );
}

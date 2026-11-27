// «Тексты»: библиотека с озвучкой и подсветкой читаемого предложения, после текста — 3 вопроса на навыки PISA.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { SKILL_LABEL } from '@shared/types';
import { TEXTS, type ReadingText } from './content/texts';
import { recordAttempt, useProgress } from './progress';
import { splitSentences, useSpeaker } from './Speak';

export default function SiteTexts() {
  const { id } = useParams();
  const text = TEXTS.find((t) => t.id === id);
  return text ? <Reader key={text.id} text={text} /> : <Library />;
}

function Library() {
  const progress = useProgress();
  const done = new Set(progress.filter((a) => a.kind === 'text').map((a) => a.taskId.split('#')[0]));
  return (
    <section className="site-screen" aria-labelledby="texts-h">
      <p className="site-kicker">Тексты</p>
      <h1 id="texts-h" className="display mt-4 text-[clamp(26px,2.6vw,34px)]">
        Слушай.
        <br />
        Читай. Отвечай.
      </h1>
      <p className="mt-4 max-w-[56ch] text-lg text-[var(--s-muted)]">
        Пять текстов разных жанров, как в PISA. Каждый можно прослушать: голос читает и подсвечивает предложение. После текста — три вопроса: найти, понять, оценить.
      </p>
      <ul className="mt-8 grid flex-1 auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TEXTS.map((t, i) => (
          <li key={t.id}>
            <Link to={`/texts/${t.id}`} className={`site-tile h-full justify-between gap-6 p-6 ${i === 0 ? 'bg-[var(--s-ink)]! text-[var(--s-bg)]!' : ''}`}>
              <span className="flex items-center justify-between text-sm">
                <span className="site-kicker !text-current opacity-70">{t.genre}</span>
                <span>{done.has(t.id) ? '✓ прочитан' : `${t.minutes} мин`}</span>
              </span>
              <span className="display text-[clamp(26px,2.6vw,34px)]">{t.title}</span>
              <span className="text-sm opacity-80">{t.paragraphs[0].slice(0, 90)}…</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Reader({ text }: { text: ReadingText }) {
  const paras = useMemo(() => text.paragraphs.map(splitSentences), [text]);
  const flat = useMemo(() => paras.flat(), [paras]);
  const sp = useSpeaker(flat, 'ru');
  const [answers, setAnswers] = useState<(number | null)[]>(text.questions.map(() => null));
  const [tries, setTries] = useState<number[]>(text.questions.map(() => 0));
  let k = -1;

  function answer(qi: number, oi: number) {
    if (answers[qi] === text.questions[qi].correct) return;
    const q = text.questions[qi];
    setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)));
    if (oi === q.correct) {
      recordAttempt({ taskId: `${text.id}#${qi}`, kind: 'text', score: tries[qi] ? 0.5 : 1, hintsUsed: Math.min(3, tries[qi]) as 0 | 1 | 2 | 3, ts: Math.floor(Date.now() / 1000) });
    } else setTries((t) => t.map((v, i) => (i === qi ? v + 1 : v)));
  }

  return (
    <section className="site-screen" aria-labelledby="reader-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/texts" className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">← Все тексты</Link>
        <p className="site-kicker">{text.genre} · {text.minutes} мин</p>
      </div>
      <div className="mt-4 grid flex-1 items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <article>
          <h1 id="reader-h" className="display text-[clamp(26px,2.6vw,34px)]">{text.title}</h1>
          {sp.supported ? (
            <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center gap-3 border-y border-[var(--s-line)] bg-[var(--s-bg)] py-3">
              <button type="button" onClick={sp.toggle} className="site-btn site-btn--solid !min-h-12">
                {sp.state === 'playing' ? 'Пауза' : sp.state === 'paused' ? 'Продолжить' : '▶ Слушать'}
              </button>
              {sp.state !== 'idle' && <button type="button" onClick={sp.stop} className="min-h-11 px-3 font-semibold underline">Стоп</button>}
              <label className="flex items-center gap-2 text-sm">
                Скорость
                <select name="rate" value={sp.rate} onChange={(e) => sp.setRate(Number(e.target.value))} className="min-h-11 border border-[var(--s-line)] bg-[var(--s-bg)] px-2">
                  <option value={0.8}>0.8×</option>
                  <option value={1}>1×</option>
                  <option value={1.2}>1.2×</option>
                </select>
              </label>
              {sp.voices.length > 0 && (
                <label className="flex min-w-0 items-center gap-2 text-sm">
                  Голос
                  <select name="voice" value={sp.voice?.name ?? ''} onChange={(e) => sp.setVoiceName(e.target.value)} className="min-h-11 max-w-[220px] border border-[var(--s-line)] bg-[var(--s-bg)] px-2">
                    {sp.voices.map((v) => (
                      <option key={v.name} value={v.name}>{v.name.replace(/Microsoft |Google /, '').replace(/ - .*/, '')}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--s-muted)]">Озвучка недоступна в этом браузере.</p>
          )}
          <div className="mt-6 grid gap-5">
            {paras.map((ss, pi) => (
              <p key={pi} className="text-read !text-xl">
                {ss.map((s) => {
                  k++;
                  const i = k;
                  const on = sp.current === i;
                  return (
                    <span key={i}>
                      <span
                        role={sp.supported ? 'button' : undefined}
                        tabIndex={sp.supported ? 0 : undefined}
                        onClick={() => sp.supported && sp.playFrom(i)}
                        onKeyDown={(e) => e.key === 'Enter' && sp.playFrom(i)}
                        className={`cursor-pointer transition-colors duration-200 ${on ? 'bg-[var(--s-mint)] text-[var(--s-ink)]' : 'hover:bg-[var(--s-soft)]'}`}
                      >
                        {s}
                      </span>{' '}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm text-[var(--s-muted)]">Нажмите на любое предложение, чтобы прослушать с него.</p>
        </article>

        <aside className="grid gap-6 lg:sticky lg:top-8" aria-label="Вопросы к тексту">
          {text.questions.map((q, qi) => {
            const picked = answers[qi];
            const ok = picked === q.correct;
            return (
              <div key={qi} className="border-t-2 border-[var(--s-read)] pt-4">
                <p className="site-kicker">Вопрос {qi + 1} · {SKILL_LABEL[q.skill]}</p>
                <p className="mt-1 text-lg font-semibold">{q.q}</p>
                <div className="mt-3 grid gap-2">
                  {q.options.map((o, oi) => {
                    const isPicked = picked === oi;
                    return (
                      <button
                        key={oi}
                        type="button"
                        disabled={ok}
                        onClick={() => answer(qi, oi)}
                        className={`min-h-11 border-2 px-3 py-2 text-left transition-colors ${isPicked && ok ? 'border-[var(--s-ok)] bg-[var(--s-mint)] text-[var(--s-ink)]' : isPicked ? 'border-[var(--s-warn)] text-[var(--s-warn)]' : 'border-[var(--s-line)] enabled:hover:border-[var(--s-read)]'}`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
                {picked !== null && !ok && <p className="mt-2 border-l-2 border-[var(--s-read)] bg-[var(--s-read-soft)] p-3 text-sm" aria-live="polite"><b>Подсказка.</b> {q.hint}</p>}
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
}

// «Уроки»: короткие интерактивные уроки по шагам (идея Oppia). Ошибка → разбор именно этой ошибки → новая попытка.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { LESSONS, type Lesson } from './content/lessons';
import { ChartView } from './ChartView';
import { recordAttempt, useProgress } from './progress';
import { Speak } from './Speak';

export default function SiteLessons() {
  const { id } = useParams();
  const lesson = LESSONS.find((l) => l.id === id);
  return lesson ? <Player key={lesson.id} lesson={lesson} /> : <List />;
}

function List() {
  const progress = useProgress();
  const done = new Set(progress.filter((a) => a.kind === 'lesson').map((a) => a.taskId));
  const groups = [
    { key: 'reading', title: 'Чтение', items: LESSONS.filter((l) => l.subject === 'reading') },
    { key: 'math', title: 'Математика', items: LESSONS.filter((l) => l.subject === 'math') },
  ];
  return (
    <section className="site-screen" aria-labelledby="lessons-h">
      <p className="site-kicker">Уроки</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 id="lessons-h" className="display text-[clamp(26px,2.6vw,34px)]">
          5 минут —
          <br />
          один навык.
        </h1>
        <p className="max-w-[40ch] text-lg text-[var(--s-muted)]">
          Объяснение, пример и вопросы. Ошиблись — урок объяснит, почему именно этот ответ неверен. Пройдено: <b className="text-[var(--s-ink)]">{done.size} из {LESSONS.length}</b>.
        </p>
      </div>
      <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-2">
        {groups.map((g) => (
          <div key={g.key}>
            <h2 className="site-kicker">{g.title}</h2>
            <ol className="mt-3 grid gap-2">
              {g.items.map((l, i) => (
                <li key={l.id}>
                  <Link to={`/lessons/${l.id}`} className="site-tile !flex-row items-center gap-5 border border-[var(--s-line)] !bg-[var(--s-bg)] p-5 hover:border-[var(--s-read)]">
                    <span className={`display grid h-14 w-14 shrink-0 place-items-center text-2xl ${done.has(l.id) ? 'bg-[var(--s-mint)] text-[var(--s-ink)]' : 'bg-[var(--s-soft)]'}`}>{done.has(l.id) ? '✓' : i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold">{l.title}</span>
                      <span className="block text-sm text-[var(--s-muted)]">{l.goal} · {l.steps.length} шагов · {l.minutes} мин</span>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Player({ lesson }: { lesson: Lesson }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);
  const step = lesson.steps[i];
  const isCheck = step.type === 'check';
  const solved = isCheck && picked !== null && step.options[picked].correct;
  const canNext = !isCheck || solved;

  function next() {
    if (i < lesson.steps.length - 1) {
      setI(i + 1);
      setPicked(null);
    } else {
      setFinished(true);
      recordAttempt({ taskId: lesson.id, kind: 'lesson', score: mistakes ? 0.5 : 1, hintsUsed: Math.min(3, mistakes) as 0 | 1 | 2 | 3, ts: Math.floor(Date.now() / 1000) });
    }
  }

  if (finished)
    return (
      <section className="site-screen" aria-labelledby="done-h">
        <p className="site-kicker">{lesson.goal}</p>
        <h1 id="done-h" className="display mt-4 text-[clamp(26px,2.6vw,34px)]">Урок пройден.</h1>
        <p className="mt-4 text-xl text-[var(--s-muted)]">{mistakes ? `Ошибок по ходу: ${mistakes}. Каждую вы разобрали.` : 'Без единой ошибки.'} Теперь закрепите на заданиях.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={lesson.practice} className="site-btn site-btn--solid">Практика по навыку →</Link>
          <Link to="/lessons" className="site-btn site-btn--ghost">Другие уроки</Link>
        </div>
      </section>
    );

  return (
    <section className="site-screen" aria-labelledby="lesson-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/lessons" className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">← Все уроки</Link>
        <p className="site-kicker">{lesson.goal} · шаг {i + 1} из {lesson.steps.length}</p>
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {lesson.steps.map((_, k) => <span key={k} className={`h-1.5 flex-1 ${k <= i ? 'bg-[var(--s-ink)]' : 'bg-[var(--s-line)]'}`} />)}
      </div>
      <h1 id="lesson-h" className="display mt-6 text-[clamp(26px,2.6vw,34px)]">{lesson.title}</h1>

      <div key={i} className="mt-6 grid max-w-4xl flex-1 content-start gap-5 animate-rise">
        {step.type === 'explain' && (
          <>
            <div className="flex items-start justify-between gap-3"><h2 className="text-2xl font-semibold">{step.title}</h2><Speak text={step.body} lang="ru" compact /></div>
            <p className="text-read !text-2xl">{step.body}</p>
          </>
        )}
        {step.type === 'example' && (
          <>
            <h2 className="text-2xl font-semibold">{step.title}</h2>
            <p className="text-read !text-xl">{step.doc}</p>
            <p className="text-xl">{step.body}</p>
          </>
        )}
        {step.type === 'chart' && (
          <>
            <h2 className="text-2xl font-semibold">{step.title}</h2>
            <ChartView chart={step.chart} />
            <p className="text-xl">{step.body}</p>
          </>
        )}
        {step.type === 'check' && (
          <>
            {step.chart && <ChartView chart={step.chart} />}
            <p className="text-2xl font-semibold">{step.question}</p>
            <div className="grid gap-2" role="group" aria-label="Варианты ответа">
              {step.options.map((o, k) => {
                const on = picked === k;
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={!!solved}
                    onClick={() => {
                      setPicked(k);
                      if (!o.correct) setMistakes((m) => m + 1);
                    }}
                    className={`min-h-14 border-2 p-4 text-left text-lg transition-colors ${on && o.correct ? 'border-[var(--s-ok)] bg-[var(--s-mint)] text-[var(--s-ink)]' : on ? 'border-[var(--s-warn)]' : 'border-[var(--s-line)] enabled:hover:border-[var(--s-read)]'}`}
                  >
                    {o.text}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <p key={picked} aria-live="polite" className={`animate-rise border-l-4 p-4 text-lg ${step.options[picked].correct ? 'border-[var(--s-ok)] bg-[var(--s-mint)] text-[var(--s-ink)]' : 'border-[var(--s-warn)] bg-[var(--s-soft)]'}`}>
                {!step.options[picked].correct && <b>Почему нет: </b>}
                {step.options[picked].feedback}
                {!step.options[picked].correct && ' Попробуйте другой вариант.'}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => { setI(Math.max(0, i - 1)); setPicked(null); }} disabled={i === 0} className="min-h-11 font-semibold underline-offset-4 hover:underline disabled:opacity-30">← Назад</button>
        <button type="button" onClick={next} disabled={!canNext} className="site-btn site-btn--solid disabled:opacity-30">
          {i === lesson.steps.length - 1 ? 'Завершить урок' : isCheck ? 'Дальше →' : 'Понятно →'}
        </button>
      </div>
    </section>
  );
}

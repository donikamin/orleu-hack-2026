// «Мини-тест PISA»: 8 вопросов вперемешку (4 чтение по навыкам + 4 математика), 10 минут, без подсказок.
// В конце — балл, уровень по каждому навыку и что прокачать. Ответы идут в прогресс и в QR для учителя.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { SKILL_LABEL, type Skill, type Task } from '@shared/types';
import { MATH, MATH_TOPIC_LABEL, checkMath, type MathTask } from './content/math';
import { PLAYABLE } from './SiteTrain';
import { ChartView } from './ChartView';
import { recordAttempt } from './progress';
import { track } from './analytics';

type Q = { kind: 'reading'; task: Task } | { kind: 'math'; task: MathTask };
const LIMIT = 10 * 60; // секунд
const LETTERS = 'АБВГДЕ';

function shuffle<T>(a: T[]) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function makeQuiz(): Q[] {
  const choice = PLAYABLE.filter((t) => t.lang === 'ru' && t.answer.type === 'choice');
  const reading = (['locate', 'understand', 'evaluate'] as Skill[]).map((s) => shuffle(choice.filter((t) => t.skill === s))[0]).filter(Boolean);
  const extra = shuffle(choice.filter((t) => !reading.includes(t)))[0];
  const math = shuffle(MATH).slice(0, 4);
  const qs: Q[] = [...[...reading, extra].map((task): Q => ({ kind: 'reading', task })), ...math.map((task): Q => ({ kind: 'math', task }))];
  return shuffle(qs);
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function SiteQuiz() {
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [quiz, setQuiz] = useState<Q[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [left, setLeft] = useState(LIMIT);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (phase !== 'run') return;
    const t = window.setInterval(() => setLeft((l) => (l > 0 ? l - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [phase]);
  useEffect(() => {
    if (phase === 'run' && left === 0) setPhase('done');
  }, [left, phase]);

  function start() {
    setQuiz(makeQuiz());
    setI(0);
    setAnswers([]);
    setLeft(LIMIT);
    setValue('');
    setPhase('run');
  }

  function answer(ok: boolean) {
    const q = quiz[i];
    recordAttempt({ taskId: q.task.id, kind: q.kind, score: ok ? 1 : 0, hintsUsed: 0, ts: Math.floor(Date.now() / 1000) });
    const next = [...answers, ok];
    setAnswers(next);
    setValue('');
    if (i + 1 >= quiz.length) {
      setPhase('done');
      track('quiz_finished', { score: next.filter(Boolean).length, of: quiz.length, seconds: LIMIT - left });
    } else setI(i + 1);
  }

  if (phase === 'intro')
    return (
      <section className="app-screen" aria-labelledby="quiz-h">
        <header className="app-head page-banner page-banner--quiz">
          <span className="chip chip--read">Мини-тест PISA</span>
          <h1 id="quiz-h" className="app-title">8 вопросов. 10 минут. Без подсказок.</h1>
          <p className="app-sub">Как настоящий PISA: чтение (найти, понять, оценить) и математика из жизни вперемешку. В конце — уровень по каждому навыку и что прокачать.</p>
        </header>
        <div className="quiz-facts mt-8">
          {[['8', 'вопросов'], ['10:00', 'минут на всё'], ['3', 'навыка чтения'], ['4', 'задачи по математике']].map(([b, s]) => (
            <div key={s} className="stat"><b>{b}</b><span>{s}</span></div>
          ))}
        </div>
        <button type="button" className="site-btn site-btn--solid mt-8 self-start" onClick={start}>Начать тест</button>
        <p className="muted-s mt-3">Ответы сохраняются в твоём прогрессе и попадут учителю через QR.</p>
      </section>
    );

  if (phase === 'done') return <Result quiz={quiz} answers={answers} timeUsed={LIMIT - left} onRetry={start} />;

  const q = quiz[i];
  return (
    <section className="app-screen" aria-labelledby="quiz-q">
      <div className="flex flex-wrap items-center gap-3">
        <span className="chip chip--read">Вопрос {i + 1} из {quiz.length}</span>
        <span className="progress min-w-[120px] flex-1" aria-hidden="true"><i style={{ width: `${(i / quiz.length) * 100}%` }} /></span>
        <span className={`quiz-timer ${left < 60 ? 'quiz-timer--low' : ''}`} role="timer" aria-label={`Осталось ${mmss(left)}`}>⏱ {mmss(left)}</span>
      </div>
      {q.kind === 'reading' ? (
        <ReadingQ key={q.task.id} task={q.task} onAnswer={answer} />
      ) : (
        <div key={q.task.id} className="mt-5 grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="card p-5">
            <p className="chip chip--math">{MATH_TOPIC_LABEL[q.task.topic]}</p>
            <h2 id="quiz-q" className="mt-2 text-sm font-semibold text-[var(--s-muted)]">{q.task.context.title}</h2>
            <p className="mt-1 text-lg">{q.task.context.body}</p>
            {q.task.chart && <div className="mt-3"><ChartView chart={q.task.chart} /></div>}
            {q.task.table && (
              <table className="mt-3 w-full text-left">
                <thead><tr>{q.task.table.head.map((h) => <th key={h} className="py-1 pr-3 text-sm">{h}</th>)}</tr></thead>
                <tbody>{q.task.table.rows.map((r) => <tr key={String(r[0])} className="border-t border-[var(--s-line)]">{r.map((c, k) => <td key={k} className="whitespace-nowrap py-1 pr-3">{typeof c === 'number' ? c.toLocaleString('ru-RU') : c}</td>)}</tr>)}</tbody>
              </table>
            )}
          </article>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (value.trim()) answer(checkMath(q.task as MathTask, value)); }}>
            <label htmlFor="quiz-answer" className="text-xl font-bold">{q.task.question}</label>
            <span className="quiz-input">
              <input id="quiz-answer" name="answer" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Например, 4100…" />
              <span>{q.task.unit}</span>
            </span>
            <button type="submit" className="site-btn site-btn--math justify-self-start" disabled={!value.trim()}>Ответить →</button>
          </form>
        </div>
      )}
    </section>
  );
}

function ReadingQ({ task, onAnswer }: { task: Task; onAnswer: (ok: boolean) => void }) {
  const a = task.answer;
  const options = a.type === 'choice' ? a.options : [];
  return (
    <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-3">
        {task.docs.map((d, k) => (
          <article key={k} className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--s-muted)]">{d.title}</h3>
            <p className="text-read mt-1 whitespace-pre-line">{d.body}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-3">
        <p className="chip chip--read">{SKILL_LABEL[task.skill]}</p>
        <h2 id="quiz-q" className="text-xl font-bold">{task.question}</h2>
        {options.map((o, k) => (
          <button key={k} type="button" className="quiz-opt" onClick={() => onAnswer(a.type === 'choice' && k === a.correct)}>
            <b>{LETTERS[k]}</b> {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function Result({ quiz, answers, timeUsed, onRetry }: { quiz: Q[]; answers: boolean[]; timeUsed: number; onRetry: () => void }) {
  const score = answers.filter(Boolean).length;
  const rows = useMemo(() => {
    const groups: { key: string; label: string; ok: number; n: number }[] = [];
    quiz.forEach((q, k) => {
      if (k >= answers.length) return;
      const key = q.kind === 'math' ? 'math' : q.task.skill;
      const label = q.kind === 'math' ? 'Математика' : SKILL_LABEL[q.task.skill];
      let g = groups.find((x) => x.key === key);
      if (!g) groups.push((g = { key, label, ok: 0, n: 0 }));
      g.n++;
      if (answers[k]) g.ok++;
    });
    return groups;
  }, [quiz, answers]);
  const weakest = [...rows].sort((a, b) => a.ok / a.n - b.ok / b.n)[0];
  const level = score >= 7 ? 'Высокий уровень — как у лучших в PISA' : score >= 5 ? 'Базовый уровень достигнут' : score >= 3 ? 'Почти базовый — чуть-чуть осталось' : 'Ниже базового — начни с уроков';
  const pct = Math.round((score / Math.max(1, quiz.length)) * 100);

  return (
    <section className="app-screen" aria-labelledby="res-h">
      <span className="chip chip--ai">Результат мини-теста</span>
      <div className="quiz-score mt-4">
        <div className="quiz-ring" style={{ '--p': pct } as React.CSSProperties}><span><b>{score}</b>/{quiz.length}</span></div>
        <div>
          <h1 id="res-h" className="app-title">{level}</h1>
          <p className="app-sub">Время: {mmss(timeUsed)} · ответов: {answers.length} из {quiz.length}. Базовый уровень PISA в Казахстане по чтению достигают 36% подростков.</p>
        </div>
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.key} className="card p-4">
            <div className="flex items-baseline justify-between"><b>{r.label}</b><b>{r.ok}/{r.n}</b></div>
            <span className="progress mt-2 block" style={{ '--c': r.key === 'math' ? 'var(--s-math)' : 'var(--s-read)' } as React.CSSProperties}><i style={{ width: `${(r.ok / r.n) * 100}%` }} /></span>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {weakest && weakest.ok < weakest.n && (
          <Link to={weakest.key === 'math' ? '/math' : `/train?skill=${weakest.key}`} className="site-btn site-btn--solid">Прокачать: {weakest.label} →</Link>
        )}
        <button type="button" className="site-btn site-btn--ghost" onClick={onRetry}>Пройти ещё раз</button>
        <Link to="/offline" className="site-btn site-btn--ghost">Отправить учителю по QR</Link>
      </div>
    </section>
  );
}

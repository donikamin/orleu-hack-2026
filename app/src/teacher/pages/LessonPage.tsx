// «Урок на доске»: учитель выводит задание на проектор или телевизор и ведёт разбор всем классом.
// Подсказки открываются по одной, ответ — только по кнопке. Голоса класса считаются по поднятым рукам.
// Клавиши: → следующее, ← предыдущее, П подсказка, О ответ, Т таймер.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { SKILL_LABEL, type Task } from '@shared/types';
import { db } from '../db';
import { makeTaskLookup, PACK } from '../pack';
import { Button } from '../../ui';

const LETTERS = 'АБВГДЕЖ';

function useTimer() {
  const [sec, setSec] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [on]);
  return { sec, on, toggle: () => setOn((v) => !v), reset: () => { setSec(0); setOn(false); } };
}

export default function LessonPage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const classTasks = useLiveQuery(() => db.tasks.where('classCode').equals(code).toArray(), [code]);
  const lookup = useMemo(() => makeTaskLookup(classTasks ?? []), [classTasks]);
  const ids = params.get('tasks')?.split(',').filter(Boolean) ?? PACK.slice(0, 3).map((t) => t.id);
  const tasks = ids.map((id) => lookup.get(id)).filter((t): t is Task => !!t);

  const [i, setI] = useState(0);
  const [hints, setHints] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [votes, setVotes] = useState<number[]>([]);
  const timer = useTimer();
  const task = tasks[i];

  const go = useCallback(
    (d: number) => {
      setI((v) => Math.min(tasks.length - 1, Math.max(0, v + d)));
      setHints(0);
      setReveal(false);
      setVotes([]);
      timer.reset();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (k === 'п' || k === 'g') setHints((h) => Math.min(3, h + 1));
      else if (k === 'о' || k === 'j') setReveal(true);
      else if (k === 'т' || k === 'n') timer.toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, timer]);

  if (!classTasks) return null;
  if (!task)
    return (
      <p className="text-muted">
        Задания не найдены. <Link className="font-semibold text-brand underline" to={`/teacher/${code}/assign`}>Выбрать задания</Link>
      </p>
    );

  const options = task.answer.type === 'choice' || task.answer.type === 'multi' ? task.answer.options : task.answer.type === 'spans' ? task.answer.sentences : [];
  const correct = new Set(task.answer.type === 'choice' ? [task.answer.correct] : task.answer.type === 'multi' || task.answer.type === 'spans' ? task.answer.correct : []);
  const totalVotes = votes.reduce((a, b) => a + (b ?? 0), 0);
  const mm = String(Math.floor(timer.sec / 60)).padStart(2, '0');
  const ss = String(timer.sec % 60).padStart(2, '0');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/teacher/${code}`} className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
          ← Выйти из урока
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">
            Задание {i + 1} из {tasks.length}
          </span>
          <Button variant="secondary" onClick={() => go(-1)} disabled={i === 0} aria-label="Предыдущее задание">←</Button>
          <Button variant="secondary" onClick={() => go(1)} disabled={i === tasks.length - 1} aria-label="Следующее задание">→</Button>
          <Button variant="secondary" onClick={() => document.documentElement.requestFullscreen?.()}>На весь экран</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-10" aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            {SKILL_LABEL[task.skill]} · сложность {task.difficulty}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">{task.title}</h1>
          <div className="mt-6 grid gap-4">
            {task.docs.map((d, j) => (
              <section key={j} className="rounded-xl bg-raised p-5">
                <h2 className="text-sm font-bold text-muted">{d.title}</h2>
                <p className="text-read mt-1 whitespace-pre-line !text-xl sm:!text-2xl">{d.body}</p>
              </section>
            ))}
          </div>
          <p className="mt-6 text-2xl font-bold sm:text-3xl">{task.question}</p>
          {options.length > 0 && (
            <ol className="mt-4 grid gap-3">
              {options.map((o, j) => {
                const right = reveal && correct.has(j);
                const share = totalVotes ? Math.round(((votes[j] ?? 0) / totalVotes) * 100) : 0;
                return (
                  <li
                    key={j}
                    className={`relative overflow-hidden rounded-xl border-2 p-4 text-lg sm:text-xl ${right ? 'border-brand bg-brand-soft' : 'border-line'}`}
                  >
                    {totalVotes > 0 && <span className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-300" style={{ width: `${share}%` }} aria-hidden="true" />}
                    <span className="relative flex items-start gap-3">
                      <b className="w-6 shrink-0">{LETTERS[j]}</b>
                      <span className="flex-1">{o}</span>
                      {totalVotes > 0 && <span className="text-base font-semibold tabular-nums text-muted">{share}%</span>}
                      {right && <span className="text-base font-bold text-brand">верно</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {hints > 0 && (
            <ol className="mt-6 space-y-2">
              {task.hints.slice(0, hints).map((h, j) => (
                <li key={j} className="rounded-xl border-l-4 border-accent bg-accent-soft p-4 text-lg animate-rise">
                  <b>Подсказка {j + 1}.</b> {h}
                </li>
              ))}
            </ol>
          )}
          {reveal && <p className="mt-6 rounded-xl bg-brand-soft p-5 text-lg animate-rise">{task.explanation}</p>}
        </article>

        <aside className="no-print space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <h2 className="font-bold">Ведение разбора</h2>
            <div className="mt-3 grid gap-2">
              <Button variant="secondary" onClick={() => setHints((h) => Math.min(3, h + 1))} disabled={hints >= 3}>
                Подсказка {Math.min(3, hints + 1)} из 3 <kbd className="ml-auto text-xs text-muted">П</kbd>
              </Button>
              <Button onClick={() => setReveal(true)} disabled={reveal}>
                Показать ответ <kbd className="ml-auto text-xs opacity-70">О</kbd>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">Сначала спросите класс и посчитайте руки, потом подсказки. Ответ — последним.</p>
          </section>

          {options.length > 0 && (
            <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
              <h2 className="font-bold">Голоса класса</h2>
              <p className="text-xs text-muted">Нажимайте за каждую поднятую руку</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {options.map((_, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setVotes((v) => { const n = [...v]; n[j] = (n[j] ?? 0) + 1; return n; })}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-raised px-4 font-bold hover:border-brand"
                    aria-label={`Голос за вариант ${LETTERS[j]}, сейчас ${votes[j] ?? 0}`}
                  >
                    {LETTERS[j]} <span className="tabular-nums">{votes[j] ?? 0}</span>
                  </button>
                ))}
              </div>
              {totalVotes > 0 && (
                <button type="button" className="mt-2 min-h-11 text-sm font-semibold text-brand underline" onClick={() => setVotes([])}>
                  Сбросить голоса
                </button>
              )}
            </section>
          )}

          <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
            <h2 className="font-bold">Таймер</h2>
            <p className="mt-1 font-mono text-4xl font-medium tabular-nums" aria-live="off">{mm}:{ss}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={timer.toggle}>{timer.on ? 'Пауза' : 'Старт'} <kbd className="text-xs text-muted">Т</kbd></Button>
              <Button variant="ghost" onClick={timer.reset}>Сброс</Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

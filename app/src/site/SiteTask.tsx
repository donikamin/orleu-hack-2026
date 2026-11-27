// Плеер одного задания: уверенность перед ответом, лестница из 3 подсказок, разбор после ответа.
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { SKILL_LABEL, type Task } from '@shared/types';
import { PACK } from '../teacher/pack';
import { MATH, MATH_TOPIC_LABEL, checkMath, type MathTask } from './content/math';
import { PLAYABLE } from './SiteTrain';
import { recordAttempt } from './progress';
import { Speak } from './Speak';
import { ChartView } from './ChartView';
import { askTutor, getAi } from './ai';
import { MIXED } from './content/mixed';
import { MixTaskView } from './MixTask';

const LETTERS = 'АБВГДЕЖЗ';
const CONF = [
  { v: 1, label: 'Угадываю' },
  { v: 2, label: 'Сомневаюсь' },
  { v: 3, label: 'Уверен' },
] as const;

function nextId(id: string) {
  const list = id.startsWith('m-') ? MATH.map((m) => m.id) : PLAYABLE.map((t) => t.id);
  const i = list.indexOf(id);
  return list[i + 1] ?? null;
}

function Shell({ kicker, title, back, children }: { kicker: string; title: string; back: string; children: React.ReactNode }) {
  return (
    <section className="site-screen" aria-labelledby="task-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={back} className="inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline">← Все задания</Link>
        <p className="site-kicker">{kicker}</p>
      </div>
      <h1 id="task-h" className="display mt-4 text-[clamp(26px,2.6vw,34px)]">{title}</h1>
      <div className="mt-6 grid flex-1 items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">{children}</div>
    </section>
  );
}

function Hints({ hints, shown }: { hints: readonly string[]; shown: number }) {
  if (!shown) return null;
  return (
    <ol className="grid gap-2" aria-live="polite">
      {hints.slice(0, shown).map((h, i) => (
        <li key={i} className="animate-rise border-l-2 border-[var(--s-read)] bg-[var(--s-read-soft)] p-4">
          <b>Подсказка {i + 1} из 3.</b> {h}
        </li>
      ))}
    </ol>
  );
}

function Confidence({ value, onChange, disabled }: { value: number; onChange: (v: 1 | 2 | 3) => void; disabled: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-[var(--s-muted)]">Перед ответом: насколько вы уверены?</legend>
      <div className="grid grid-cols-3 gap-2">
        {CONF.map((c) => (
          <label key={c.v} className={`flex min-h-11 cursor-pointer items-center justify-center border-2 px-2 text-sm font-semibold ${value === c.v ? 'border-[var(--s-read)] bg-[var(--s-read)] text-[var(--color-on-brand)]' : 'border-[var(--s-line)] hover:border-[var(--s-read)]'}`}>
            <input type="radio" name="conf" className="sr-only" checked={value === c.v} onChange={() => onChange(c.v)} />
            {c.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Result({ ok, wrong, text, next }: { ok: boolean; wrong: number; text: string; next: string | null }) {
  return (
    <div className="grid gap-3 animate-rise" aria-live="polite">
      <p className={`border-l-4 p-4 ${ok ? 'border-[var(--s-ok)] bg-[var(--s-mint)] text-[var(--s-ink)]' : 'border-[var(--s-warn)] bg-[var(--s-soft)]'}`}>
        <b>{ok ? (wrong ? `Верно, с ${wrong} ошибк${wrong === 1 ? 'ой' : 'ами'}.` : 'Верно с первого раза.') : 'Разбор.'}</b> {text}
      </p>
      <div className="flex flex-wrap gap-2">
        {next && <Link to={`/train/${next}`} className="site-btn site-btn--solid">Следующее задание →</Link>}
        <Link to="/train" className="site-btn site-btn--ghost">К списку</Link>
      </div>
    </div>
  );
}

function ReadingTask({ task }: { task: Task }) {
  const [conf, setConf] = useState<1 | 2 | 3 | 0>(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [hints, setHints] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [ai, setAi] = useState<{ text: string; source: string } | 'busy' | 'none' | null>(null);
  const a = task.answer;
  const options = a.type === 'choice' || a.type === 'multi' ? a.options : a.type === 'spans' ? a.sentences : [];
  const multi = a.type === 'multi' || a.type === 'spans';
  const correctSet = new Set(a.type === 'choice' ? [a.correct] : a.type === 'multi' || a.type === 'spans' ? a.correct : []);

  function finish(ok: boolean) {
    if (ok) {
      setDone(true);
      recordAttempt({ taskId: task.id, kind: 'reading', score: wrong.length ? 0.5 : 1, hintsUsed: Math.min(3, Math.max(hints, wrong.length)) as 0 | 1 | 2 | 3, confidence: conf || undefined, ts: Math.floor(Date.now() / 1000) });
    } else {
      setWrong((w) => [...w, w.length]);
      setHints((h) => Math.min(3, Math.max(h, wrong.length + 1)));
      if (wrong.length + 1 >= 4) {
        setDone(true);
        recordAttempt({ taskId: task.id, kind: 'reading', score: 0, hintsUsed: 3, confidence: conf || undefined, ts: Math.floor(Date.now() / 1000) });
      }
    }
  }

  function pickSingle(i: number) {
    if (done || !conf) return;
    if (correctSet.has(i)) finish(true);
    else {
      setPicked((p) => new Set(p).add(i));
      finish(false);
    }
  }

  function checkMulti() {
    const ok = picked.size === correctSet.size && [...picked].every((i) => correctSet.has(i));
    finish(ok);
  }

  const solved = done && wrong.length < 4;
  return (
    <Shell kicker={`${SKILL_LABEL[task.skill]} · сложность ${task.difficulty}${task.lang === 'kk' ? ' · қазақша' : ''}`} title={task.title} back="/train">
      <div className="grid gap-3">
        {task.docs.map((d, i) => (
          <article key={i} className="border border-[var(--s-line)] p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--s-muted)]">{d.title}</h2>
              <Speak text={d.body} lang={task.lang} compact />
            </div>
            <p className="text-read mt-1 whitespace-pre-line">{d.body}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-5 lg:sticky lg:top-8">
        <p className="text-xl font-semibold">{task.question}</p>
        <Confidence value={conf} onChange={setConf} disabled={done} />
        <div className={`grid gap-2 ${!conf && !done ? 'opacity-50' : ''}`} role="group" aria-label="Варианты ответа">
          {options.map((o, i) => {
            const on = picked.has(i);
            const right = done && correctSet.has(i);
            const bad = !multi && on && !correctSet.has(i);
            return (
              <button
                key={i}
                type="button"
                disabled={done || !conf || bad}
                aria-pressed={multi ? on : undefined}
                onClick={() => (multi ? setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; }) : pickSingle(i))}
                className={`flex min-h-12 items-start gap-3 border-2 p-3 text-left transition-colors ${right ? 'border-[var(--s-ok)] bg-[var(--s-mint)] text-[var(--s-ink)]' : bad ? 'border-[var(--s-warn)] text-[var(--s-warn)] line-through' : on ? 'border-[var(--s-read)] bg-[var(--s-soft)]' : 'border-[var(--s-line)] enabled:hover:border-[var(--s-read)]'}`}
              >
                <b className="w-5 shrink-0 ">{LETTERS[i]}</b>
                <span>{o}</span>
              </button>
            );
          })}
        </div>
        {!conf && !done && <p className="text-sm text-[var(--s-muted)]">Сначала отметьте уверенность — учитель увидит, кто ошибается уверенно.</p>}
        {multi && !done && (
          <button type="button" onClick={checkMulti} disabled={!conf || !picked.size} className="site-btn site-btn--solid disabled:opacity-40">
            Проверить ({picked.size})
          </button>
        )}
        {!done && (
          <button type="button" onClick={() => setHints((h) => Math.min(3, h + 1))} disabled={hints >= 3} className="justify-self-start text-sm font-semibold underline underline-offset-4 disabled:opacity-40">
            Нужна подсказка ({hints}/3)
          </button>
        )}
        {!done && wrong.length > 0 && getAi().mode !== 'off' && (
          <div className="grid gap-2">
            <button
              type="button"
              disabled={ai === 'busy'}
              onClick={async () => {
                setAi('busy');
                const last = [...picked].pop();
                const r = await askTutor({
                  taskId: task.id,
                  context: task.docs.map((d) => d.body).join(' '),
                  question: task.question,
                  studentAnswer: last !== undefined ? options[last] : '',
                  correctAnswer: [...correctSet].map((k) => options[k]).join(' '),
                  hintLevel: Math.min(3, wrong.length),
                });
                setAi(r ?? 'none');
              }}
              className="site-btn site-btn--ghost justify-self-start"
            >
              {ai === 'busy' ? 'ИИ думает…' : 'Спросить ИИ-репетитора'}
            </button>
            {ai && ai !== 'busy' && (
              <p className="animate-rise border-l-4 border-[var(--s-ok)] bg-[var(--s-mint)] p-4 text-[var(--s-ink)]" aria-live="polite">
                {ai === 'none' ? 'ИИ сейчас недоступен — воспользуйтесь подсказками ниже, они работают без сети.' : <><b>ИИ-репетитор:</b> {ai.text} <span className="block text-xs opacity-70">{ai.source} · ответ не раскрывается</span></>}
              </p>
            )}
          </div>
        )}
        {!done && <Hints hints={task.hints} shown={hints} />}
        {done && <Result ok={solved} wrong={wrong.length} text={task.explanation} next={nextId(task.id)} />}
      </div>
    </Shell>
  );
}

function MathTaskView({ task }: { task: MathTask }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(0);
  const [hints, setHints] = useState(0);
  const [done, setDone] = useState(false);

  function check(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || done) return;
    if (checkMath(task, value)) {
      setDone(true);
      recordAttempt({ taskId: task.id, kind: 'math', score: wrong ? 0.5 : 1, hintsUsed: Math.min(3, Math.max(hints, wrong)) as 0 | 1 | 2 | 3, ts: Math.floor(Date.now() / 1000) });
    } else {
      setWrong((w) => w + 1);
      setHints((h) => Math.min(3, Math.max(h, wrong + 1)));
    }
  }

  return (
    <Shell kicker={`Математика · ${MATH_TOPIC_LABEL[task.topic]} · сложность ${task.difficulty}`} title={task.title} back="/math">
      <article className="border border-[var(--s-line)] p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--s-muted)]">{task.context.title}</h2>
          <Speak text={`${task.context.body} ${task.question}`} lang="ru" compact />
        </div>
        <p className="text-read mt-2 !text-2xl">{task.context.body}</p>
        {task.chart && <div className="mt-4"><ChartView chart={task.chart} /></div>}
        {task.table && (
          <table className="mt-4 w-full border-collapse text-left text-lg">
            <thead>
              <tr className="border-b-2 border-[var(--s-read)]">
                {task.table.head.map((h) => <th key={h} scope="col" className="py-2 pr-4 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {task.table.rows.map((r) => (
                <tr key={String(r[0])} className="border-b border-[var(--s-line)]">
                  {r.map((c, i) => <td key={i} className={`py-2 pr-4 ${typeof c === 'number' ? 'tabular-nums' : ''}`}>{typeof c === 'number' ? c.toLocaleString('ru-RU') : c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
      <form onSubmit={check} className="grid gap-4 lg:sticky lg:top-8">
        <label htmlFor="math-answer" className="text-xl font-semibold">{task.question}</label>
        <div className="flex items-stretch border-2 border-[var(--s-read)]">
          <input
            id="math-answer"
            name="answer"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            disabled={done}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ответ…"
            className="min-h-14 min-w-0 flex-1 bg-transparent px-4 text-3xl outline-none"
          />
          <span className="grid place-items-center px-4 text-xl text-[var(--s-muted)]">{task.unit}</span>
        </div>
        {!done && (
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="site-btn site-btn--solid">Проверить</button>
            <button type="button" onClick={() => setHints((h) => Math.min(3, h + 1))} disabled={hints >= 3} className="site-btn site-btn--ghost disabled:opacity-40">Подсказка ({hints}/3)</button>
          </div>
        )}
        {wrong > 0 && !done && <p className="font-semibold text-[var(--s-warn)]" aria-live="polite">Пока не сходится. Попыток: {wrong}.</p>}
        {!done && <Hints hints={task.hints} shown={hints} />}
        {done && <Result ok wrong={wrong} text={task.explanation} next={nextId(task.id)} />}
      </form>
    </Shell>
  );
}

export default function SiteTask() {
  const { id = '' } = useParams();
  const mix = MIXED.find((m) => m.id === id);
  if (mix) return <MixTaskView key={id} task={mix} />;
  const math = MATH.find((m) => m.id === id);
  if (math) return <MathTaskView key={id} task={math} />;
  const task = PACK.find((t) => t.id === id);
  if (!task || task.answer.type === 'free')
    return (
      <section className="site-screen">
        <p>Задание не найдено. <Link className="underline" to="/train">К списку заданий</Link></p>
      </section>
    );
  return <ReadingTask key={id} task={task} />;
}

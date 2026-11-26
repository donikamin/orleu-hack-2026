// Плеер заданий новых форматов: «Докажи цитатой», «Верно/неверно», «Собери решение», «Нажми на график».
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { MIX_LABEL, MIXED, type MixTask } from './content/mixed';
import { ChartView } from './ChartView';
import { recordAttempt } from './progress';

function shuffle<T>(a: T[], seed: number) {
  const r = [...a];
  let s = seed;
  for (let i = r.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function Table({ t }: { t: { head: string[]; rows: (string | number)[][] } }) {
  return (
    <table className="w-full border-collapse overflow-hidden text-left">
      <thead><tr className="bg-[var(--s-soft)]">{t.head.map((h) => <th key={h} scope="col" className="px-3 py-2 text-sm font-semibold">{h}</th>)}</tr></thead>
      <tbody>{t.rows.map((r) => <tr key={String(r[0])} className="border-t border-[var(--s-line)]">{r.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

export function MixTaskView({ task }: { task: MixTask }) {
  const [tries, setTries] = useState(0);
  const [hints, setHints] = useState(0);
  const [done, setDone] = useState(false);
  const [wrongMsg, setWrongMsg] = useState<string | null>(null);
  // состояние форматов
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [tf, setTf] = useState<(boolean | null)[]>(task.kind === 'tf' ? task.statements.map(() => null) : []);
  const order = useMemo(() => (task.kind === 'order' ? shuffle(task.steps.map((_, i) => i), task.id.length * 7 + 3) : []), [task]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [point, setPoint] = useState<string | null>(null);

  const color = task.subject === 'math' ? 'chip--math' : 'chip--read';
  const list = MIXED.filter((m) => m.subject === task.subject);
  const next = list[list.indexOf(task) + 1];

  function finish(ok: boolean, msg: string) {
    if (ok) {
      setDone(true);
      setWrongMsg(null);
      recordAttempt({ taskId: task.id, kind: task.subject === 'math' ? 'math' : 'reading', score: tries ? 0.5 : 1, hintsUsed: Math.min(3, Math.max(hints, tries)) as 0 | 1 | 2 | 3, ts: Math.floor(Date.now() / 1000) });
    } else {
      setTries((t) => t + 1);
      setHints((h) => Math.min(3, Math.max(h, tries + 1)));
      setWrongMsg(msg);
    }
  }

  function check() {
    if (task.kind === 'cite') {
      const ok = sel.size === task.correct.length && task.correct.every((i) => sel.has(i));
      finish(ok, sel.size !== task.correct.length ? `Нужно выбрать ${task.correct.length === 1 ? 'одно предложение' : `${task.correct.length} предложения`}.` : 'Не то предложение. Перечитай вопрос.');
    } else if (task.kind === 'tf') {
      const wrongN = task.statements.filter((s, i) => tf[i] !== s.ok).length;
      finish(wrongN === 0, `Ошибок: ${wrongN}. Пересчитай утверждения, где сомневаешься.`);
    } else if (task.kind === 'order') {
      finish(chosen.every((v, i) => v === i), 'Порядок не тот. Подумай, что нужно знать до каждого шага.');
    } else if (task.kind === 'point') {
      finish(point === task.correct, 'Не эта точка. Сравни высоту соседних точек.');
    }
  }

  const ready =
    task.kind === 'cite' ? sel.size > 0 : task.kind === 'tf' ? tf.every((v) => v !== null) : task.kind === 'order' ? chosen.length === task.steps.length : !!point;

  return (
    <section className="app-screen" aria-labelledby="mix-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={task.subject === 'math' ? '/math' : '/train'} className="inline-flex min-h-11 items-center font-semibold hover:underline">← Все задания</Link>
        <span className={`chip ${color}`}>{MIX_LABEL[task.kind]} · сложность {task.difficulty}</span>
      </div>
      <h1 id="mix-h" className="app-title mt-3">{task.title}</h1>

      <div className="mt-6 grid flex-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          {'context' in task && <p className="text-read !text-xl rounded-[18px] bg-[var(--s-card)] p-5 shadow-[var(--s-shadow)]">{task.context}</p>}
          {task.kind === 'tf' && task.table && <div className="rounded-[18px] bg-[var(--s-card)] p-2 shadow-[var(--s-shadow)]"><Table t={task.table} /></div>}
          {(task.kind === 'tf' || task.kind === 'point') && task.chart && (
            <ChartView chart={task.chart} onPick={task.kind === 'point' && !done ? setPoint : undefined} picked={task.kind === 'point' ? point : null} good={done && task.kind === 'point' ? task.correct : null} />
          )}
          {task.kind === 'cite' && (
            <div className="grid gap-2 rounded-[18px] bg-[var(--s-card)] p-4 shadow-[var(--s-shadow)]">
              {task.sentences.map((s, i) => {
                const on = sel.has(i);
                const good = done && task.correct.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={done}
                    aria-pressed={on}
                    onClick={() => setSel((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    className={`text-read p-3 text-left transition-colors ${good ? 'bg-[var(--s-ai-soft)] ring-2 ring-[var(--s-ai)]' : on ? 'bg-[var(--s-read-soft)] ring-2 ring-[var(--s-read)]' : 'hover:bg-[var(--s-soft)]'}`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid content-start gap-4 lg:sticky lg:top-8">
          <p className="text-xl font-bold">{task.question}</p>

          {task.kind === 'tf' && (
            <ul className="grid gap-2">
              {task.statements.map((s, i) => (
                <li key={i} className="grid gap-2 rounded-[16px] bg-[var(--s-card)] p-3 shadow-[var(--s-shadow)]">
                  <span>{s.text}</span>
                  <span className="flex gap-2" role="group" aria-label={`Утверждение ${i + 1}`}>
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        disabled={done}
                        aria-pressed={tf[i] === v}
                        onClick={() => setTf((p) => p.map((x, k) => (k === i ? v : x)))}
                        className={`min-h-10 flex-1 rounded-full! font-semibold ${tf[i] === v ? (v ? 'bg-[var(--s-ai)] text-white' : 'bg-[var(--s-warn)] text-white') : 'bg-[var(--s-soft)]'}`}
                      >
                        {v ? 'Верно' : 'Неверно'}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {task.kind === 'order' && (
            <div className="grid gap-3">
              <ol className="grid gap-2" aria-label="Твой порядок">
                {chosen.map((k, n) => (
                  <li key={k} className="flex items-center gap-3 rounded-[14px] bg-[var(--s-math-soft)] p-3">
                    <b className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--s-math)] text-white">{n + 1}</b>
                    <span>{task.steps[k]}</span>
                  </li>
                ))}
              </ol>
              <div className="grid gap-2">
                {order.filter((k) => !chosen.includes(k)).map((k) => (
                  <button key={k} type="button" disabled={done} onClick={() => setChosen((c) => [...c, k])} className="min-h-12 rounded-[14px] bg-[var(--s-card)] p-3 text-left shadow-[var(--s-shadow)] hover:ring-2 hover:ring-[var(--s-math)]">
                    {task.steps[k]}
                  </button>
                ))}
              </div>
              {chosen.length > 0 && !done && <button type="button" onClick={() => setChosen([])} className="justify-self-start text-sm font-semibold underline">Начать сначала</button>}
            </div>
          )}

          {task.kind === 'point' && <p className="muted-s">{point ? `Выбрано: ${point}` : 'Нажми на точку на графике.'}</p>}

          {!done && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={check} disabled={!ready} className={`site-btn ${task.subject === 'math' ? 'site-btn--math' : 'site-btn--solid'}`}>Проверить</button>
              <button type="button" onClick={() => setHints((h) => Math.min(3, h + 1))} disabled={hints >= 3} className="site-btn site-btn--ghost">Подсказка {hints}/3</button>
            </div>
          )}
          {wrongMsg && !done && <p className="note note--warn" aria-live="polite">{wrongMsg}</p>}
          {!done && hints > 0 && (
            <ol className="grid gap-2">
              {task.hints.slice(0, hints).map((h, i) => <li key={i} className="note bg-[var(--s-soft)]"><b>Подсказка {i + 1}.</b> {h}</li>)}
            </ol>
          )}
          {done && (
            <div className="grid gap-3" aria-live="polite">
              <p className="rounded-[16px] bg-[var(--s-ai-soft)] p-4 text-[var(--s-ai-ink)]"><b>{tries ? `Верно, с ${tries} попытк${tries === 1 ? 'и' : 'ами'}.` : 'Верно с первого раза!'}</b> {task.explanation}</p>
              <div className="flex flex-wrap gap-2">
                {next && <Link to={`/train/${next.id}`} className="site-btn site-btn--solid">Следующее →</Link>}
                <Link to={task.subject === 'math' ? '/math' : '/train'} className="site-btn site-btn--ghost">К списку</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Плеер одного задания. В результат идёт первая попытка; вторая попытка после ошибки — чтобы разобраться.
import { useRef, useState } from 'react';
import { SKILL_LABEL, type Attempt, type Task } from '@shared/types';
import { answerText, gradeOffline, rubricScore, type Score } from '../lib/grade';
import { useOnline } from '../teacher/hooks';
import { Badge, Button, Card, inputClass, Notice } from '../ui';
import { checkWhy, getHint, gradeFree } from './api';

export type AttemptData = Omit<Attempt, 'taskId' | 'ts'>;
type Confidence = 1 | 2 | 3;
type Phase = 'answer' | 'self' | 'retry' | 'done';

const CONFIDENCE: [Confidence, string][] = [[1, 'Угадываю'], [2, 'Думаю, да'], [3, 'Уверен(а)']];
const TRICKS = ['Подмена фактов', 'Эмоции вместо доказательств', 'Ложный источник'];

export default function TaskPlayer({ task, askWhy, onAttempt, onNext }: { task: Task; askWhy: boolean; onAttempt: (d: AttemptData) => Promise<void>; onNext: () => void }) {
  const a = task.answer;
  const online = useOnline();
  const [doc, setDoc] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [tricks, setTricks] = useState<Record<number, string>>({});
  const [text, setText] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [hintBusy, setHintBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<Phase>('answer');
  const [rubric, setRubric] = useState<number[]>([]);
  const [score, setScore] = useState<Score>(0);
  const [retryOk, setRetryOk] = useState(false);
  const [feedback, setFeedback] = useState('');
  const submitted = useRef(false);

  const isFake = task.format === 'fake' && a.type === 'spans';
  const single = a.type === 'choice';
  const items = a.type === 'spans' ? a.sentences : a.type === 'free' ? [] : a.options;
  const correct = a.type === 'choice' ? [a.correct] : a.type === 'free' ? [] : a.correct;
  const answered = a.type === 'free' ? text.trim().length >= 3 : selected.length > 0 && (!isFake || selected.every((i) => tricks[i]));
  const ready = answered && confidence !== null && !hintBusy && !checking;
  const locked = phase === 'done' || phase === 'self' || checking;

  function toggle(i: number) {
    if (locked) return;
    setSelected((s) => (single ? [i] : s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  }

  async function hint() {
    if (hintBusy || hints.length >= 3) return;
    setHintBusy(true);
    const h = await getHint(task, answerText(task, selected, text), hints.length as 0 | 1 | 2);
    setHints((prev) => [...prev, h]);
    setHintBusy(false);
  }

  async function finish(s: Score) {
    setScore(s);
    await onAttempt({
      score: s,
      hintsUsed: hints.length as 0 | 1 | 2 | 3,
      ...(confidence ? { confidence } : {}),
      ...(a.type === 'free' ? { answer: text.trim() } : {}),
    });
  }

  async function submit() {
    if (submitted.current) return; // двойной тап
    submitted.current = true;
    if (a.type === 'free') {
      setChecking(true);
      try {
        const r = await gradeFree(task.id, text.trim());
        setFeedback(r.feedback);
        await finish(r.score);
        setPhase('done');
      } catch {
        setPhase('self');
      }
      setChecking(false);
      return;
    }
    const s = gradeOffline(task, selected);
    await finish(s);
    setPhase(s === 1 ? 'done' : 'retry');
  }

  async function submitSelf() {
    setPhase('done');
    await finish(rubricScore(rubric.length, a.type === 'free' ? a.rubric.length : 0));
  }

  function retry() {
    setRetryOk(gradeOffline(task, selected) === 1);
    setPhase('done');
  }

  return (
    <div className="grid gap-4 pb-8">
      <Card>
        {task.docs.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Документы">
            {task.docs.map((d, i) => (
              <button
                key={i}
                id={`tab-${i}`}
                type="button"
                role="tab"
                aria-selected={doc === i}
                aria-controls="doc-panel"
                onClick={() => setDoc(i)}
                className={`min-h-11 rounded-xl border px-3 py-1 text-left text-sm font-semibold ${doc === i ? 'border-brand bg-brand text-white' : 'border-line bg-paper text-muted hover:text-ink'}`}
              >
                {i + 1}. {d.title}
              </button>
            ))}
          </div>
        )}
        {task.docs[doc] && (
          <div id="doc-panel" role={task.docs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={task.docs.length > 1 ? `tab-${doc}` : undefined}>
            <h2 className="font-bold">{task.docs[doc].title}</h2>
            <p className="text-read mt-2 whitespace-pre-line">{task.docs[doc].body}</p>
          </div>
        )}
      </Card>

      <Card>
        <Badge tone="brand">{SKILL_LABEL[task.skill]}</Badge>
        <h2 className="mt-2 text-lg font-bold">{task.question}</h2>
        {!single && a.type !== 'free' && <p className="mt-1 text-sm text-muted">Можно отметить несколько.</p>}

        {a.type === 'free' ? (
          <textarea aria-label="Твой ответ" className={`${inputClass} mt-4 min-h-32`} maxLength={1500} value={text} disabled={locked} onChange={(e) => setText(e.target.value)} />
        ) : (
          <ul className="mt-4 grid gap-2">
            {items.map((item, i) => {
              const on = selected.includes(i);
              const right = phase === 'done' && correct.includes(i);
              const wrong = phase === 'done' && on && !right;
              const look = right ? 'border-brand bg-brand-soft' : wrong ? 'border-danger bg-danger-soft' : on ? 'border-brand ring-2 ring-brand/30' : 'border-line hover:border-ink/30';
              return (
                <li key={i}>
                  <button type="button" aria-pressed={on} disabled={locked} onClick={() => toggle(i)} className={`flex min-h-12 w-full items-start gap-3 rounded-xl border bg-surface px-4 py-3 text-left ${a.type === 'spans' ? 'text-read' : ''} ${look}`}>
                    <span aria-hidden className="w-5 shrink-0 font-bold">{right ? '✓' : wrong ? '✗' : on ? '●' : '○'}</span>
                    <span className="min-w-0">
                      {item}
                      {(right || wrong) && <span className="sr-only">{right ? ' — верно' : ' — неверно'}</span>}
                    </span>
                  </button>
                  {isFake && on && (
                    <div role="group" aria-label="Тип манипуляции" className="mt-2 mb-2 flex flex-wrap gap-2 pl-4">
                      {TRICKS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={tricks[i] === k}
                          disabled={locked}
                          onClick={() => setTricks((t) => ({ ...t, [i]: k }))}
                          className={`min-h-10 rounded-full border px-3 text-sm font-semibold ${tricks[i] === k ? 'border-accent bg-accent text-white' : 'border-line bg-paper text-muted'}`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {isFake && phase === 'answer' && <p className="mt-2 text-sm text-muted">К каждому отмеченному предложению выбери тип манипуляции.</p>}

        {hints.length > 0 && (
          <ol className="mt-4 grid gap-2" aria-live="polite">
            {hints.map((h, i) => (
              <li key={i} className="rounded-xl border border-accent/20 bg-accent-soft px-4 py-3">
                <span className="text-sm font-bold text-accent">Подсказка {i + 1}</span>
                <p>{h}</p>
              </li>
            ))}
          </ol>
        )}

        {phase === 'answer' && (
          <fieldset className="mt-5" disabled={checking}>
            <legend className="text-sm font-semibold">Насколько ты уверен(а)?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CONFIDENCE.map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={confidence === v}
                  onClick={() => setConfidence(v)}
                  className={`min-h-11 rounded-xl border px-1 text-sm font-semibold ${confidence === v ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {phase === 'retry' && (
          <div className="mt-4">
            <Notice>
              {score === 0.5 ? 'Частично верно.' : 'Пока неверно.'} Возьми подсказку и попробуй ещё раз. Результат уже записан, вторая попытка — чтобы разобраться.
            </Notice>
          </div>
        )}

        {(phase === 'answer' || phase === 'retry') && (
          <div className="mt-4 flex flex-wrap gap-2">
            {hints.length < 3 && (
              <Button variant="secondary" className="flex-1" onClick={hint} disabled={hintBusy || checking}>
                {hintBusy ? 'Думаю…' : `Подсказка ${hints.length + 1} из 3`}
              </Button>
            )}
            {phase === 'answer' ? (
              <Button className="flex-1" onClick={submit} disabled={!ready}>{checking ? 'Проверяю…' : 'Ответить'}</Button>
            ) : (
              <Button className="flex-1" onClick={retry} disabled={selected.length === 0 || hintBusy}>Проверить ещё раз</Button>
            )}
          </div>
        )}
        {phase === 'retry' && <Button variant="ghost" className="mt-2 w-full" onClick={() => setPhase('done')}>Показать разбор</Button>}

        {phase === 'self' && a.type === 'free' && (
          <div className="mt-4">
            <p className="font-semibold">Проверь себя сам: что есть в твоём ответе?</p>
            {a.rubric.map((r, i) => (
              <label key={i} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={rubric.includes(i)} onChange={() => setRubric((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))} />
                {r}
              </label>
            ))}
            <Button className="mt-3 w-full" onClick={submitSelf}>Готово</Button>
          </div>
        )}
      </Card>

      {phase === 'done' && (
        <div className="grid gap-4" aria-live="polite">
          <Card>
            <h2 className="text-lg font-bold">
              {score === 1 ? '✓ Верно!' : retryOk ? '✓ Теперь верно!' : score === 0.5 ? 'Частично верно' : 'Разберём вместе'}
            </h2>
            {feedback && <p className="mt-2">{feedback}</p>}
            <p className="text-read mt-2">{task.explanation}</p>
            {isFake && <p className="mt-2 text-sm text-muted">Сравни с разбором типы, которые ты выбрал(а). На результат они не влияют.</p>}
          </Card>
          {askWhy && online && score === 1 && a.type !== 'free' && <Why taskId={task.id} />}
          <Button onClick={onNext}>Дальше</Button>
        </div>
      )}
    </div>
  );
}

function Why({ taskId }: { taskId: string }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  async function send() {
    setBusy(true);
    try {
      const r = await checkWhy(taskId, reason.trim());
      setReply(r.feedback || (r.ok ? 'Хорошее объяснение!' : 'Перечитай текст: что в нём подтверждает ответ?'));
    } catch {
      setReply('Сейчас проверить не получилось. Идём дальше.');
    }
    setBusy(false);
  }

  return (
    <Card>
      <h2 className="font-bold">Почему это верный ответ?</h2>
      <p className="text-sm text-muted">Объясни одним предложением. Можно пропустить.</p>
      {reply ? (
        <p className="mt-3" role="status">{reply}</p>
      ) : (
        <>
          <textarea aria-label="Почему" className={`${inputClass} mt-3 min-h-20`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="secondary" className="mt-2" onClick={send} disabled={busy || reason.trim().length < 3}>{busy ? 'Проверяю…' : 'Отправить'}</Button>
        </>
      )}
    </Card>
  );
}

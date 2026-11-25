import { useState } from 'react';
import type { Skill, Task } from '@shared/types';
import { SKILLS, SKILL_LABEL } from '@shared/types';
import { db } from '../db';
import { ApiUnavailable, imageFileToBase64, photoToTasks } from '../api';
import { useClass, useOnline } from '../hooks';
import { Badge, Button, ButtonLink, Card, Field, inputClass, Notice } from '../../ui';
import { sampleTasksFromPhoto } from '../sample';

type Stage = 'pick' | 'loading' | 'review' | 'saved';

export default function PhotoTasksPage() {
  const { cls } = useClass();
  const online = useOnline();
  const [stage, setStage] = useState<Stage>('pick');
  const [image, setImage] = useState<{ base64: string; dataUrl: string; kb: number } | null>(null);
  const [lang, setLang] = useState<'ru' | 'kk'>('ru');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSample, setIsSample] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setImage(await imageFileToBase64(file));
  }

  async function generate() {
    if (!image) return;
    setStage('loading');
    setError(null);
    try {
      const t = (await photoToTasks(image.base64, cls.grade, lang)).map((x) => ({ ...x, source: 'photo' as const }));
      setTasks(t);
      setKeep(new Set(t.map((x) => x.id)));
      setIsSample(false);
      setStage('review');
    } catch (e) {
      setError(e instanceof ApiUnavailable ? e.message : 'Не получилось сделать задания');
      setStage('pick');
    }
  }

  function showSample() {
    const t = sampleTasksFromPhoto();
    setTasks(t);
    setKeep(new Set(t.map((x) => x.id)));
    setIsSample(true);
    setStage('review');
  }

  function update(id: string, patch: Partial<Task>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function save() {
    const chosen = tasks.filter((t) => keep.has(t.id));
    await db.tasks.bulkPut(chosen.map((t) => ({ ...t, classCode: cls.code, createdAt: Date.now() })));
    setStage('saved');
  }

  if (stage === 'saved')
    return (
      <Card className="max-w-xl">
        <h2 className="text-lg font-bold">Задания сохранены в класс</h2>
        <p className="mt-2 text-muted">Теперь их можно выдать ученикам через QR-код или распечатать.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink to={`/teacher/${cls.code}/assign`}>Выдать задание</ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              setStage('pick');
              setImage(null);
              setTasks([]);
            }}
          >
            Ещё одна страница
          </Button>
        </div>
      </Card>
    );

  if (stage === 'review')
    return (
      <div className="space-y-4">
        {isSample && <Notice>Это пример (демо-режим): сервер ИИ ещё не подключён. Так будет выглядеть результат.</Notice>}
        <p className="text-muted">Проверьте задания: ИИ может ошибаться. Исправьте текст и снимите галочку с лишних.</p>
        {tasks.map((t, i) => (
          <TaskEditor key={t.id} index={i} task={t} kept={keep.has(t.id)} onToggle={(v) => setKeep((s) => { const n = new Set(s); if (v) n.add(t.id); else n.delete(t.id); return n; })} onChange={(p) => update(t.id, p)} />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={keep.size === 0}>
            Сохранить {keep.size} в класс
          </Button>
          <Button variant="secondary" onClick={() => setStage('pick')}>
            Назад
          </Button>
        </div>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <h2 className="text-lg font-bold">Страница учебника → задания PISA</h2>
        <p className="mt-1 text-muted">
          Сфотографируйте любую страницу с текстом. ИИ сделает 3–6 заданий на три навыка (найти, понять, оценить) с подсказками и
          ключами. Вы проверите их перед раздачей.
        </p>
        <div className="mt-5 space-y-4">
          <Field label="Фото страницы" hint="Ровно, при хорошем свете, весь текст в кадре.">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-soft file:px-4 file:font-semibold file:text-brand"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </Field>
          {image && <img src={image.dataUrl} alt="Выбранная страница" width={1600} height={1200} className="h-auto max-h-80 w-auto rounded-xl border border-line object-contain" />}
          {image && <p className="text-xs text-muted">После сжатия: {image.kb} КБ (экономим трафик)</p>}
          <Field label="Язык заданий">
            <select className={inputClass} value={lang} onChange={(e) => setLang(e.target.value as 'ru' | 'kk')}>
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </select>
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={generate} disabled={!image || stage === 'loading' || !online}>
              {stage === 'loading' ? 'ИИ читает страницу… (до 30 с)' : 'Сделать задания'}
            </Button>
            <Button variant="ghost" onClick={showSample}>
              Посмотреть пример
            </Button>
          </div>
          {!online && <p className="text-sm text-accent">Нужен интернет. Остальная панель работает без сети.</p>}
        </div>
      </Card>
      <Card>
        <h3 className="font-bold">Почему это важно</h3>
        <p className="mt-2 text-sm text-muted">
          По анализу Всемирного банка, учителям в Казахстане не хватает навыка составлять контекстные задания на функциональную
          грамотность. Oqy делает черновик за вас, а решение остаётся за учителем.
        </p>
      </Card>
    </div>
  );
}

function TaskEditor({ task, index, kept, onToggle, onChange }: { task: Task; index: number; kept: boolean; onToggle: (v: boolean) => void; onChange: (p: Partial<Task>) => void }) {
  return (
    <Card className={kept ? '' : 'opacity-60'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-brand)]" checked={kept} onChange={(e) => onToggle(e.target.checked)} />
          Задание {index + 1}
        </label>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Навык"
            className="min-h-9 rounded-lg border border-line bg-surface px-2 text-sm"
            value={task.skill}
            onChange={(e) => onChange({ skill: e.target.value as Skill })}
          >
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {SKILL_LABEL[s]}
              </option>
            ))}
          </select>
          <Badge>сложность {task.difficulty}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <Field label="Вопрос">
          <textarea className={`${inputClass} min-h-20`} value={task.question} onChange={(e) => onChange({ question: e.target.value })} />
        </Field>
        {task.answer.type === 'choice' && (
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Варианты (отметьте верный)</legend>
            <div className="grid gap-2">
              {task.answer.options.map((o, i) => (
                <label key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`c-${task.id}`}
                    className="h-5 w-5 accent-[var(--color-brand)]"
                    checked={task.answer.type === 'choice' && task.answer.correct === i}
                    onChange={() => task.answer.type === 'choice' && onChange({ answer: { ...task.answer, correct: i } })}
                  />
                  <input
                    className={inputClass}
                    value={o}
                    aria-label={`Вариант ${i + 1}`}
                    onChange={(e) => {
                      if (task.answer.type !== 'choice') return;
                      const options = [...task.answer.options];
                      options[i] = e.target.value;
                      onChange({ answer: { ...task.answer, options } });
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Подсказки и объяснение</summary>
          <div className="mt-3 grid gap-2">
            {task.hints.map((h, i) => (
              <Field key={i} label={`Подсказка ${i + 1}`}>
                <input
                  className={inputClass}
                  value={h}
                  onChange={(e) => {
                    const hints = [...task.hints] as Task['hints'];
                    hints[i] = e.target.value;
                    onChange({ hints });
                  }}
                />
              </Field>
            ))}
            <Field label="Объяснение (после ответа)">
              <textarea className={`${inputClass} min-h-16`} value={task.explanation} onChange={(e) => onChange({ explanation: e.target.value })} />
            </Field>
          </div>
        </details>
      </div>
    </Card>
  );
}

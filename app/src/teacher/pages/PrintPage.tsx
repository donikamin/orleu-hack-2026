// Печать листа заданий для учеников без телефона + лист ответов для учителя.
import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { SKILL_LABEL } from '@shared/types';
import { db } from '../db';
import { makeTaskLookup } from '../pack';
import { Button } from '../../ui';

export default function PrintPage() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const cls = useLiveQuery(() => db.classes.get(code), [code]);
  const classTasks = useLiveQuery(() => db.tasks.where('classCode').equals(code).toArray(), [code]);
  const lookup = useMemo(() => makeTaskLookup(classTasks ?? []), [classTasks]);
  const ids = params.get('tasks')?.split(',').filter(Boolean) ?? [];
  const tasks = ids.map((id) => lookup.get(id)).filter((t) => !!t);

  if (!classTasks) return null;

  return (
    <div className="mx-auto max-w-3xl font-serif text-[15px] leading-relaxed">
      <div className="no-print mb-6 flex flex-wrap gap-2 font-sans">
        <Button onClick={() => window.print()}>Печать</Button>
        <Link to={`/teacher/${code}/assign?tasks=${ids.join(',')}`} className="inline-flex min-h-11 items-center px-3 font-semibold text-brand underline">
          Назад к выбору
        </Link>
      </div>

      <header className="mb-6 border-b border-ink pb-3 font-sans">
        <p className="text-sm">{cls?.name ?? code}</p>
        <h1 className="text-2xl font-extrabold">Читаем и понимаем</h1>
        <p className="mt-2 text-sm">Номер ученика: ______ &nbsp; Дата: ____________</p>
      </header>

      {tasks.map((t, i) => (
        <section key={t.id} className="mb-8 break-inside-avoid">
          <h2 className="font-sans text-lg font-bold">
            {i + 1}. {t.title}
          </h2>
          {t.docs.map((d, j) => (
            <div key={j} className="mt-2 rounded border border-ink/30 p-3">
              <p className="font-sans text-sm font-bold">{d.title}</p>
              <p className="whitespace-pre-line">{d.body}</p>
            </div>
          ))}
          {t.answer.type === 'spans' && (
            <ol className="mt-2 list-[upper-alpha] pl-6">
              {t.answer.sentences.map((s, j) => (
                <li key={j}>{s}</li>
              ))}
            </ol>
          )}
          <p className="mt-3 font-semibold">{t.question}</p>
          {(t.answer.type === 'choice' || t.answer.type === 'multi') && (
            <ol className="mt-1 list-[upper-alpha] pl-6">
              {t.answer.options.map((o, j) => (
                <li key={j}>☐ {o}</li>
              ))}
            </ol>
          )}
          <p className="mt-2">Уверенность: ☐ угадываю ☐ сомневаюсь ☐ уверен</p>
          <p className="mt-2">Почему я так думаю: ________________________________________________</p>
        </section>
      ))}

      <section className="print-page mt-10 border-t-2 border-dashed border-ink pt-4 font-sans text-sm" style={{ breakBefore: 'page' }}>
        <h2 className="text-lg font-bold">Ключ для учителя</h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          {tasks.map((t) => (
            <li key={t.id}>
              <span className="font-semibold">{t.title}</span> ({SKILL_LABEL[t.skill]}):{' '}
              {t.answer.type === 'choice'
                ? String.fromCharCode(65 + t.answer.correct)
                : t.answer.type === 'multi' || t.answer.type === 'spans'
                  ? t.answer.correct.map((c) => String.fromCharCode(65 + c)).join(', ')
                  : 'по рубрике'}
              . {t.explanation}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

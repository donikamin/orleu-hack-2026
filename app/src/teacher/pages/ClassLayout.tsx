import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveAttempts } from '../db';
import { makeTaskLookup } from '../pack';
import { summarizeClass } from '../analytics';
import { fetchClassFromServer } from '../api';
import type { ClassContext } from '../hooks';
import { Badge, Button, EmptyState, Notice } from '../../ui';

const TABS = [
  { to: '', label: 'Карта класса', end: true },
  { to: 'scan', label: 'Сканировать QR' },
  { to: 'photo', label: 'Фото → задания' },
  { to: 'assign', label: 'Выдать задание' },
  { to: 'misconceptions', label: 'Уверенно ошибаются' },
  { to: 'tomorrow', label: 'Что делать завтра' },
];

export default function ClassLayout() {
  const { code = '' } = useParams();
  const cls = useLiveQuery(() => db.classes.get(code), [code]);
  const attempts = useLiveQuery(() => db.attempts.where('classCode').equals(code).toArray(), [code]);
  const classTasks = useLiveQuery(() => db.tasks.where('classCode').equals(code).toArray(), [code]);
  const [syncMsg, setSyncMsg] = useState<{ tone: 'brand' | 'danger'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const lookup = useMemo(() => makeTaskLookup(classTasks ?? []), [classTasks]);
  const students = useMemo(() => (cls && attempts ? summarizeClass(cls.size, attempts, lookup) : []), [cls, attempts, lookup]);

  if (cls === undefined && attempts === undefined) return null; // загрузка
  if (!cls)
    return (
      <EmptyState title="Класс не найден на этом устройстве">
        <Link to="/teacher" className="font-semibold text-brand underline">
          К списку классов
        </Link>
      </EmptyState>
    );

  async function pull() {
    if (!cls) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const data = await fetchClassFromServer(cls.code, cls.teacherKey);
      const byStudent = new Map<number, typeof data.attempts>();
      for (const a of data.attempts ?? []) byStudent.set(a.number, [...(byStudent.get(a.number) ?? []), a]);
      let added = 0;
      for (const [n, list] of byStudent) added += await saveAttempts(cls.code, n, list ?? [], 'online');
      setSyncMsg({ tone: 'brand', text: added ? `Получено новых попыток: ${added}` : 'Новых данных на сервере нет' });
    } catch (e) {
      setSyncMsg({ tone: 'danger', text: `${(e as Error).message}. Данные с QR-кодов при этом на месте.` });
    } finally {
      setSyncing(false);
    }
  }

  const ctx: ClassContext = { cls, attempts: attempts ?? [], classTasks: classTasks ?? [], lookup, students };

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/teacher" className="mb-2 inline-block text-sm font-semibold text-brand hover:underline">
            ← Мои классы
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{cls.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-muted">
            <span>
              Код класса <span className="font-mono font-bold tracking-widest text-ink">{cls.code}</span>
            </span>
            <span aria-hidden>·</span>
            <span>{ctx.attempts.length} попыток</span>
            {cls.code === 'DEMO' && <Badge tone="accent">демо-данные</Badge>}
          </p>
        </div>
        <Button variant="secondary" onClick={pull} disabled={syncing}>
          {syncing ? 'Обновляю…' : 'Обновить с сервера'}
        </Button>
      </div>
      {syncMsg && (
        <div className="no-print mb-4">
          <Notice tone={syncMsg.tone}>{syncMsg.text}</Notice>
        </div>
      )}
      <nav aria-label="Разделы класса" className="no-print -mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap ${
                    isActive ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'
                  }`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet context={ctx} />
    </>
  );
}

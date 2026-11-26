import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveAttempts } from '../db';
import { makeTaskLookup } from '../pack';
import { summarizeClass } from '../analytics';
import { fetchClassFromServer } from '../api';
import type { ClassContext } from '../hooks';
import { DemoGuide } from '../DemoGuide';
import { Badge, Button, EmptyState, Notice } from '../../ui';

const GROUPS: { title: string; items: { to: string; label: string; end?: boolean }[] }[] = [
  {
    title: 'Анализ',
    items: [
      { to: '', label: 'Карта класса', end: true },
      { to: 'tasks', label: 'Трудные задания' },
      { to: 'trend', label: 'Динамика' },
      { to: 'misconceptions', label: 'Уверенно ошибаются' },
    ],
  },
  {
    title: 'Урок',
    items: [
      { to: 'tomorrow', label: 'Что делать завтра' },
      { to: 'lesson', label: 'Урок на доске' },
      { to: 'assign', label: 'Выдать задание' },
      { to: 'photo', label: 'Фото → задания' },
    ],
  },
  {
    title: 'Данные',
    items: [
      { to: 'scan', label: 'Сканировать QR' },
      { to: 'reports', label: 'Отчёты для собрания' },
      { to: 'data', label: 'Плакат, экспорт, копия' },
    ],
  },
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
      {cls.code === 'DEMO' && <DemoGuide />}
      {syncMsg && (
        <div className="no-print mb-4">
          <Notice tone={syncMsg.tone}>{syncMsg.text}</Notice>
        </div>
      )}
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Разделы класса" className="no-print -mx-4 mb-6 overflow-x-auto px-4 lg:mx-0 lg:mb-0 lg:overflow-visible lg:px-0">
          <div className="flex min-w-max gap-6 lg:sticky lg:top-20 lg:min-w-0 lg:flex-col lg:gap-5">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted">{g.title}</p>
                <ul className="flex gap-1 lg:flex-col">
                  {g.items.map((t) => (
                    <li key={t.to}>
                      <NavLink
                        to={t.to}
                        end={t.end}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                            isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-raised hover:text-ink'
                          }`
                        }
                      >
                        {t.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">
          <Outlet context={ctx} />
        </div>
      </div>
    </>
  );
}

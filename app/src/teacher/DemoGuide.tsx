// Гид по демо-классу: что это за экран и куда смотреть дальше. Только для класса DEMO, можно свернуть.
import { useState } from 'react';
import { NavLink } from 'react-router';

const STEPS = [
  { to: '', end: true, title: 'Карта класса', text: '12 учеников по трём навыкам PISA. Цифра в ячейке — уровень от 1 до 5. Нажмите на номер ученика.' },
  { to: 'tasks', title: 'Трудные задания', text: 'Что не получается у всего класса и где ошибаются уверенно.' },
  { to: 'lesson', title: 'Урок на доске', text: 'Разбор на проекторе: П — подсказка, О — ответ, Т — таймер.' },
  { to: 'reports', title: 'Отчёты для собрания', text: 'По странице на ученика с советом родителям. Печать или PDF.' },
  { to: '/demo/qr', title: 'Как приходят результаты', text: 'Тестовый ученик показывает QR. Отсканируйте его во вкладке «Сканировать QR».' },
];

export function DemoGuide() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('oqy-demo-guide') !== 'closed';
    } catch {
      return true;
    }
  });
  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem('oqy-demo-guide', v ? 'open' : 'closed');
    } catch {
      /* без сохранения */
    }
  };

  if (!open)
    return (
      <button type="button" onClick={() => toggle(true)} className="no-print mb-4 min-h-11 text-sm font-semibold text-brand underline">
        Показать гид по демо-классу
      </button>
    );

  return (
    <section aria-labelledby="demo-guide-h" className="no-print mb-6 rounded-[var(--radius-card)] border border-brand/25 bg-brand-soft p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="demo-guide-h" className="text-lg font-bold">Это демо: панель учителя 8 «Б» с выдуманными результатами</h2>
          <p className="mt-1 text-sm text-muted">
            Ученики решали задания в телефоне без интернета и передали результаты QR-кодом. Пройдите 5 экранов по порядку — 3 минуты.
          </p>
        </div>
        <button type="button" onClick={() => toggle(false)} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted hover:text-ink">
          Свернуть
        </button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <NavLink
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                `flex h-full flex-col gap-1 rounded-xl border p-3 transition-colors ${isActive ? 'border-brand bg-surface' : 'border-transparent bg-surface/60 hover:border-brand/40'}`
              }
            >
              <span className="text-xs font-bold text-brand">Шаг {i + 1}</span>
              <span className="font-semibold">{s.title}</span>
              <span className="text-sm text-muted">{s.text}</span>
            </NavLink>
          </li>
        ))}
      </ol>
    </section>
  );
}

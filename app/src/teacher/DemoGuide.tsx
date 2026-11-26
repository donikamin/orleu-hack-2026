// Объяснение для класса-примера: кто эти ученики, что учитель видит и куда смотреть дальше.
import { useState } from 'react';
import { NavLink } from 'react-router';

const STEPS = [
  { to: '', end: true, title: 'Кто отстаёт', text: 'Таблица: 12 учеников × 3 навыка. Цифра — уровень от 1 до 5. Нажмите на номер ученика.' },
  { to: 'tasks', title: 'Что разобрать', text: 'Задания, на которых ошибается полкласса или ошибаются уверенно.' },
  { to: 'lesson', title: 'Урок на доске', text: 'Разбор на проекторе: П — подсказка, О — ответ.' },
  { to: 'tomorrow', title: 'План на завтра', text: 'Группы по слабому навыку и по 3 задания каждой.' },
  { to: 'reports', title: 'Родителям', text: 'Страница на ученика с советом, что делать дома.' },
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
        Что это за экран?
      </button>
    );

  return (
    <section aria-labelledby="demo-guide-h" className="no-print mb-6 border-2 border-ink bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Вы в кабинете учителя</p>
          <h2 id="demo-guide-h" className="mt-1 text-xl font-extrabold">Так учитель видит свой класс после того, как ученики порешали задания</h2>
          <p className="mt-2 text-muted">
            Это пример: 12 вымышленных учеников 8 класса, их результаты за несколько недель. Каждый ученик решал задания в телефоне без
            интернета и показал учителю QR-код. Ваши собственные результаты из тренажёра можно добавить сюда как ученика № 13 — экран «2G и QR» на главной.
          </p>
        </div>
        <button type="button" onClick={() => toggle(false)} className="min-h-11 px-3 text-sm font-semibold text-muted hover:text-ink">
          Скрыть
        </button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <NavLink
              to={s.to}
              end={s.end}
              className={({ isActive }) => `flex h-full flex-col gap-1 border-2 p-3 transition-colors ${isActive ? 'border-ink bg-brand-soft' : 'border-line hover:border-ink'}`}
            >
              <span className="text-xs font-bold text-brand">{i + 1}</span>
              <span className="font-semibold">{s.title}</span>
              <span className="text-sm text-muted">{s.text}</span>
            </NavLink>
          </li>
        ))}
      </ol>
    </section>
  );
}

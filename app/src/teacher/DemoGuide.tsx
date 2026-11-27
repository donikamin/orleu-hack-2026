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
    <section aria-labelledby="demo-guide-h" className="no-print mb-6 overflow-hidden rounded-[24px] bg-surface shadow-[0_20px_50px_-30px_rgb(0_0_0/0.4)]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 text-white" style={{ background: 'linear-gradient(135deg,#12b76a,#0b8a50 50%,#1f57e6)' }}>
        <div className="max-w-3xl">
          <p className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Шаг 5 демо · кабинет учителя</p>
          <h2 id="demo-guide-h" className="mt-2 text-2xl font-extrabold leading-tight">Так учитель видит класс после того, как ученики порешали задания</h2>
          <p className="mt-2 opacity-95">
            12 вымышленных учеников 8 «Б» и их результаты за несколько недель. Каждый решал в телефоне без интернета и показал QR-код.
            Свои результаты можно добавить как ученика № 13 — экран «2G и QR».
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/jury" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-bold text-[#0b6b40]">← Демо для жюри</a>
          <button type="button" onClick={() => toggle(false)} className="min-h-11 rounded-full bg-white/15 px-4 text-sm font-semibold">Скрыть</button>
        </div>
      </div>
      <ol className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => {
          const c = ['#2f6bff', '#ff8a1f', '#12b76a', '#0ea5e9', '#ff4d4f'][i];
          return (
            <li key={s.title}>
              <NavLink
                to={s.to}
                end={s.end}
                className={({ isActive }) => `flex h-full flex-col gap-1 rounded-[18px] p-4 transition-transform hover:-translate-y-0.5 ${isActive ? 'text-white' : ''}`}
                style={({ isActive }) => ({ background: isActive ? c : `color-mix(in srgb, ${c} 10%, transparent)`, boxShadow: isActive ? `0 12px 24px -14px ${c}` : undefined })}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold" style={{ background: 'rgb(255 255 255 / 0.9)', color: c }}>{i + 1}</span>
                <span className="mt-1 font-extrabold">{s.title}</span>
                <span className="text-sm opacity-80">{s.text}</span>
              </NavLink>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

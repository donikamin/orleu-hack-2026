import { Link } from 'react-router';

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="py-6 sm:py-12">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-accent">Функциональная грамотность · 7–9 класс</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          Читай. Понимай. <span className="text-brand">Даже без интернета.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Oqy тренирует три навыка из PISA: найти информацию, понять смысл, оценить достоверность. ИИ не выдаёт ответ, а ведёт
          подсказками. Учитель видит, кому какой навык подтянуть.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/student"
          className="group rounded-[var(--radius-card)] border border-line bg-surface p-6 transition-colors hover:border-brand"
        >
          <p className="text-sm font-semibold text-muted">Для ученика</p>
          <p className="mt-1 text-2xl font-extrabold">Я ученик</p>
          <p className="mt-2 text-muted">Задания, подсказки, карта навыков. Результаты учителю через QR-код.</p>
          <p className="mt-4 font-semibold text-brand group-hover:underline">Начать →</p>
        </Link>
        <Link
          to="/teacher"
          className="group rounded-[var(--radius-card)] border border-brand bg-brand p-6 text-white transition-colors hover:bg-brand-strong"
        >
          <p className="text-sm font-semibold text-white/70">Для учителя</p>
          <p className="mt-1 text-2xl font-extrabold">Я учитель</p>
          <p className="mt-2 text-white/80">Карта класса, сканер результатов, задания PISA из фото страницы учебника.</p>
          <p className="mt-4 font-semibold group-hover:underline">Открыть панель →</p>
        </Link>
      </div>
    </div>
  );
}

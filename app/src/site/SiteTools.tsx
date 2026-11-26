// Экран «Для учителя»: плитки разного размера, каждая ведёт в настоящий экран демо-класса.
import { Link } from 'react-router';

const IMG = '/home/assets/img';
const TILES = [
  { to: '/demo', title: 'Карта класса', text: 'Каждый ученик по трём навыкам', img: 'ui-map.png', pos: '40% 26%', span: 'lg:col-span-2 lg:row-span-2' },
  { to: '/demo?tab=lesson', title: 'Урок на доске', text: 'Голоса класса, подсказки по одной', img: 'ui-lesson.png', pos: '45% 30%', span: '' },
  { to: '/demo?tab=tasks', title: 'Трудные задания', text: 'Что разобрать с классом', img: 'ui-tasks.png', pos: '60% 16%', span: '' },
  { to: '/demo?tab=tomorrow', title: 'Группы на завтра', text: 'По слабому навыку, с заданиями', img: 'ui-tomorrow.png', pos: '60% 34%', span: '' },
  { to: '/demo?tab=reports', title: 'Отчёты родителям', text: 'Страница на ученика, печать', img: 'photo-f96095093-960.jpg', pos: '50% 50%', span: '' },
];

export default function SiteTools() {
  return (
    <section className="site-screen" aria-labelledby="tools-h">
      <p className="site-kicker">Для учителя</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <h1 id="tools-h" className="display text-[clamp(44px,5.2vw,84px)]">
          Один класс.
          <br />
          Пять инструментов.
        </h1>
        <Link to="/demo" className="site-btn site-btn--solid">Открыть пример класса →</Link>
      </div>
      <div className="mt-8 grid flex-1 auto-rows-[minmax(180px,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.title} to={t.to} className={`site-tile ${t.span}`}>
            <img src={`${IMG}/${t.img}`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: t.pos }} loading="lazy" />
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
            <span className="relative mt-auto p-5 text-white">
              <span className="display block text-3xl">{t.title}</span>
              <span className="mt-1 block text-sm text-white/85">{t.text} →</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Лендинг как приложение: слева панель с кнопками, каждая открывает свой экран. Без длинной прокрутки.
// Стиль — по образцу брендовых сайтов (Adidas: чёрно-белый, прямые углы, сжатый шрифт заглавными;
// Apple: один экран — одна мысль). Акцент — мятный цвет Oqy.
import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '../ui/ThemeToggle';
import './site.css';

export const SCREENS = [
  { to: '/', label: 'Главная', short: 'Главная', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { to: '/tutor', label: 'ИИ-наставник', short: 'ИИ', icon: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
  { to: '/math', label: 'Математика', short: 'Матем.', icon: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2' },
  { to: '/train', label: 'Чтение', short: 'Чтение', icon: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z' },
  { to: '/lessons', label: 'Уроки', short: 'Уроки', icon: 'M4 20h4v-4h4v-4h4V8h4' },
  { to: '/me', label: 'Мой кабинет', short: 'Кабинет', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
  { to: '/offline', label: '2G и QR', short: 'QR', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z' },
  { to: '/tools', label: 'Для учителя', short: 'Учитель', icon: 'M4 5h16v11H4zM8 20h8M12 16v4' },
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function NextScreen() {
  const { pathname } = useLocation();
  const i = SCREENS.findIndex((s) => s.to === pathname);
  const next = SCREENS[i + 1];
  if (!next) return <Link to="/demo" className="site-next">Открыть пример класса <span aria-hidden="true">→</span></Link>;
  return (
    <Link to={next.to} className="site-next">
      Дальше: {next.label} <span aria-hidden="true">→</span>
    </Link>
  );
}

export default function SiteShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // ← → переключают экраны, как слайды
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const i = SCREENS.findIndex((s) => s.to === pathname);
      if (i < 0) return; // внутри задания или текста стрелки не листают экраны
      if (e.key === 'ArrowRight' && i < SCREENS.length - 1) navigate(SCREENS[i + 1].to);
      if (e.key === 'ArrowLeft' && i > 0) navigate(SCREENS[i - 1].to);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, navigate]);

  return (
    <div className="site">
      <a href="#screen" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-paper">
        К содержимому
      </a>
      <aside className="site-rail" aria-label="Разделы">
        <Link to="/" className="site-logo" aria-label="Oqy, на главную">
          <span className="site-logo__mark" aria-hidden="true">O</span>
          <span translate="no">OQY</span>
        </Link>
        <nav className="site-nav">
          {SCREENS.map((s, i) => (
            <NavLink key={s.to} to={s.to} end={s.to === '/'} className="site-nav__item">
              <span className="site-nav__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <Icon d={s.icon} />
              <span className="site-nav__label">{s.label}</span>
              <span className="site-nav__short">{s.short}</span>
            </NavLink>
          ))}
        </nav>
        <div className="site-rail__foot">
          <Link to="/demo" className="site-btn site-btn--accent w-full">Пример класса</Link>
          <Link to="/teacher" className="site-btn site-btn--ghost w-full">Мои классы</Link>
          <ThemeToggle />
        </div>
      </aside>
      <main id="screen" className="site-main" tabIndex={-1}>
        <Suspense fallback={<div className="site-screen" />}>
          <div key={pathname} className="site-screen-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
    </div>
  );
}

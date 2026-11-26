// Лендинг как приложение: слева панель с кнопками, каждая открывает свой экран. Без длинной прокрутки.
// Стиль — по образцу брендовых сайтов (Adidas: чёрно-белый, прямые углы, сжатый шрифт заглавными;
// Apple: один экран — одна мысль). Акцент — мятный цвет Oqy.
import { Suspense, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '../ui/ThemeToggle';

export const SCREENS = [
  { to: '/', label: 'Главная', short: 'Главная', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { to: '/case', label: 'Задача кейса', short: 'Кейс', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/try', label: 'Решить задание', short: 'Задание', icon: 'M9 12l2 2 4-4M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { to: '/how', label: 'Как работает', short: 'Как', icon: 'M5 12h14M13 6l6 6-6 6' },
  { to: '/tools', label: 'Для учителя', short: 'Учителю', icon: 'M4 5h16v11H4zM8 20h8M12 16v4' },
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
  if (!next) return <Link to="/demo" className="site-next">Открыть демо-класс <span aria-hidden="true">→</span></Link>;
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
            <NavLink key={s.to} to={s.to} end className="site-nav__item">
              <span className="site-nav__num" aria-hidden="true">0{i + 1}</span>
              <Icon d={s.icon} />
              <span className="site-nav__label">{s.label}</span>
              <span className="site-nav__short">{s.short}</span>
            </NavLink>
          ))}
        </nav>
        <div className="site-rail__foot">
          <Link to="/demo" className="site-btn site-btn--accent w-full">Демо-класс</Link>
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

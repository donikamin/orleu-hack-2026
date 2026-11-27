// Лендинг как приложение: слева панель с кнопками, каждая открывает свой экран. Без длинной прокрутки.
// Стиль — по образцу брендовых сайтов (Adidas: чёрно-белый, прямые углы, сжатый шрифт заглавными;
// Apple: один экран — одна мысль). Акцент — мятный цвет Oqy.
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Bolt, Flame, Snow } from './Icons';
import { daysWord, levelOf, onStreakEvent, reconcile, useStreak, type StreakEvent } from './streak';
import { useProgress } from './progress';
import { claimDaily } from './daily';
import { track, trackScreen } from './analytics';
import './site.css';

export const SCREENS = [
  { to: '/', label: 'Главная', short: 'Главная', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z' },
  { to: '/tutor', label: 'ИИ-ответчик', short: 'ИИ', icon: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3' },
  { to: '/math', label: 'Математика', short: 'Матем.', icon: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M8 15h2M12 15h2' },
  { to: '/train', label: 'Чтение', short: 'Чтение', icon: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z' },
  { to: '/blitz', label: 'Блиц-игра', short: 'Блиц', icon: 'M13 2 4 14h7l-1 8 9-12h-7z' },
  { to: '/quiz', label: 'Мини-тест PISA', short: 'Тест', icon: 'M9 3h6M12 3v3M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2' },
  { to: '/lessons', label: 'Уроки', short: 'Уроки', icon: 'M4 20h4v-4h4v-4h4V8h4' },
  { to: '/me', label: 'Мой кабинет', short: 'Кабинет', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
  { to: '/streak', label: 'Серия дней', short: 'Серия', icon: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-4.2 2.5-5.4 0 1.7.8 2.9 2 2.9C11 8 10.5 5.5 12 3z' },
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

/** До полуночи: когда появится новая задача дня. */
function untilMidnight() {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  const s = Math.max(0, Math.floor((m.getTime() - n.getTime()) / 1000));
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Полоса объявлений сверху (как у спортивных брендов): отсчёт до новой задачи дня и подсказки по кругу. */
function PromoBar() {
  const s = useStreak();
  const [left, setLeft] = useState(untilMidnight);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setLeft(untilMidnight()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setI((x) => x + 1), 6000);
    return () => window.clearInterval(t);
  }, [paused]);
  const msgs = [
    { text: <>Новая задача дня через <b className="tabular-nums">{left}</b></>, to: '/' },
    { text: s.alive ? <>🔥 Серия {s.streak} {daysWord(s.streak)} — огонь горит</> : <>🔥 Реши одно задание сегодня — серия не погаснет</>, to: '/streak' },
    { text: <>Мини-тест PISA за 10 минут — узнай свой уровень</>, to: '/quiz' },
    { text: <>Скажи ИИ-ответчику «прочитай текст про Арал»</>, to: '/tutor' },
  ];
  const m = msgs[i % msgs.length];
  return (
    <div className="promo" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <button type="button" className="promo__arrow" onClick={() => setI((x) => x + msgs.length - 1)} aria-label="Предыдущее объявление">‹</button>
      <Link key={i} to={m.to} className="promo__msg">{m.text}</Link>
      <button type="button" className="promo__arrow" onClick={() => setI((x) => x + 1)} aria-label="Следующее объявление">›</button>
    </div>
  );
}

/** Серия дней, заморозки и цель дня — всегда видны сверху справа (идея Duolingo). */
function StreakBar() {
  const s = useStreak();
  const lv = levelOf(s.total);
  return (
    <div className="streakbar">
      <Link to="/me" className="stat-chip stat-chip--level" aria-label={`Уровень ${lv.n}, ${lv.name}: ${lv.into} из ${lv.need} XP до следующего`}>
        <span className="lvl-ring" style={{ '--p': Math.round((lv.into / lv.need) * 100) } as React.CSSProperties}>{lv.n}</span>
        <span className="lvl-name">{lv.name}</span>
      </Link>
      <Link to="/streak" className={`stat-chip stat-chip--fire ${s.alive ? 'on' : ''}`} aria-label={`Серия: ${s.streak} ${daysWord(s.streak)}${s.alive ? '' : ', сегодня ещё не занимался'}`}>
        <Flame on={s.alive} /> {s.streak}
      </Link>
      <Link to="/streak" className="stat-chip stat-chip--ice" aria-label={`Заморозок: ${s.freezes}`}>
        <Snow /> {s.freezes}
      </Link>
      <Link to="/streak" className="stat-chip stat-chip--gold" aria-label={`Цель дня: ${s.today} из ${s.goal} XP`}>
        <Bolt /> {s.today}/{s.goal}
      </Link>
    </div>
  );
}

export function Week() {
  const s = useStreak();
  return (
    <div className="week w-full" aria-label="Неделя">
      {s.week.map((d) => (
        <div key={d.key} className="week__day">
          <span className={`week__dot week__dot--${d.state}`} aria-label={`${d.label}: ${d.state === 'done' ? 'занимался' : d.state === 'frozen' ? 'заморозка' : d.state === 'today' ? 'сегодня' : d.state === 'future' ? 'впереди' : 'пропуск'}`}>
            {d.state === 'done' ? '✓' : d.state === 'frozen' ? '❄' : ''}
          </span>
          {d.label}
        </div>
      ))}
    </div>
  );
}

/** Праздники: серия началась/выросла, цель дня, заморозка заработана или спасла серию. По одному за раз. */
function Celebrations() {
  const [queue, setQueue] = useState<StreakEvent[]>([]);
  const [toast, setToast] = useState<number | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const off = onStreakEvent((e) => {
      if (e.type !== 'xp') track('streak_event', { type: e.type, streak: 'streak' in e ? e.streak : undefined });
      if (e.type === 'xp') {
        setToast(e.amount);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setToast(null), 1800);
      } else setQueue((q) => [...q, e]);
    });
    reconcile(); // пропущенные дни: тратим заморозки
    return off;
  }, []);

  // Задача дня решена — бонус XP (один раз в день)
  const progress = useProgress();
  useEffect(() => {
    const today = new Date().toDateString();
    if (claimDaily(new Set(progress.filter((a) => a.score > 0 && new Date(a.ts * 1000).toDateString() === today).map((a) => a.taskId)))) track('daily_task_solved');
  }, [progress]);

  const e = queue[0];
  useEffect(() => {
    if (!e) return;
    btn.current?.focus();
    const onKey = (k: KeyboardEvent) => k.key === 'Escape' && setQueue((q) => q.slice(1));
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [e]);
  const close = () => setQueue((q) => q.slice(1));

  return (
    <>
      {toast !== null && !e && <div className="toast" role="status"><Bolt /> +{toast} XP</div>}
      {e && e.type !== 'xp' && (
        <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="cel-h" onClick={close}>
          <div className="celebrate__card" onClick={(x) => x.stopPropagation()}>
            {e.type === 'streak' && (
              <>
                <Flame size={88} className="flame" />
                <p className="celebrate__big">{e.streak}</p>
                <h2 id="cel-h" className="text-2xl font-extrabold">{e.streak === 1 ? 'Серия началась!' : `${e.streak} ${daysWord(e.streak)} подряд!`}</h2>
                <p className="text-[var(--s-muted)]">Решай хотя бы одно задание в день, и огонь не погаснет. Пропустишь день — спасёт заморозка.</p>
                <Week />
              </>
            )}
            {e.type === 'goal' && (
              <>
                <Bolt size={88} />
                <h2 id="cel-h" className="text-2xl font-extrabold">Цель дня выполнена!</h2>
                <p className="text-[var(--s-muted)]">Дневная норма XP набрана. Каждые 5 дней серии дают заморозку.</p>
              </>
            )}
            {e.type === 'freeze-earned' && (
              <>
                <Snow size={84} />
                <h2 id="cel-h" className="text-2xl font-extrabold">Новая заморозка!</h2>
                <p className="text-[var(--s-muted)]">За 5 дней подряд. Теперь их {e.freezes}. Пропустишь день — заморозка сама сохранит серию.</p>
              </>
            )}
            {e.type === 'freeze-used' && (
              <>
                <Snow size={84} />
                <h2 id="cel-h" className="text-2xl font-extrabold">Заморозка спасла серию</h2>
                <p className="text-[var(--s-muted)]">Пропущено: {e.days.length} {daysWord(e.days.length)}, но серия {e.streak} {daysWord(e.streak)} цела. Реши одно задание сегодня.</p>
              </>
            )}
            <button ref={btn} type="button" onClick={close} className={`site-btn w-full ${e.type.startsWith('freeze') ? 'site-btn--ice' : e.type === 'goal' ? 'site-btn--gold' : 'site-btn--math'}`}>
              Продолжить
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function SiteShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => trackScreen(pathname), [pathname]);

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
          <Link to="/jury" className="jury-pill w-full justify-center">★ Демо для жюри</Link>
          <Link to="/demo" className="site-btn site-btn--accent w-full">Пример класса</Link>
          <Link to="/teacher" className="site-btn site-btn--ghost w-full">Мои классы</Link>
          <ThemeToggle />
        </div>
      </aside>
      <main id="screen" className="site-main" tabIndex={-1}>
        <PromoBar />
        <StreakBar />
        <Suspense fallback={<div className="site-screen" />}>
          <div key={pathname} className="site-screen-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
      <Celebrations />
    </div>
  );
}

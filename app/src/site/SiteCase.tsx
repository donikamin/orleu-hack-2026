// Экран «Задача кейса»: только цифры из условия, крупно.
import { NextScreen } from './SiteShell';

const BARS = [
  { label: 'Чтение', v: 36, hot: true },
  { label: 'Математика', v: 44 },
  { label: 'Естествознание', v: 52 },
  { label: 'ОЭСР, естествознание', v: 74, ref: true },
];

export default function SiteCase() {
  return (
    <section className="site-screen" aria-labelledby="case-h">
      <p className="site-kicker">01 · Задача кейса</p>
      <div className="mt-6 grid flex-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 id="case-h" className="display text-[clamp(44px,5.6vw,88px)]">
            2 из 3 подростков
            <br />
            не понимают текст
          </h1>
          <p className="mt-6 max-w-[40ch] text-xl text-[var(--s-muted)]">
            PISA-2025: 22&nbsp;680 казахстанских 15-летних из 643 школ. Сельские школы отстают на 18 баллов.
          </p>
        </div>
        <ul className="grid gap-5" aria-label="Доля школьников с базовым уровнем">
          {BARS.map((b, i) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between">
                <span className={b.ref ? 'text-[var(--s-muted)]' : 'font-semibold'}>{b.label}</span>
                <span className="display text-[clamp(40px,4.4vw,72px)]">{b.v}%</span>
              </div>
              <div className="mt-2 h-3 bg-[var(--s-soft)]">
                <div
                  className="h-full origin-left animate-[bar_1s_cubic-bezier(.2,.7,.2,1)_both]"
                  style={{ width: `${b.v}%`, animationDelay: `${150 + i * 120}ms`, background: b.hot ? 'var(--s-ink)' : b.ref ? 'var(--s-mint)' : 'color-mix(in srgb, var(--s-ink) 35%, transparent)' }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <NextScreen />
    </section>
  );
}

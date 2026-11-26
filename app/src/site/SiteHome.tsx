import { Link } from 'react-router';

const IMG = '/home/assets/img';

export default function SiteHome() {
  return (
    <section className="site-screen !p-0" aria-labelledby="home-h">
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col px-[clamp(20px,4vw,64px)] pb-8 pt-10 max-lg:pb-28">
          <p className="site-kicker">Órleu Hack 2026 · кейс «Читать и понимать»</p>
          <h1 id="home-h" className="display mt-auto text-[clamp(56px,8.4vw,136px)]">
            Читай.
            <br />
            Понимай.
            <br />
            <span className="inline-block bg-[var(--s-mint)] px-[0.12em] text-[#0a0a0a]">Без сети.</span>
          </h1>
          <p className="mt-6 max-w-[34ch] text-xl leading-snug text-[var(--s-muted)]">
            ИИ-тренажёр чтения для 7–9 классов. Подсказывает, а не отвечает. Работает в сельской школе без интернета.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/try" className="site-btn site-btn--solid">Решить задание →</Link>
            <Link to="/demo" className="site-btn site-btn--ghost">Открыть демо-класс</Link>
          </div>
          <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-[var(--s-line)] pt-6 max-lg:mt-12">
            {[
              ['36%', 'читают на базовом уровне'],
              ['3', 'навыка PISA в каждом задании'],
              ['0', 'Мбит/с нужно ученику'],
            ].map(([n, t]) => (
              <div key={t}>
                <dt className="sr-only">{t}</dt>
                <dd className="display text-[clamp(36px,4vw,56px)]">{n}</dd>
                <dd className="mt-1 text-sm text-[var(--s-muted)]">{t}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="site-photo relative max-lg:h-[46vh] max-lg:-order-1">
          <img
            src={`${IMG}/photo-f43777946-1280.jpg`}
            srcSet={`${IMG}/photo-f43777946-500.jpg 500w, ${IMG}/photo-f43777946-960.jpg 960w, ${IMG}/photo-f43777946-1280.jpg 1280w`}
            sizes="(max-width: 1023px) 100vw, 50vw"
            width={1280}
            height={853}
            alt="Пастух с отарой в казахстанской степи, вдали горы"
            fetchPriority="high"
          />
          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 max-lg:hidden">
            <div className="bg-[var(--s-bg)] px-5 py-4 shadow-[0_20px_40px_-20px_rgb(0_0_0/.5)]">
              <p className="site-kicker !text-[11px]">Подсказка 2 из 3</p>
              <p className="mt-1 max-w-[30ch] font-semibold">Найди строку про субботу. Ходит ли в субботу рейс 06:40?</p>
            </div>
            <span className="bg-[var(--s-mint)] px-3 py-1.5 font-['Oswald'] text-sm font-semibold uppercase tracking-wider text-[#0a0a0a]">Офлайн</span>
          </div>
        </div>
      </div>
    </section>
  );
}

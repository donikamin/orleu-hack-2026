// Экран «Как работает»: три шага переключаются кнопками, картинка меняется. Без прокрутки.
import { useState } from 'react';
import { NextScreen } from './SiteShell';

const IMG = '/home/assets/img';
const STEPS = [
  { n: '01', title: 'Ученик решает в телефоне', text: 'Приложение скачивается один раз в школе. Задания, проверка и подсказки работают в режиме самолёта.', img: `${IMG}/photo-f96095093-960.jpg`, pos: '50% 50%', alt: 'Сельская школа в Казахстане у дороги' },
  { n: '02', title: 'Результат — QR-кодом', text: 'Ученик показывает QR на экране, учитель сканирует камерой. Интернет не нужен никому.', img: `${IMG}/ui-qr.png`, pos: '72% 40%', alt: 'Экран Oqy с QR-кодом результатов ученика' },
  { n: '03', title: 'Учитель видит, кому что подтянуть', text: 'Карта класса по трём навыкам, трудные задания и готовые группы на завтра.', img: `${IMG}/ui-map.png`, pos: '28% 22%', alt: 'Карта класса Oqy по навыкам найти, понять, оценить' },
];

export default function SiteHow() {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  return (
    <section className="site-screen" aria-labelledby="how-h">
      <p className="site-kicker">03 · Как работает</p>
      <div className="mt-6 grid flex-1 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col">
          <h1 id="how-h" className="display text-[clamp(44px,5.2vw,84px)]">
            Три шага.
            <br />
            Ноль интернета.
          </h1>
          <div role="tablist" aria-label="Шаги" className="mt-8 grid gap-2">
            {STEPS.map((st, k) => (
              <button
                key={st.n}
                type="button"
                role="tab"
                aria-selected={i === k}
                aria-controls="how-panel"
                onClick={() => setI(k)}
                className={`grid grid-cols-[56px_1fr] items-start gap-4 border-l-[3px] p-4 text-left transition-colors ${i === k ? 'border-[var(--s-ink)] bg-[var(--s-soft)]' : 'border-transparent hover:bg-[var(--s-soft)]'}`}
              >
                <span className="display text-4xl">{st.n}</span>
                <span>
                  <span className="block text-lg font-semibold">{st.title}</span>
                  {i === k && <span className="mt-1 block text-[var(--s-muted)] animate-rise">{st.text}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div id="how-panel" role="tabpanel" className="site-photo relative min-h-[320px] border border-[var(--s-line)]">
          <img key={s.img} src={s.img} alt={s.alt} className="absolute inset-0 animate-rise" style={{ objectPosition: s.pos }} />
          <span className="display absolute left-5 top-4 text-[96px] text-[var(--s-mint)] [text-shadow:0_2px_12px_rgb(0_0_0/.25)]" aria-hidden="true">{s.n}</span>
        </div>
      </div>
      <NextScreen />
    </section>
  );
}

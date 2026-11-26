// Экран «Решить задание»: настоящее задание Oqy с лестницей подсказок. Ответ не раскрывается.
import { useState } from 'react';
import { Link } from 'react-router';
import { NextScreen } from './SiteShell';

const OPTIONS = ['06:40', '08:15', '12:30', '13:00'];
const CORRECT = 1;
const HINTS: Record<number, string[]> = {
  0: ['Рейс 06:40 есть в строке «Будни». Ходит ли он в субботу?', 'Найдите строку «Суббота». Какие там рейсы?', 'Прибавьте 1 ч 10 мин к каждому субботнему рейсу. Какой успевает до 10:00?'],
  2: ['12:30 ходит только в будни. Посмотрите строку про субботу.', 'В субботу рейсы 08:15 и 13:00. Какой приедет раньше 10:00?', 'Прибавьте 1 ч 10 мин к 08:15.'],
  3: ['13:00 ходит в субботу. Но во сколько он приедет?', 'Прибавьте 1 ч 10 мин к 13:00. Это раньше 10:00?', 'Есть субботний рейс раньше. Найдите его.'],
};

export default function SiteTry() {
  const [wrong, setWrong] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const hint = wrong.length ? HINTS[wrong[wrong.length - 1]][Math.min(wrong.length - 1, 2)] : null;
  const level = done ? (wrong.length === 0 ? 4 : 3) : 2;

  function pick(i: number) {
    if (done || wrong.includes(i)) return;
    if (i === CORRECT) setDone(true);
    else setWrong((w) => [...w, i]);
  }

  return (
    <section className="site-screen" aria-labelledby="try-h">
      <p className="site-kicker">02 · Попробуйте как ученик</p>
      <div className="mt-6 grid flex-1 items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h1 id="try-h" className="display text-[clamp(44px,5.2vw,84px)]">
            Ошибитесь
            <br />
            нарочно
          </h1>
          <p className="mt-6 max-w-[32ch] text-xl text-[var(--s-muted)]">ИИ не скажет ответ. Он задаст вопрос, который приведёт к нему.</p>
          <button type="button" onClick={() => { setWrong([]); setDone(false); }} className="mt-6 min-h-11 font-semibold underline underline-offset-4">
            Начать заново
          </button>
        </div>

        <div className="border border-[var(--s-line)] bg-[var(--s-bg)] shadow-[0_40px_80px_-48px_rgb(0_0_0/.45)]">
          <div className="flex items-center justify-between border-b border-[var(--s-line)] px-6 py-3 text-sm">
            <span className="site-kicker !text-xs">Найти · сложность 1</span>
            <span className="bg-[var(--s-mint)] px-2 py-0.5 font-['Oswald'] text-xs font-semibold uppercase tracking-wider text-[#0a0a0a]">Без сети</span>
          </div>
          <div className="p-6">
            <div className="bg-[var(--s-soft)] p-5">
              <p className="text-sm font-semibold text-[var(--s-muted)]">Автобус № 12: аул Жанаарка → райцентр</p>
              <p className="text-read mt-1">
                Будни: 06:40, 08:15, 12:30, 17:05.
                <br />
                Суббота: 08:15, 13:00.
                <br />
                Время в пути: 1 час 10 минут.
              </p>
            </div>
            <p id="try-q" className="mt-5 text-xl font-semibold">Асель в субботу хочет быть в райцентре до 10:00. Каким рейсом ей ехать?</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="try-q">
              {OPTIONS.map((o, i) => {
                const isWrong = wrong.includes(i);
                const isRight = done && i === CORRECT;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => pick(i)}
                    disabled={isWrong || done}
                    className={`min-h-14 border-2 font-['Oswald'] text-xl font-semibold transition-[transform,background-color,border-color] duration-150 enabled:hover:-translate-y-0.5 ${
                      isRight ? 'border-[#0a0a0a] bg-[var(--s-mint)] text-[#0a0a0a]' : isWrong ? 'border-[#c2410c] text-[#c2410c] line-through' : 'border-[var(--s-line)] hover:border-[var(--s-ink)]'
                    }`}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 min-h-20" aria-live="polite">
              {done ? (
                <p className="border-l-4 border-[#0a0a0a] bg-[var(--s-mint)] p-4 text-[#0a0a0a]">
                  <b>Верно.</b> 08:15 + 1 ч 10 мин = 09:25. {wrong.length ? `Вы нашли ответ сами, с ${wrong.length} подсказк${wrong.length === 1 ? 'ой' : 'ами'}.` : 'Без подсказок — навык растёт сильнее.'}
                </p>
              ) : hint ? (
                <p key={hint} className="animate-rise border-l-4 border-[#c2410c] bg-[var(--s-soft)] p-4">
                  <b>Подсказка {Math.min(wrong.length, 3)} из 3.</b> {hint}
                </p>
              ) : (
                <p className="p-4 text-[var(--s-muted)]">Выберите рейс.</p>
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-[var(--s-muted)]">Навык «Найти»</span>
              <span className="flex flex-1 gap-1" aria-label={`Уровень ${level} из 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`h-2 flex-1 transition-colors duration-500 ${n <= level ? 'bg-[var(--s-ink)]' : 'bg-[var(--s-line)]'}`} />
                ))}
              </span>
              <b>{level}/5</b>
            </div>
          </div>
        </div>
      </div>
      {done ? (
        <Link to="/how" className="site-next">Дальше: как это доходит до учителя <span aria-hidden="true">→</span></Link>
      ) : (
        <NextScreen />
      )}
    </section>
  );
}

// /streak: серия дней, календарь месяца, заморозки (как в Duolingo) и выбор цели дня.
import { useState } from 'react';
import { Link } from 'react-router';
import { Bolt, Flame, Snow } from './Icons';
import { buyFreeze, dayKey, daysWord, FREEZE_PRICE, GOALS, MAX_FREEZES, setGoal, useStreak } from './streak';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function SiteStreak() {
  const s = useStreak();
  const [msg, setMsg] = useState<string | null>(null);
  const now = new Date();
  const first = dayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const cells = s.cells(first, daysIn);
  const canBuy = s.freezes < MAX_FREEZES && s.balance >= FREEZE_PRICE;

  return (
    <section className="app-screen" aria-labelledby="streak-h">
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="grid gap-4">
          <div className="card flex items-center gap-5 p-6" style={{ background: s.alive ? 'var(--s-fire-soft)' : undefined }}>
            <Flame size={84} on={s.alive} className={s.alive ? 'flame' : 'text-[var(--s-line)]'} />
            <div>
              <h1 id="streak-h" className="text-5xl font-black" style={{ color: s.alive ? 'var(--s-fire)' : 'var(--s-muted)' }}>
                {s.streak}
              </h1>
              <p className="text-lg font-extrabold">{daysWord(s.streak)} подряд</p>
              <p className="muted-s">Рекорд: {s.best} {daysWord(s.best)}</p>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <b className="text-lg">{MONTHS[now.getMonth()]}</b>
              <span className="muted-s flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-[var(--s-fire)]" /> занимался</span>
                <span className="inline-flex items-center gap-1"><i className="inline-block h-3 w-3 rounded bg-[var(--s-ice)]" /> заморозка</span>
              </span>
            </div>
            <div className="cal" aria-label="Календарь занятий">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <span key={d} className="cal__h">{d}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="cal__d cal__d--blank" />)}
              {cells.map((c) => (
                <span key={c.key} className={`cal__d cal__d--${c.state}`} title={c.xp ? `${c.xp} XP` : undefined}>
                  {Number(c.key.slice(8))}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="card grid gap-3 p-5">
            <div className="flex items-center gap-3">
              <Snow size={40} />
              <div className="flex-1">
                <b className="text-lg">Заморозки: {s.freezes} из {MAX_FREEZES}</b>
                <p className="muted-s">Пропустил день — заморозка тратится сама, серия не сгорает.</p>
              </div>
            </div>
            <div className="flex gap-2" aria-hidden="true">
              {Array.from({ length: MAX_FREEZES }, (_, i) => (
                <span key={i} className={`grid h-14 flex-1 place-items-center rounded-[14px] border-2 ${i < s.freezes ? 'border-[var(--s-ice)] bg-[var(--s-ice-soft)]' : 'border-dashed border-[var(--s-line)] opacity-50'}`}>
                  <Snow size={28} />
                </span>
              ))}
            </div>
            <button
              type="button"
              className="site-btn site-btn--ice"
              disabled={!canBuy}
              onClick={() => setMsg(buyFreeze() ? 'Готово! Заморозка в запасе.' : 'Не получилось.')}
            >
              Купить за {FREEZE_PRICE} XP
            </button>
            <p className="muted-s" aria-live="polite">
              {msg ?? (s.freezes >= MAX_FREEZES ? 'Больше двух держать нельзя — как в Duolingo.' : `Твой запас: ${s.balance} XP. Ещё одна заморозка бесплатно — каждые 5 дней серии.`)}
            </p>
          </div>

          <div className="card grid gap-3 p-5">
            <div className="flex items-center gap-3">
              <Bolt size={36} />
              <div>
                <b className="text-lg">Цель дня: {s.goal} XP</b>
                <p className="muted-s">Сегодня: {s.today} XP. Задание — 10 XP, урок — 15, ответ к тексту — 5.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Цель дня">
              {GOALS.map((g) => (
                <button key={g} type="button" aria-pressed={s.goal === g} onClick={() => setGoal(g)} className="pill justify-center">
                  {g === 20 ? 'Легко' : g === 30 ? 'Норма' : 'Серьёзно'} · {g}
                </button>
              ))}
            </div>
          </div>

          <p className="note note--ai">
            Серия растёт, если решить хотя бы одно задание в день. Даже 3 минуты в автобусе считаются — и всё работает без интернета.
          </p>
          <Link to="/math" className="site-btn site-btn--math">Решить задание сейчас</Link>
        </div>
      </div>
    </section>
  );
}

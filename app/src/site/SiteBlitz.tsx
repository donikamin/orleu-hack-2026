// «Блиц»: 60 секунд, «верно или неверно» на функциональную грамотность — скидки, проценты, цена за килограмм,
// единицы, время в пути, среднее, факт или мнение. Вопросы генерируются бесконечно, работает без сети.
// Серия верных ответов даёт множитель ×2 / ×3, лучший результат сохраняется, очки превращаются в XP.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { addXp } from './streak';
import { track } from './analytics';

interface Q {
  text: string;
  ok: boolean;
  why: string;
  topic: string;
}

const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const tg = (n: number) => `${n.toLocaleString('ru-RU')} ₸`;
const fmt = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/** Неверный вариант рядом с правильным — чтобы нужно было считать, а не угадывать. */
const near = (v: number, step: number) => v + pickOne([-2, -1, 1, 2]) * step;

const GEN: (() => Q)[] = [
  () => {
    const p = pickOne([5, 10, 15, 20, 25, 30, 40, 50]);
    const base = R(4, 40) * 100;
    const right = (base * p) / 100;
    const ok = Math.random() < 0.5;
    const shown = ok ? right : near(right, base / 20);
    return { topic: 'Проценты', text: `${p}% от ${tg(base)} — это ${tg(shown)}`, ok, why: `${base} : 100 × ${p} = ${right}` };
  },
  () => {
    const price = R(4, 30) * 1000;
    const d = pickOne([10, 20, 25, 30, 50]);
    const right = price * (1 - d / 100);
    const ok = Math.random() < 0.5;
    const shown = ok ? right : near(right, 500);
    return { topic: 'Скидки', text: `Куртка стоит ${tg(price)}, скидка ${d}%. На кассе — ${tg(shown)}`, ok, why: `${price} × ${(100 - d) / 100} = ${right}` };
  },
  () => {
    const kg1 = pickOne([1, 2, 3]);
    const kg2 = kg1 + pickOne([1, 2]);
    const p1 = R(3, 9) * 100 * kg1;
    const p2 = R(3, 9) * 100 * kg2;
    if (p1 / kg1 === p2 / kg2) return GEN[0]();
    const ok = p2 / kg2 < p1 / kg1;
    return { topic: 'Что выгоднее', text: `${kg2} кг за ${tg(p2)} выгоднее, чем ${kg1} кг за ${tg(p1)}`, ok, why: `${fmt(p2 / kg2)} ₸/кг против ${fmt(p1 / kg1)} ₸/кг` };
  },
  () => {
    const k = pickOne([
      { a: R(2, 9) + 0.5, u: 'км', b: 'м', m: 1000 },
      { a: R(1, 4) + 0.5, u: 'ч', b: 'мин', m: 60 },
      { a: R(2, 9) + 0.5, u: 'кг', b: 'г', m: 1000 },
      { a: R(2, 9) + 0.5, u: 'л', b: 'мл', m: 1000 },
    ]);
    const right = k.a * k.m;
    const ok = Math.random() < 0.5;
    const shown = ok ? right : pickOne([right / 10, right * 10, right + k.m / 2]);
    return { topic: 'Единицы', text: `${fmt(k.a)} ${k.u} = ${fmt(shown)} ${k.b}`, ok, why: `1 ${k.u} = ${k.m} ${k.b}, значит ${fmt(right)} ${k.b}` };
  },
  () => {
    const h = R(6, 16);
    const m = pickOne([0, 10, 15, 20, 30, 40, 45, 50]);
    const go = pickOne([25, 35, 40, 45, 50, 55, 70, 85]);
    const total = h * 60 + m + go;
    const ok = Math.random() < 0.5;
    const t = ok ? total : total + pickOne([-10, 10, 20, -20]);
    const hh = (x: number) => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
    return { topic: 'Время в пути', text: `Автобус уходит в ${hh(h * 60 + m)}, едет ${go} мин. Приедет в ${hh(t)}`, ok, why: `${hh(h * 60 + m)} + ${go} мин = ${hh(total)}` };
  },
  () => {
    const xs = Array.from({ length: 3 }, () => R(2, 9));
    const s = xs.reduce((a, b) => a + b, 0);
    if (s % 3) xs[2] += 3 - (s % 3);
    const right = xs.reduce((a, b) => a + b, 0) / 3;
    const ok = Math.random() < 0.5;
    const shown = ok ? right : right + pickOne([-1, 1]);
    return { topic: 'Среднее', text: `Среднее чисел ${xs.join(', ')} — это ${shown}`, ok, why: `(${xs.join(' + ')}) : 3 = ${right}` };
  },
  () => {
    const f = pickOne([
      { t: '«Аральское море за 50 лет сильно уменьшилось»', fact: true },
      { t: '«Это самая красивая школа в районе»', fact: false },
      { t: '«Автобус № 12 ходит по будням в 06:40»', fact: true },
      { t: '«Все подростки ненавидят математику»', fact: false },
      { t: '«В Казахстане 17 областей»', fact: true },
      { t: '«Этот телефон лучший для учёбы»', fact: false },
      { t: '«Вода кипит при 100 °C на уровне моря»', fact: true },
      { t: '«Летом в ауле жить лучше, чем в городе»', fact: false },
    ]);
    const askFact = Math.random() < 0.5;
    return { topic: 'Факт или мнение', text: `${f.t} — это ${askFact ? 'факт' : 'мнение'}`, ok: askFact === f.fact, why: f.fact ? 'Это можно проверить — факт' : 'Это оценка, проверить нельзя — мнение' };
  },
];

const BEST = 'oqy-blitz-best';
const TIME = 60;

export default function SiteBlitz() {
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro');
  const [q, setQ] = useState<Q>(() => pickOne(GEN)());
  const [left, setLeft] = useState(TIME);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState<{ ok: boolean; why: string } | null>(null);
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem(BEST) ?? 0); } catch { return 0; }
  });
  const ended = useRef(false);
  const mult = combo >= 6 ? 3 : combo >= 3 ? 2 : 1;

  useEffect(() => {
    if (phase !== 'play') return;
    const t = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'play' || left > 0 || ended.current) return;
    ended.current = true;
    setPhase('done');
    const xp = Math.min(30, Math.round(score / 10));
    if (xp > 0) addXp(xp);
    if (score > best) {
      setBest(score);
      try { localStorage.setItem(BEST, String(score)); } catch { /* ничего */ }
    }
    track('blitz_finished', { score, right, wrong });
  }, [left, phase, score, best, right, wrong]);

  const answer = useCallback(
    (v: boolean) => {
      if (phase !== 'play') return;
      const ok = v === q.ok;
      setFlash({ ok, why: `«${q.text}» — ${q.ok ? 'верно' : 'неверно'}: ${q.why}` });
      if (ok) {
        setScore((s) => s + 10 * mult);
        setCombo((c) => c + 1);
        setRight((r) => r + 1);
      } else {
        setCombo(0);
        setWrong((w) => w + 1);
      }
      setQ(pickOne(GEN)());
    },
    [phase, q, mult],
  );

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(true);
      if (e.key === 'ArrowRight') answer(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [answer]);

  function start() {
    ended.current = false;
    setScore(0);
    setCombo(0);
    setRight(0);
    setWrong(0);
    setFlash(null);
    setLeft(TIME);
    setQ(pickOne(GEN)());
    setPhase('play');
  }

  if (phase === 'intro')
    return (
      <section className="app-screen" aria-labelledby="blitz-h">
        <header className="app-head page-banner page-banner--blitz">
          <span className="chip">Блиц-игра · 60 секунд</span>
          <h1 id="blitz-h" className="app-title">Верно или неверно?</h1>
          <p className="app-sub">Скидки, проценты, цена за килограмм, единицы, время в пути, факт или мнение. Отвечай быстро: серия верных ответов даёт <b>×2</b> и <b>×3</b> к очкам.</p>
        </header>
        <div className="blitz-rules mt-6">
          <div className="stat"><b>60 с</b><span>на всю игру</span></div>
          <div className="stat"><b>×3</b><span>множитель за серию из 6</span></div>
          <div className="stat"><b>{best}</b><span>твой рекорд</span></div>
        </div>
        <button type="button" className="site-btn blitz-start mt-6 self-start" onClick={start}>▶ Играть</button>
        <p className="muted-s mt-3">На компьютере: ← «Верно», → «Неверно». Работает без интернета.</p>
      </section>
    );

  if (phase === 'done')
    return (
      <section className="app-screen" aria-labelledby="blitz-res">
        <div className="blitz-result">
          <p className="chip">Блиц окончен</p>
          <h1 id="blitz-res" className="blitz-result__score">{score}</h1>
          <p className="text-lg font-bold">{score >= best && score > 0 ? '🏆 Новый рекорд!' : `Рекорд: ${best}`}</p>
          <p className="muted-s">Верно: {right} · ошибок: {wrong} · +{Math.min(30, Math.round(score / 10))} XP</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="site-btn blitz-start" onClick={start}>Ещё раз</button>
            <Link to="/quiz" className="site-btn site-btn--ghost">Мини-тест PISA</Link>
          </div>
        </div>
      </section>
    );

  return (
    <section className="app-screen" aria-labelledby="blitz-q">
      <div className="blitz-hud">
        <span className={`blitz-time ${left <= 10 ? 'low' : ''}`} role="timer" aria-label={`Осталось ${left} секунд`}>{left}</span>
        <span className="blitz-score">{score}</span>
        <span className={`blitz-mult ${mult > 1 ? 'on' : ''}`}>×{mult}</span>
      </div>
      <span className="progress mt-3 block" aria-hidden="true"><i style={{ width: `${(left / TIME) * 100}%`, transition: 'width 1s linear' }} /></span>
      <div className="blitz-card">
        <span className="chip">{q.topic}</span>
        <p id="blitz-q" className="blitz-card__q">{q.text}</p>
      </div>
      <div className="blitz-btns">
        <button type="button" className="blitz-yes" onClick={() => answer(true)}>Верно</button>
        <button type="button" className="blitz-no" onClick={() => answer(false)}>Неверно</button>
      </div>
      {flash && <p key={score + wrong} className={`blitz-flash ${flash.ok ? 'ok' : 'bad'}`} aria-live="polite">{flash.ok ? '✓ Верно' : '✗ Ошибка'} · {flash.why}</p>}
    </section>
  );
}

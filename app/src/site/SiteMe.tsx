// «Мой кабинет» ученика (как в Moodle): журнал оценок, статистика, профиль навыков, рекомендация ИИ,
// настройки ИИ-репетитора (облако / локальная модель школы / выключено) и установка на телефон.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { computeSkills, level } from '@shared/elo';
import { SKILL_LABEL } from '@shared/types';
import { PACK } from '../teacher/pack';
import { LESSONS } from './content/lessons';
import { MATH } from './content/math';
import { TEXTS } from './content/texts';
import { PLAYABLE } from './SiteTrain';
import { resetProgress, useProgress } from './progress';
import { getAi, pingOllama, setAi, type AiMode, type AiSettings } from './ai';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
declare global {
  interface Window {
    __oqyInstall?: InstallEvent | null;
  }
}

const meta = (id: string) => {
  const t = PACK.find((x) => x.id === id);
  return t ? { skill: t.skill, difficulty: t.difficulty } : undefined;
};

function titleOf(id: string) {
  return PACK.find((t) => t.id === id)?.title ?? MATH.find((m) => m.id === id)?.title ?? LESSONS.find((l) => l.id === id)?.title ?? TEXTS.find((t) => t.id === id.split('#')[0])?.title ?? id;
}

const KIND = { reading: 'Чтение', math: 'Математика', text: 'Текст', lesson: 'Урок' } as const;

export default function SiteMe() {
  const progress = useProgress();
  const reading = progress.filter((a) => a.kind === 'reading');
  const math = progress.filter((a) => a.kind === 'math');
  const skills = computeSkills(reading, meta);
  const solved = progress.filter((a) => a.kind !== 'lesson');
  const firstTry = solved.filter((a) => a.score === 1).length;
  const avgHints = solved.length ? solved.reduce((s, a) => s + a.hintsUsed, 0) / solved.length : 0;
  const mathPct = Math.round((math.filter((a) => a.score > 0).length / MATH.length) * 100);
  const dataTotal = MATH.filter((m) => m.topic === 'data').length;
  const dataPct = Math.round((math.filter((a) => MATH.find((m) => m.id === a.taskId)?.topic === 'data' && a.score > 0).length / dataTotal) * 100);

  const profile = [
    ...skills.map((s) => ({ key: s.skill, label: SKILL_LABEL[s.skill], pct: s.attempts ? Math.round(((level(s.rating) - 1) / 4) * 100) : 0, n: s.attempts })),
    { key: 'math', label: 'Математика', pct: mathPct, n: math.length },
    { key: 'data', label: 'Графики и таблицы', pct: dataPct, n: dataTotal },
  ];

  // Рекомендация: самое слабое направление → урок + следующее нерешённое задание
  const rec = useMemo(() => {
    const done = new Set(progress.map((a) => a.taskId));
    const weakest = [...profile].sort((a, b) => a.pct - b.pct || a.n - b.n)[0];
    if (weakest.key === 'math' || weakest.key === 'data') {
      const lesson = LESSONS.find((l) => l.id === (weakest.key === 'data' ? 'l-charts' : 'l-percent'))!;
      const task = MATH.find((m) => !done.has(m.id) && (weakest.key !== 'data' || m.topic === 'data')) ?? MATH[0];
      return { area: weakest.label, lesson, task: { id: task.id, title: task.title } };
    }
    const lesson = LESSONS.find((l) => l.id === `l-${weakest.key}`)!;
    const sk = skills.find((s) => s.skill === weakest.key)!;
    const target = sk.attempts ? Math.min(3, Math.max(1, level(sk.rating) - 1)) : 1;
    const task = PLAYABLE.filter((t) => t.skill === weakest.key && t.lang === 'ru' && !done.has(t.id)).sort((a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target))[0] ?? PLAYABLE[0];
    return { area: weakest.label, lesson, task: { id: task.id, title: task.title } };
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const recent = [...progress].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <section className="site-screen" aria-labelledby="me-h">
      <p className="site-kicker">Мой кабинет</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 id="me-h" className="display text-[clamp(44px,5.2vw,84px)]">Мой прогресс</h1>
        <InstallButton />
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-px bg-[var(--s-line)] border border-[var(--s-line)] md:grid-cols-4">
        {[
          ['Решено', solved.length],
          ['С первой попытки', solved.length ? `${Math.round((firstTry / solved.length) * 100)}%` : '—'],
          ['Подсказок в среднем', avgHints.toFixed(1)],
          ['Уроков пройдено', `${progress.filter((a) => a.kind === 'lesson').length}/${LESSONS.length}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-[var(--s-bg)] p-5">
            <dt className="text-sm text-[var(--s-muted)]">{k}</dt>
            <dd className="display mt-1 text-5xl">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid content-start gap-6">
          <div>
            <h2 className="text-xl font-semibold">Профиль навыков</h2>
            <ul className="mt-3 grid gap-3">
              {profile.map((p) => (
                <li key={p.key}>
                  <div className="flex items-baseline justify-between"><span className="font-semibold">{p.label}</span><span className="font-['Oswald'] text-xl">{p.n ? `${p.pct}%` : '—'}</span></div>
                  <div className="mt-1 h-2.5 bg-[var(--s-soft)]"><div className="h-full bg-[var(--s-ink)] transition-[width] duration-700" style={{ width: `${p.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-2 border-[var(--s-ink)] p-5">
            <p className="site-kicker">Рекомендация ИИ</p>
            <p className="mt-2 text-xl">
              {solved.length ? <>Слабее всего сейчас — <b>{rec.area}</b>. Начните с урока, затем закрепите заданием.</> : <>Начните с короткого урока, потом решите первое задание — профиль заполнится сам.</>}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/lessons/${rec.lesson.id}`} className="site-btn site-btn--solid">Урок: {rec.lesson.title}</Link>
              <Link to={`/train/${rec.task.id}`} className="site-btn site-btn--ghost">Задание: {rec.task.title}</Link>
            </div>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div>
            <h2 className="text-xl font-semibold">Журнал</h2>
            {recent.length === 0 ? (
              <p className="mt-2 text-[var(--s-muted)]">Пока пусто. <Link to="/train" className="underline">Решите задание</Link>.</p>
            ) : (
              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-[var(--s-muted)]"><tr className="border-b border-[var(--s-line)]"><th className="py-2 font-semibold">Что</th><th className="py-2 font-semibold">Тип</th><th className="py-2 text-right font-semibold">Оценка</th></tr></thead>
                <tbody>
                  {recent.map((a) => (
                    <tr key={a.taskId} className="border-b border-[var(--s-line)]">
                      <td className="py-2 pr-2">{titleOf(a.taskId)}</td>
                      <td className="py-2 pr-2 text-[var(--s-muted)]">{KIND[a.kind]}</td>
                      <td className="py-2 text-right font-['Oswald'] text-lg">{a.score === 1 ? '5' : a.score === 0.5 ? '4' : '2'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <AiPanel />
          {progress.length > 0 && (
            <button type="button" onClick={() => window.confirm('Удалить весь прогресс на этом устройстве? Это нельзя отменить.') && resetProgress()} className="justify-self-start text-sm font-semibold text-[var(--s-muted)] underline">
              Сбросить прогресс
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function AiPanel() {
  const [s, setS] = useState<AiSettings>(getAi);
  const [status, setStatus] = useState<string | null>(null);
  const update = (p: Partial<AiSettings>) => {
    const n = { ...s, ...p };
    setS(n);
    setAi(n);
    setStatus(null);
  };
  const MODES: { v: AiMode; label: string; text: string }[] = [
    { v: 'cloud', label: 'Облако', text: 'ИИ Oqy через интернет' },
    { v: 'local', label: 'Школьный сервер', text: 'Локальная модель Ollama по Wi-Fi школы, без интернета' },
    { v: 'off', label: 'Выключен', text: 'Только готовые подсказки' },
  ];
  return (
    <div className="border border-[var(--s-line)] p-5">
      <h2 className="text-xl font-semibold">ИИ-репетитор</h2>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Режим ИИ">
        {MODES.map((m) => (
          <label key={m.v} className={`flex min-h-12 cursor-pointer items-start gap-3 border-2 p-3 ${s.mode === m.v ? 'border-[var(--s-ink)]' : 'border-[var(--s-line)]'}`}>
            <input type="radio" name="ai-mode" checked={s.mode === m.v} onChange={() => update({ mode: m.v })} className="mt-1 accent-[var(--s-ink)]" />
            <span><b>{m.label}</b><span className="block text-sm text-[var(--s-muted)]">{m.text}</span></span>
          </label>
        ))}
      </div>
      {s.mode === 'local' && (
        <div className="mt-3 grid gap-2">
          <label className="grid gap-1 text-sm">Адрес сервера Ollama
            <input name="ollama-url" autoComplete="off" spellCheck={false} value={s.ollamaUrl} onChange={(e) => update({ ollamaUrl: e.target.value })} className="min-h-11 border border-[var(--s-line)] bg-[var(--s-bg)] px-3 font-mono" />
          </label>
          <label className="grid gap-1 text-sm">Модель
            <input name="ollama-model" autoComplete="off" spellCheck={false} value={s.model} onChange={(e) => update({ model: e.target.value })} className="min-h-11 border border-[var(--s-line)] bg-[var(--s-bg)] px-3 font-mono" />
          </label>
          <button
            type="button"
            onClick={async () => {
              setStatus('Проверяю…');
              const models = await pingOllama(s.ollamaUrl);
              setStatus(models ? `Связь есть. Модели: ${models.join(', ') || 'нет установленных'}` : 'Нет связи. Проверьте адрес и что на сервере задано OLLAMA_ORIGINS=*.');
            }}
            className="site-btn site-btn--ghost justify-self-start"
          >
            Проверить связь
          </button>
          {status && <p className="text-sm" aria-live="polite">{status}</p>}
        </div>
      )}
    </div>
  );
}

function InstallButton() {
  const [evt, setEvt] = useState<InstallEvent | null>(() => window.__oqyInstall ?? null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); window.__oqyInstall = e as InstallEvent; setEvt(e as InstallEvent); };
    const done = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  if (installed) return <span className="site-kicker">Приложение установлено</span>;
  if (!evt) return <p className="max-w-[34ch] text-sm text-[var(--s-muted)]">Android: меню браузера → «Установить приложение». После установки Oqy открывается без интернета.</p>;
  return (
    <button type="button" className="site-btn site-btn--accent" onClick={async () => { await evt.prompt(); const r = await evt.userChoice; if (r.outcome === 'accepted') setInstalled(true); window.__oqyInstall = null; setEvt(null); }}>
      Установить на телефон
    </button>
  );
}

// Каталог заданий: /train — чтение, /math — математика. Новые форматы сверху, затем все задания.
import { Link, useLocation, useSearchParams } from 'react-router';
import { computeSkills, level } from '@shared/elo';
import { SKILLS, SKILL_HINT, SKILL_LABEL, type Skill } from '@shared/types';
import { PACK } from '../teacher/pack';
import { MATH, MATH_TOPIC_LABEL, type MathTopic } from './content/math';
import { MIX_LABEL, MIXED } from './content/mixed';
import { useProgress } from './progress';

export const PLAYABLE = PACK.filter((t) => t.answer.type !== 'free');
const meta = (id: string) => {
  const t = PACK.find((x) => x.id === id);
  return t ? { skill: t.skill, difficulty: t.difficulty } : undefined;
};
const FORMAT_LABEL: Record<string, string> = { classic: 'Текст', investigation: 'Расследование', fake: 'Найди, где врут', family: 'Помоги семье', ask: 'Задай вопрос' };

function Card({ to, title, sub, done, tone, badge }: { to: string; title: string; sub: string; done?: number; tone: 'read' | 'math'; badge?: string }) {
  const ring = tone === 'math' ? 'var(--s-math)' : 'var(--s-read)';
  return (
    <li>
      <Link to={to} className="site-tile h-full flex-row! items-center gap-4 p-4">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] text-lg font-extrabold"
          style={done !== undefined ? { background: 'var(--s-ai)', color: '#fff' } : { background: tone === 'math' ? 'var(--s-math-soft)' : 'var(--s-read-soft)', color: ring }}
          aria-label={done !== undefined ? 'решено' : 'не решено'}
        >
          {done !== undefined ? '✓' : '→'}
        </span>
        <span className="min-w-0 flex-1">
          {badge && <span className={`chip ${tone === 'math' ? 'chip--math' : 'chip--read'} mb-1`}>{badge}</span>}
          <span className="block truncate font-bold">{title}</span>
          <span className="block truncate text-sm text-[var(--s-muted)]">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

export default function SiteTrain() {
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const math = pathname.startsWith('/math') || params.get('s') === 'math';
  const progress = useProgress();
  const done = new Map(progress.map((a) => [a.taskId, a.score as number]));
  const set = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v === null) n.delete(k);
    else n.set(k, v);
    setParams(n, { replace: true });
  };

  if (math) {
    const topic = params.get('topic') as MathTopic | null;
    const mixes = MIXED.filter((m) => m.subject === 'math');
    const list = MATH.filter((m) => !topic || m.topic === topic);
    const solved = MATH.filter((m) => done.has(m.id)).length + mixes.filter((m) => done.has(m.id)).length;
    return (
      <section className="app-screen" aria-labelledby="math-h">
        <header className="app-head">
          <span className="chip chip--math">Математика из жизни</span>
          <h1 id="math-h" className="app-title">Считай, как во взрослой жизни</h1>
          <p className="app-sub">Рассрочка, тарифы, скидки, ремонт, урожай, графики. Решено: <b className="text-[var(--s-ink)]">{solved} из {MATH.length + mixes.length}</b>.</p>
        </header>
        <h2 className="mt-8 text-lg font-extrabold">Новые форматы</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {mixes.map((m) => <Card key={m.id} to={`/train/${m.id}`} title={m.title} sub={`Сложность ${m.difficulty}`} badge={MIX_LABEL[m.kind]} done={done.get(m.id)} tone="math" />)}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-2" role="group" aria-label="Тема">
          <h2 className="mr-2 text-lg font-extrabold">Задачи</h2>
          {([null, 'money', 'percent', 'measure', 'rate', 'data'] as const).map((t) => (
            <button key={t ?? 'all'} type="button" aria-pressed={topic === t} onClick={() => set('topic', t)} className={`pill ${topic === t ? 'bg-[var(--s-math)]! text-white shadow-none!' : ''}`}>
              {t ? MATH_TOPIC_LABEL[t] : 'Все'}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((m) => <Card key={m.id} to={`/train/${m.id}`} title={m.title} sub={`${MATH_TOPIC_LABEL[m.topic]} · сложность ${m.difficulty} · ответ числом`} done={done.get(m.id)} tone="math" />)}
        </ul>
      </section>
    );
  }

  const skill = (SKILLS as string[]).includes(params.get('skill') ?? '') ? (params.get('skill') as Skill) : null;
  const lang = params.get('lang') === 'kk' ? 'kk' : 'ru';
  const skills = computeSkills(progress.filter((a) => a.kind === 'reading'), meta);
  const mixes = MIXED.filter((m) => m.subject === 'reading');
  const reading = PLAYABLE.filter((t) => t.lang === lang && (!skill || t.skill === skill));

  return (
    <section className="app-screen" aria-labelledby="train-h">
      <header className="app-head">
        <span className="chip chip--read">Чтение · PISA</span>
        <h1 id="train-h" className="app-title">Найди. Пойми. Оцени.</h1>
        <p className="app-sub">Расписания, инструкции, новости и рассылки. Сначала отметь уверенность, потом отвечай — ошибся, получишь подсказку, а не ответ.</p>
      </header>

      <div className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Мои навыки">
        {skills.map((s) => {
          const l = s.attempts ? level(s.rating) : 0;
          const on = skill === s.skill;
          return (
            <button key={s.skill} type="button" aria-pressed={on} onClick={() => set('skill', on ? null : s.skill)} className={`site-tile grid gap-2 p-4 text-left ${on ? 'ring-2 ring-[var(--s-read)]' : ''}`}>
              <span className="flex items-baseline justify-between"><b className="text-xl">{SKILL_LABEL[s.skill]}</b><b className="text-[var(--s-read)]">{l ? `${l}/5` : '—'}</b></span>
              <span className="text-sm text-[var(--s-muted)]">{SKILL_HINT[s.skill]}</span>
              <span className="flex gap-1" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-2 flex-1 rounded-full" style={{ background: n <= l ? 'var(--s-read)' : 'var(--s-line)' }} />)}</span>
            </button>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-extrabold">Новые форматы</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {mixes.map((m) => <Card key={m.id} to={`/train/${m.id}`} title={m.title} sub={`Сложность ${m.difficulty}`} badge={MIX_LABEL[m.kind]} done={done.get(m.id)} tone="read" />)}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">{skill ? `Навык «${SKILL_LABEL[skill]}»` : 'Все задания'} · {reading.length}</h2>
        <div role="group" aria-label="Язык" className="flex gap-2">
          {(['ru', 'kk'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => set('lang', l === 'kk' ? 'kk' : null)} className={`pill ${lang === l ? 'bg-[var(--s-read)]! text-white shadow-none!' : ''}`}>{l === 'ru' ? 'Русский' : 'Қазақша'}</button>
          ))}
        </div>
      </div>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reading.map((t) => <Card key={t.id} to={`/train/${t.id}`} title={t.title} sub={`${SKILL_LABEL[t.skill]} · ${FORMAT_LABEL[t.format] ?? t.format} · ${t.difficulty}`} done={done.get(t.id)} tone="read" />)}
      </ul>
    </section>
  );
}

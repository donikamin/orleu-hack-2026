// «Динамика»: как меняется доля верных ответов класса по неделям, по каждому навыку. SVG без библиотек.
import { SKILLS, SKILL_LABEL, type Skill } from '@shared/types';
import { weeklyTrend, type WeekPoint } from '../analytics';
import { useClass } from '../hooks';
import { Card, EmptyState } from '../../ui';

const W = 320;
const H = 140;
const PAD = { l: 34, r: 10, t: 12, b: 26 };

function Sparkline({ points, skill }: { points: WeekPoint[]; skill: Skill }) {
  const vals = points.map((p) => p.values[skill]);
  const known = vals.map((v, i) => [i, v] as const).filter((x): x is readonly [number, number] => x[1] !== null);
  const x = (i: number) => PAD.l + (points.length < 2 ? 0 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);
  const d = known.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const first = known[0]?.[1];
  const last = known[known.length - 1]?.[1];
  const delta = first !== undefined && last !== undefined ? Math.round((last - first) * 100) : null;

  return (
    <Card className="!p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold">{SKILL_LABEL[skill]}</h3>
        {delta !== null && (
          <span className={`text-sm font-semibold tabular-nums ${delta > 0 ? 'text-brand' : delta < 0 ? 'text-danger' : 'text-muted'}`}>
            {delta > 0 ? '+' : ''}
            {delta} п.п. за период
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${SKILL_LABEL[skill]}: доля верных по неделям ${known.map(([i, v]) => `${points[i].label} ${Math.round(v * 100)}%`).join(', ')}`}>
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeDasharray={g === 0.5 ? '3 4' : undefined} />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
              {g * 100}%
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {known.map(([i, v]) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--color-surface)" stroke="var(--color-brand)" strokeWidth="2" />
        ))}
        {points.map((p, i) =>
          i === 0 || i === points.length - 1 || points.length <= 5 ? (
            <text key={p.week} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
    </Card>
  );
}

export default function TrendPage() {
  const { attempts, lookup } = useClass();
  const points = weeklyTrend(attempts, lookup);
  if (points.length < 2)
    return <EmptyState title="Динамика появится через неделю">Нужны результаты хотя бы за две разные недели, чтобы показать изменение.</EmptyState>;

  return (
    <div className="space-y-4 animate-rise">
      <p className="max-w-2xl text-muted">Доля полностью верных ответов класса по неделям. Линия вверх — навык растёт. Подходит для отчёта завучу и родительского собрания.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {SKILLS.map((s) => (
          <Sparkline key={s} points={points} skill={s} />
        ))}
      </div>
      <Card className="overflow-x-auto !p-0">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="sr-only">Доля верных ответов по неделям</caption>
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 font-semibold">Неделя</th>
              {SKILLS.map((s) => (
                <th key={s} scope="col" className="px-4 py-3 font-semibold">{SKILL_LABEL[s]}</th>
              ))}
              <th scope="col" className="px-4 py-3 font-semibold">Попыток</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.week} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2 font-semibold">с {p.label}</th>
                {SKILLS.map((s) => (
                  <td key={s} className="px-4 py-2 tabular-nums">{p.values[s] === null ? '—' : `${Math.round(p.values[s]! * 100)}%`}</td>
                ))}
                <td className="px-4 py-2 tabular-nums">{p.tries}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Линейный график для уроков и задач: оси, нулевая линия, подписи. SVG без библиотек, работает офлайн.
import type { Chart } from './content/lessons';

export function ChartView({ chart, onPick, picked, good }: { chart: Chart; onPick?: (label: string) => void; picked?: string | null; good?: string | null }) {
  const W = 560;
  const H = 260;
  const P = { l: 44, r: 16, t: 16, b: 34 };
  const vals = chart.points.map((p) => p.value);
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = (i: number) => P.l + (i / (chart.points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + ((hi - v) / span) * (H - P.t - P.b);
  const step = span > 40 ? 10 : span > 16 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  const d = chart.points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    <figure className="border border-[var(--s-line)] p-4">
      <figcaption className="text-sm font-semibold text-[var(--s-muted)]">{chart.title}, {chart.unit}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${chart.title}: ${chart.points.map((p) => `${p.label} ${p.value} ${chart.unit}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.55 : 0.12} strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="currentColor" opacity="0.6">{t}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        {chart.points.map((p, i) => (
          <g key={p.label}>
            {onPick && (
              <circle
                cx={x(i)} cy={y(p.value)} r="20" fill="transparent" className="cursor-pointer"
                role="button" tabIndex={0} aria-label={`${p.label}: ${p.value} ${chart.unit}`}
                onClick={() => onPick(p.label)} onKeyDown={(e) => e.key === 'Enter' && onPick(p.label)}
              />
            )}
            <circle cx={x(i)} cy={y(p.value)} r={picked === p.label ? 9 : 5} fill={good === p.label ? 'var(--s-ai)' : picked === p.label ? 'var(--s-warn)' : 'var(--s-mint)'} stroke="currentColor" strokeWidth="2" pointerEvents="none" />
            {onPick && <text x={x(i)} y={y(p.value) - 14} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.75" pointerEvents="none">{p.value}</text>}
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.7">{p.label}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

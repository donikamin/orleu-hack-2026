// Общие компоненты интерфейса (часть C). Используют A и C.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { level } from '@shared/elo';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong disabled:bg-brand/40',
  secondary: 'bg-surface text-ink border border-line hover:border-ink/30 disabled:text-muted',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-muted',
  danger: 'bg-danger text-on-brand hover:bg-danger/90',
};

const BTN = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-colors disabled:cursor-not-allowed';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${BTN} ${VARIANT[variant]} ${className}`} {...props} />;
}

/** Ссылка, которая выглядит как кнопка (без вложенной <button> внутри <a>). */
export function ButtonLink({ variant = 'primary', className = '', ...props }: LinkProps & { variant?: Variant }) {
  return <Link className={`${BTN} ${VARIANT[variant]} ${className}`} {...props} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[var(--radius-card)] border border-line bg-surface p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link to={back} className="mb-2 inline-block text-sm font-semibold text-brand hover:underline">
            ← Назад
          </Link>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'accent' | 'danger' }) {
  const t = {
    neutral: 'bg-paper text-muted border-line',
    brand: 'bg-brand-soft text-brand border-brand/20',
    accent: 'bg-accent-soft text-accent border-accent/20',
    danger: 'bg-danger-soft text-danger border-danger/20',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}

export const LEVEL_BG = ['', 'bg-lv1', 'bg-lv2', 'bg-lv3', 'bg-lv4', 'bg-lv5'] as const;
export const LEVEL_TEXT = ['', 'Начальный', 'Базовый −', 'Базовый', 'Уверенный', 'Сильный'] as const;

/** Ячейка уровня навыка: цвет + цифра, чтобы читалось и без цвета. */
export function LevelCell({ rating, attempts }: { rating: number; attempts: number }) {
  if (attempts === 0) return <span className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">нет данных</span>;
  const l = level(rating);
  return (
    <span
      className={`inline-flex h-10 w-full items-center justify-center gap-1 rounded-lg text-sm font-bold text-ink ${LEVEL_BG[l]}`}
      title={`${LEVEL_TEXT[l]} · рейтинг ${Math.round(rating)} · заданий: ${attempts}`}
    >
      {l}
      <span className="font-medium text-muted">/5</span>
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 p-8 text-center">
      <p className="font-bold">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-muted">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full min-h-11 rounded-xl border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-muted/70 focus:border-brand';

export function Notice({ tone = 'neutral', children }: { tone?: 'neutral' | 'danger' | 'brand'; children: ReactNode }) {
  const t = { neutral: 'bg-accent-soft border-accent/20', danger: 'bg-danger-soft border-danger/20 text-danger', brand: 'bg-brand-soft border-brand/20' }[tone];
  return (
    <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${t}`}>
      {children}
    </div>
  );
}

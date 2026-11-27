import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import QRCode from 'qrcode';
import { encodeAssignment } from '@shared/qr-protocol';
import { SKILLS, SKILL_LABEL, type Skill } from '@shared/types';
import { useClass } from '../hooks';
import { Badge, Button, ButtonLink, Card, EmptyState } from '../../ui';

export default function AssignPage() {
  const { cls, lookup } = useClass();
  const all = lookup.all();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(params.get('tasks')?.split(',').filter(Boolean) ?? []));
  const [filter, setFilter] = useState<Skill | 'all'>('all');
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ids = useMemo(() => all.filter((t) => selected.has(t.id)).map((t) => t.id), [all, selected]);
  const text = ids.length ? encodeAssignment(cls.code, ids) : '';

  useEffect(() => {
    if (!text) return setQr(null);
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: 560 }).then(setQr);
  }, [text]);

  const shown = all.filter((t) => filter === 'all' || t.skill === filter);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (!all.length) return <EmptyState title="Нет заданий">Добавьте задания через «Фото → задания».</EmptyState>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Выберите задания</h2>
          <div role="group" aria-label="Фильтр по навыку" className="flex flex-wrap gap-1 text-sm">
            {(['all', ...SKILLS] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={filter === s}
                onClick={() => setFilter(s)}
                className={`min-h-9 rounded-lg px-3 font-semibold ${filter === s ? 'bg-brand text-on-brand' : 'bg-paper text-muted hover:text-ink'}`}
              >
                {s === 'all' ? 'Все' : SKILL_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {shown.map((t) => (
            <li key={t.id}>
              <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                <input type="checkbox" name="task" value={t.id} className="h-5 w-5 shrink-0 accent-[var(--color-brand)]" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.title}</span>
                  <span className="block truncate text-sm text-muted">{t.question}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone="brand">{SKILL_LABEL[t.skill]}</Badge>
                  <span className="text-xs text-muted">сложн. {t.difficulty}{t.source === 'photo' ? ' · из фото' : ''}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="lg:sticky lg:top-4 lg:self-start">
        <h2 className="text-lg font-bold">QR-код задания</h2>
        {qr ? (
          <>
            <img src={qr} alt={`QR-код с заданиями: ${ids.length}`} width={560} height={560} className="mx-auto mt-4 h-auto w-full max-w-xs rounded-xl border border-line" />
            <p className="mt-3 text-center text-sm text-muted">
              {ids.length} заданий · ученики сканируют в приложении, интернет не нужен
            </p>
            <div className="mt-4 grid gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'Скопировано' : 'Скопировать как текст (для чата)'}
              </Button>
              <ButtonLink variant="ghost" className="w-full" to={`/teacher/${cls.code}/print?tasks=${ids.join(',')}`} target="_blank">
                Распечатать для учеников без телефона
              </ButtonLink>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Отметьте задания слева, и здесь появится QR-код для экрана или доски.</p>
        )}
      </Card>
    </div>
  );
}

import { Link, useSearchParams } from 'react-router';
import { level } from '@shared/elo';
import { SKILLS, SKILL_HINT, SKILL_LABEL } from '@shared/types';
import { classAverages, formatDate, type StudentSummary } from '../analytics';
import { useClass } from '../hooks';
import { Badge, Card, EmptyState, LEVEL_BG, LEVEL_TEXT, LevelCell } from '../../ui';

type Sort = 'number' | 'weakest';

export default function ClassMap() {
  const { cls, students, attempts } = useClass();
  // сортировка в адресе: ссылкой можно поделиться, «назад» работает
  const [params, setParams] = useSearchParams();
  const sort: Sort = params.get('sort') === 'weakest' ? 'weakest' : 'number';
  const setSort = (s: Sort) => setParams(s === 'number' ? {} : { sort: s }, { replace: true });
  const avg = classAverages(students);
  const active = students.filter((s) => s.attempts > 0);

  const sorted = [...students].sort((a, b) => {
    if (sort === 'number') return a.number - b.number;
    const wa = a.weakest?.rating ?? Infinity;
    const wb = b.weakest?.rating ?? Infinity;
    return wa - wb;
  });

  if (attempts.length === 0)
    return (
      <EmptyState title="Результатов пока нет">
        Ученики решают задания в приложении (можно без интернета) и показывают вам QR-код.{' '}
        <Link to="scan" className="font-semibold text-brand underline">
          Отсканировать первый QR
        </Link>
        <p className="mt-3 text-sm">
          Код класса для учеников: <span className="font-mono font-bold text-ink">{cls.code}</span>
        </p>
      </EmptyState>
    );

  return (
    <div className="space-y-6">
      <section aria-label="Класс в целом" className="grid grid-cols-3 gap-2 sm:gap-3">
        {avg.map((a) => {
          const l = a.students ? level(a.rating) : 0;
          return (
            <Card key={a.skill} className="!p-3 sm:!p-4">
              <p className="text-sm font-semibold text-muted">{SKILL_LABEL[a.skill]}</p>
              <p className="mt-1 text-3xl font-extrabold">
                {l ? (
                  <>
                    {l}
                    <span className="text-lg text-muted">/5</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
              <p className="mt-1 hidden text-sm text-muted sm:block">{SKILL_HINT[a.skill]}</p>
              <p className="mt-2 text-xs text-muted">
                {a.students} уч. · {a.attempts} заданий
              </p>
            </Card>
          );
        })}
      </section>

      <section aria-labelledby="map-h">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="map-h" className="text-lg font-bold">
            Ученики × навыки <span className="font-normal text-muted">· активны {active.length} из {students.length}</span>
          </h2>
          <div role="group" aria-label="Сортировка" className="inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
            {(
              [
                ['number', 'По номеру'],
                ['weakest', 'Сначала слабые'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`rounded-lg px-3 py-1.5 font-semibold ${sort === k ? 'bg-brand text-on-brand' : 'text-muted hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">№</th>
                {SKILLS.map((s) => (
                  <th key={s} scope="col" className="px-2 py-3 font-semibold">
                    {SKILL_LABEL[s]}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-semibold">Заданий</th>
                <th scope="col" className="px-4 py-3 font-semibold">Последний раз</th>
                <th scope="col" className="px-4 py-3 font-semibold">Внимание</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <Row key={s.number} s={s} />
              ))}
            </tbody>
          </table>
        </div>
        <Legend />
      </section>
    </div>
  );
}

function Row({ s }: { s: StudentSummary }) {
  return (
    <tr className="border-b border-line last:border-0 hover:bg-paper/60">
      <th scope="row" className="px-4 py-2">
        <Link to={`student/${s.number}`} className="inline-flex min-h-10 min-w-10 items-center font-bold text-brand underline-offset-2 hover:underline">
          {s.number}
        </Link>
      </th>
      {s.skills.map((sk) => (
        <td key={sk.skill} className="px-2 py-2">
          <LevelCell rating={sk.rating} attempts={sk.attempts} />
        </td>
      ))}
      <td className="px-4 py-2 tabular-nums">{s.attempts || '—'}</td>
      <td className="px-4 py-2 text-sm text-muted">{s.lastTs ? formatDate(s.lastTs) : 'не занимался'}</td>
      <td className="px-4 py-2">
        {s.confidentWrong > 0 ? <Badge tone="danger">уверенно ошибается: {s.confidentWrong}</Badge> : s.attempts === 0 ? <Badge>нет данных</Badge> : null}
      </td>
    </tr>
  );
}

function Legend() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
      Уровень навыка:
      {[1, 2, 3, 4, 5].map((l) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-4 w-6 rounded ${LEVEL_BG[l]}`} />
          {l} — {LEVEL_TEXT[l].toLowerCase()}
        </span>
      ))}
      <span className="w-full text-xs">Это внутренний уровень Oqy по рамке навыков PISA, а не официальный уровень PISA.</span>
    </p>
  );
}

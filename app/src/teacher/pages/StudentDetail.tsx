import { useParams } from 'react-router';
import { level } from '@shared/elo';
import { SKILL_HINT, SKILL_LABEL } from '@shared/types';
import { formatDate, summarizeStudent } from '../analytics';
import { useClass } from '../hooks';
import { Badge, Card, EmptyState, LEVEL_TEXT, PageHeader } from '../../ui';

const CONF = ['', 'угадывал', 'сомневался', 'уверен'];

export default function StudentDetail() {
  const { number = '0' } = useParams();
  const n = Number(number);
  const { cls, attempts, lookup } = useClass();
  const s = summarizeStudent(n, attempts, lookup);
  const mine = attempts.filter((a) => a.number === n).sort((a, b) => b.ts - a.ts);

  return (
    <>
      <PageHeader title={`Ученик № ${n}`} subtitle={`${cls.name} · заданий: ${s.attempts}`} back={`/teacher/${cls.code}`} />
      {s.attempts === 0 ? (
        <EmptyState title="Нет результатов">Попросите ученика показать QR-код с результатами.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {s.skills.map((sk) => {
              const l = sk.attempts ? level(sk.rating) : 0;
              const pct = Math.max(4, Math.min(100, ((sk.rating - 950) / 500) * 100));
              return (
                <Card key={sk.skill} className="!p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{SKILL_LABEL[sk.skill]}</p>
                    {s.weakest?.skill === sk.skill && <Badge tone="accent">подтянуть</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">{SKILL_HINT[sk.skill]}</p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-paper" role="img" aria-label={`Уровень ${l || 'нет данных'} из 5`}>
                    <div className={`h-full rounded-full ${s.weakest?.skill === sk.skill ? 'bg-accent' : 'bg-brand'}`} style={{ width: `${sk.attempts ? pct : 0}%` }} />
                  </div>
                  <p className="mt-2 text-sm">
                    {l ? (
                      <>
                        <span className="font-bold">Уровень {l}/5</span> · {LEVEL_TEXT[l].toLowerCase()} · {sk.attempts} заданий
                      </>
                    ) : (
                      'нет данных'
                    )}
                  </p>
                </Card>
              );
            })}
          </div>

          <Card>
            <h2 className="text-lg font-bold">Все попытки</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Задание</th>
                    <th className="py-2 pr-3 font-semibold">Навык</th>
                    <th className="py-2 pr-3 font-semibold">Результат</th>
                    <th className="py-2 pr-3 font-semibold">Подсказки</th>
                    <th className="py-2 pr-3 font-semibold">Уверенность</th>
                    <th className="py-2 font-semibold">Когда</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((a) => {
                    const t = lookup.get(a.taskId);
                    return (
                      <tr key={a.key} className="border-b border-line last:border-0">
                        <td className="py-2 pr-3 font-semibold">{t?.title ?? a.taskId}</td>
                        <td className="py-2 pr-3">{t ? SKILL_LABEL[t.skill] : '—'}</td>
                        <td className="py-2 pr-3">
                          {a.score === 1 ? <Badge tone="brand">верно</Badge> : a.score === 0.5 ? <Badge tone="accent">частично</Badge> : <Badge tone="danger">ошибка</Badge>}
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{a.hintsUsed}</td>
                        <td className="py-2 pr-3">{a.confidence ? CONF[a.confidence] : '—'}</td>
                        <td className="py-2 text-muted">{formatDate(a.ts)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

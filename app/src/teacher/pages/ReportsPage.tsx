// «Отчёты для собрания»: по одной странице на ученика — понятным языком, с советом, что делать дома. Печать или PDF.
import { useState } from 'react';
import { level } from '@shared/elo';
import { SKILL_HINT, SKILL_LABEL } from '@shared/types';
import { HOME_ADVICE, strongest } from '../analytics';
import { useClass } from '../hooks';
import { Button, Card, EmptyState, LEVEL_TEXT } from '../../ui';

export default function ReportsPage() {
  const { cls, students } = useClass();
  const withData = students.filter((s) => s.attempts > 0);
  const [only, setOnly] = useState<number | 'all'>('all');
  const shown = withData.filter((s) => only === 'all' || s.number === only);
  const date = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!withData.length) return <EmptyState title="Отчётов пока нет">Отчёты появятся, когда у учеников будут результаты.</EmptyState>;

  return (
    <div className="animate-rise">
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-xl text-muted">По одной странице на ученика: три навыка простыми словами и что делать дома. Номер замените фамилией от руки — имён в системе нет.</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold" htmlFor="report-who">Кому</label>
          <select id="report-who" name="student" className="min-h-11 rounded-xl border border-line bg-surface px-3 text-ink" value={only} onChange={(e) => setOnly(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Всем ({withData.length})</option>
            {withData.map((s) => (
              <option key={s.number} value={s.number}>Ученик № {s.number}</option>
            ))}
          </select>
          <Button onClick={() => window.print()}>Печать или PDF</Button>
        </div>
      </div>

      <div className="grid gap-6">
        {shown.map((s) => {
          const best = strongest(s);
          return (
            <Card key={s.number} className="print-page break-inside-avoid print:border-0 print:shadow-none">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-3">
                <div>
                  <p className="text-sm text-muted">{cls.name} · {date}</p>
                  <h2 className="text-2xl font-extrabold">Ученик № {s.number} <span className="font-normal text-muted">________________</span></h2>
                </div>
                <p className="text-sm text-muted">Заданий решено: <b className="text-ink">{s.attempts}</b></p>
              </header>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {s.skills.map((sk) => {
                  const l = sk.attempts ? level(sk.rating) : 0;
                  return (
                    <div key={sk.skill} className="rounded-xl bg-raised p-4">
                      <p className="font-bold">{SKILL_LABEL[sk.skill]}</p>
                      <p className="text-sm text-muted">{SKILL_HINT[sk.skill]}</p>
                      <p className="mt-2 flex items-center gap-1" aria-label={`Уровень ${l} из 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`h-2.5 flex-1 rounded-full ${n <= l ? 'bg-brand' : 'bg-line'}`} />
                        ))}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{l ? `${l} из 5 · ${LEVEL_TEXT[l].toLowerCase()}` : 'мало данных'}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="font-bold">Что получается</h3>
                  <p className="mt-1 text-sm">{best ? `Лучше всего — «${SKILL_LABEL[best.skill]}»: ${SKILL_HINT[best.skill].toLowerCase()}.` : '—'}</p>
                  {s.confidentWrong > 0 && <p className="mt-2 text-sm">В {s.confidentWrong} заданиях был уверен, но ошибся — эти темы учитель разберёт на уроке.</p>}
                </div>
                <div>
                  <h3 className="font-bold">Что делать дома</h3>
                  <p className="mt-1 text-sm">{s.weakest ? HOME_ADVICE[s.weakest.skill] : '—'}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted">Уровни Oqy построены по рамке читательской грамотности PISA (найти, понять, оценить). Это не официальный балл PISA.</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

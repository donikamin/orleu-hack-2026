// «Трудные задания»: что не получается у всего класса и почему — разбирать на уроке, а не по одному.
import { useSearchParams } from 'react-router';
import { SKILLS, SKILL_LABEL, type Skill } from '@shared/types';
import { taskStats, type TaskStat } from '../analytics';
import { useClass } from '../hooks';
import { Badge, ButtonLink, Card, EmptyState } from '../../ui';

const VERDICT: Record<TaskStat['verdict'], { label: string; tone: 'danger' | 'accent' | 'brand' | 'neutral'; hint: string }> = {
  guess: { label: 'ложное представление', tone: 'danger', hint: 'Многие отвечают уверенно, но неверно. Разберите на доске, почему неверный ответ кажется верным.' },
  hard: { label: 'трудное', tone: 'accent', hint: 'Меньше половины решают верно. Пройдите его вместе с классом по шагам.' },
  ok: { label: 'в норме', tone: 'neutral', hint: 'Решают, но с подсказками. Можно дать похожее на дом.' },
  easy: { label: 'усвоено', tone: 'brand', hint: 'Почти все решают сразу. Переходите к сложности выше.' },
};

function Meter({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-28">
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-semibold text-ink tabular-nums">{pct}%</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TasksAnalysisPage() {
  const { cls, attempts, lookup } = useClass();
  const [params, setParams] = useSearchParams();
  const raw = params.get('skill');
  const skill: Skill | 'all' = SKILLS.includes(raw as Skill) ? (raw as Skill) : 'all';
  const setSkill = (s: Skill | 'all') => setParams(s === 'all' ? {} : { skill: s }, { replace: true });
  const stats = taskStats(attempts, lookup).filter((s) => skill === 'all' || s.task?.skill === skill);
  const toDiscuss = stats.filter((s) => s.verdict === 'guess' || s.verdict === 'hard').slice(0, 4);

  if (!attempts.length) return <EmptyState title="Пока нечего разбирать">Отсканируйте результаты учеников, и здесь появится разбор по каждому заданию.</EmptyState>;

  return (
    <div className="space-y-6 animate-rise">
      {toDiscuss.length > 0 && (
        <Card className="border-accent/30 bg-accent-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="text-lg font-bold">Разобрать на следующем уроке: {toDiscuss.length}</h2>
              <p className="mt-1 text-sm text-muted">Это задания, где ошибается больше половины класса или ошибаются уверенно. Один разбор на доске экономит десятки одинаковых ошибок.</p>
            </div>
            <ButtonLink to={`/teacher/${cls.code}/lesson?tasks=${toDiscuss.map((s) => s.taskId).join(',')}`}>Открыть урок на доске</ButtonLink>
          </div>
        </Card>
      )}

      <div role="group" aria-label="Фильтр по навыку" className="flex flex-wrap gap-1 text-sm">
        {(['all', ...SKILLS] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={skill === s}
            onClick={() => setSkill(s)}
            className={`min-h-11 rounded-xl px-4 font-semibold ${skill === s ? 'bg-brand text-on-brand' : 'bg-surface text-muted ring-1 ring-line hover:text-ink'}`}
          >
            {s === 'all' ? 'Все навыки' : SKILL_LABEL[s]}
          </button>
        ))}
      </div>

      <ul className="grid gap-3">
        {stats.map((s) => {
          const v = VERDICT[s.verdict];
          return (
            <li key={s.taskId}>
              <Card className="!p-4 sm:!p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{s.task?.title ?? s.taskId}</h3>
                      <Badge tone={v.tone}>{v.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {s.task ? `${SKILL_LABEL[s.task.skill]} · сложность ${s.task.difficulty} · ` : ''}
                      {s.students} уч., {s.tries} попыток
                    </p>
                    <p className="mt-2 max-w-2xl text-sm">{v.hint}</p>
                  </div>
                  <div className="grid w-full grid-cols-3 gap-4 sm:w-auto">
                    <Meter value={s.correctRate} label="Верно" />
                    <Meter value={Math.min(1, s.hintRate / 3)} label="Подсказки" />
                    <Meter value={s.confidentWrongRate} label="Уверенно мимо" />
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

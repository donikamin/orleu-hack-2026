import { useLiveQuery } from 'dexie-react-hooks';
import { level } from '@shared/elo';
import { SKILL_HINT, SKILL_LABEL, type Task } from '@shared/types';
import { getAttempts, getSkills, type StudentRow } from '../lib/db';
import { nextTask, pickDiagnostic, remaining } from '../lib/select';
import { ButtonLink, Card, EmptyState, LEVEL_BG, LEVEL_TEXT, PageHeader } from '../ui';

export default function MapPage({ me, tasks }: { me: StudentRow; tasks: Task[] }) {
  const data = useLiveQuery(async () => ({ skills: await getSkills(me.key), attempts: await getAttempts(me.key) }), [me.key]);
  if (!data) return null;
  const { skills, attempts } = data;
  const known = new Set(tasks.map((t) => t.id));
  const diag = (me.diagIds.length ? me.diagIds : pickDiagnostic(tasks, me.lang)).filter((id) => known.has(id));
  const diagLeft = remaining(diag, attempts).length > 0;
  const next = nextTask(tasks.filter((t) => t.lang === me.lang), attempts, skills, attempts.at(-1)?.taskId);

  return (
    <>
      <PageHeader title="Карта навыков" subtitle="Уровень навыка от 1 до 5. Это не школьная оценка." back="/student" />
      {attempts.length === 0 ? (
        <EmptyState title="Пока нет данных">Пройди диагностику, и здесь появятся три шкалы.</EmptyState>
      ) : (
        <div className="grid gap-4">
          {skills.map((s) => {
            const l = s.attempts ? level(s.rating) : 0;
            return (
              <Card key={s.skill}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-bold">{SKILL_LABEL[s.skill]}</h2>
                  <span className="font-bold">{l ? `${l} из 5 · ${LEVEL_TEXT[l]}` : 'нет данных'}</span>
                </div>
                <p className="text-sm text-muted">{SKILL_HINT[s.skill]}</p>
                <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`flex h-9 items-center justify-center rounded-lg border text-sm font-bold ${i <= l ? `${LEVEL_BG[l]} border-ink/20` : 'border-line bg-paper text-muted/60'}`}>{i}</span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Заданий: {s.attempts}</p>
              </Card>
            );
          })}
        </div>
      )}
      <Card className="mt-4">
        <h2 className="font-bold">Что дальше</h2>
        <p className="mt-1 text-muted">
          {diagLeft ? 'Закончи диагностику, чтобы карта была точнее.' : next ? `Потренируй навык «${SKILL_LABEL[next.skill]}»: ${SKILL_HINT[next.skill].toLowerCase()}.` : 'Новых заданий пока нет.'}
        </p>
        <ButtonLink className="mt-4 w-full" to={diagLeft ? '/student/play/diag' : '/student/play/train'}>{diagLeft ? 'К диагностике' : 'Тренироваться'}</ButtonLink>
      </Card>
    </>
  );
}

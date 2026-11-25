import { SKILL_HINT, SKILL_LABEL } from '@shared/types';
import { tomorrowGroups } from '../analytics';
import { useClass } from '../hooks';
import { Badge, ButtonLink, Card, EmptyState } from '../../ui';

const ADVICE = {
  locate: 'Начните с одного короткого документа. Попросите подчеркнуть слова из вопроса в тексте, прежде чем отвечать.',
  understand: 'Работайте с 2–3 документами сразу. Спрашивайте: «Что из этого следует?» и «Где это сказано?»',
  evaluate: 'Сравните два текста на одну тему. Ищите, кто автор, на что он ссылается и где эмоции вместо фактов.',
} as const;

export default function TomorrowPage() {
  const { cls, students, attempts, lookup } = useClass();
  const groups = tomorrowGroups(students, attempts, lookup);

  if (!groups.length)
    return (
      <EmptyState title="Групп пока нет">
        Группы появятся, когда у учеников будет хотя бы по несколько решённых заданий и у кого-то навык будет на уровне 3 или ниже.
      </EmptyState>
    );

  return (
    <div className="space-y-4">
      <p className="text-muted">Ученики разделены по самому слабому навыку. Для каждой группы — 3 задания и совет к уроку на 10 минут.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.skill} className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{SKILL_LABEL[g.skill]}</h2>
              <Badge tone="brand">{g.students.length} уч.</Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{SKILL_HINT[g.skill]}</p>
            <p className="mt-3 text-sm">
              <span className="font-semibold">Ученики:</span> {g.students.map((n) => `№ ${n}`).join(', ')}
            </p>
            <p className="mt-3 rounded-xl bg-paper p-3 text-sm">{ADVICE[g.skill]}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {g.tasks.map((t) => (
                <li key={t.id}>
                  {t.title} <span className="text-muted">· сложн. {t.difficulty}</span>
                </li>
              ))}
            </ol>
            <div className="mt-auto pt-4">
              <ButtonLink variant="secondary" className="w-full" to={`/teacher/${cls.code}/assign?tasks=${g.tasks.map((t) => t.id).join(',')}`}>
                Выдать группе
              </ButtonLink>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

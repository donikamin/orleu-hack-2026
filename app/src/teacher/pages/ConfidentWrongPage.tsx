import { Link } from 'react-router';
import { SKILL_LABEL } from '@shared/types';
import { confidentWrong } from '../analytics';
import { useClass } from '../hooks';
import { Badge, Card, EmptyState } from '../../ui';

export default function ConfidentWrongPage() {
  const { attempts, lookup } = useClass();
  const items = confidentWrong(attempts, lookup);
  const withConfidence = attempts.filter((a) => a.confidence).length;

  return (
    <div className="space-y-4">
      <Card className="!bg-accent-soft border-accent/20">
        <p className="font-bold">Уверен, но ошибся — это не случайность</p>
        <p className="mt-1 text-sm text-muted">
          Перед ответом ученик отмечает, насколько уверен. Если он уверен и ошибается, у него сложилось неверное представление. Его
          нужно разобрать на уроке первым: само оно не исчезнет.
        </p>
      </Card>

      {items.length === 0 ? (
        <EmptyState title={withConfidence ? 'Никто не ошибся уверенно' : 'Пока нет данных об уверенности'}>
          {withConfidence ? 'Хороший знак: ошибки пока похожи на догадки, а не на ложные представления.' : 'Данные появятся, когда ученики начнут отмечать уверенность перед ответом.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {items.map((it) => (
            <li key={it.taskId}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold">{it.task?.title ?? it.taskId}</p>
                    {it.task && <p className="mt-1 text-sm text-muted">{it.task.question}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {it.task && <Badge tone="brand">{SKILL_LABEL[it.task.skill]}</Badge>}
                    <Badge tone="danger">{it.students.length} уч.</Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  Ученики:{' '}
                  {it.students.map((n, i) => (
                    <span key={n}>
                      {i > 0 && ', '}
                      <Link to={`../student/${n}`} relative="path" className="font-semibold text-brand underline">
                        № {n}
                      </Link>
                    </span>
                  ))}
                </p>
                {it.task && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-brand">Как разобрать</summary>
                    <p className="mt-2 text-sm">{it.task.explanation}</p>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

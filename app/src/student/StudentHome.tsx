import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Task } from '@shared/types';
import { getAttempts, type StudentRow } from '../lib/db';
import { pickDiagnostic, remaining } from '../lib/select';
import { ButtonLink, Card, PageHeader } from '../ui';

export default function StudentHome({ me, tasks }: { me: StudentRow; tasks: Task[] }) {
  const attempts = useLiveQuery(() => getAttempts(me.key), [me.key]);
  if (!attempts) return null;

  const known = new Set(tasks.map((t) => t.id));
  const diag = (me.diagIds.length ? me.diagIds : pickDiagnostic(tasks, me.lang)).filter((id) => known.has(id));
  const diagLeft = remaining(diag, attempts).length;
  const hw = me.assigned ? remaining(me.assigned.ids.filter((id) => known.has(id)), attempts, me.assigned.at).length : 0;
  const fresh = attempts.filter((a) => !a.exported).length;

  return (
    <>
      <PageHeader title={`Ученик № ${me.number}`} subtitle={`Класс ${me.classCode}`} actions={<ButtonLink variant="ghost" to="/student/login">Сменить</ButtonLink>} />
      {hw > 0 && (
        <Card className="mb-4 border-accent/40">
          <h2 className="text-lg font-bold">Задание от учителя</h2>
          <p className="mt-1 text-muted">Осталось: {hw}</p>
          <ButtonLink className="mt-4 w-full" to="/student/play/homework">Выполнить</ButtonLink>
        </Card>
      )}
      <Card>
        {diagLeft > 0 ? (
          <>
            <h2 className="text-xl font-bold">Диагностика</h2>
            <p className="mt-1 text-muted">
              {diag.length - diagLeft} из {diag.length}. После неё появится твоя карта навыков. Это не оценка.
            </p>
            <ButtonLink className="mt-4 w-full" to="/student/play/diag">{diagLeft === diag.length ? 'Начать' : 'Продолжить'}</ButtonLink>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Тренировка</h2>
            <p className="mt-1 text-muted">Задания подбираются под твой самый слабый навык.</p>
            <ButtonLink className="mt-4 w-full" to="/student/play/train">Тренироваться</ButtonLink>
          </>
        )}
      </Card>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile to="/student/map" title="Карта навыков" text={attempts.length ? `Решено: ${attempts.length}` : 'Пока пусто'} />
        <Tile to="/student/give" title="Отдать учителю" text={fresh ? `Новых результатов: ${fresh}` : 'Новых нет'} />
        <Tile to="/student/homework" title="Получить задание" text="QR-код от учителя" />
      </div>
    </>
  );
}

function Tile({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link to={to} className="rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-colors hover:border-brand">
      <span className="block font-bold">{title}</span>
      <span className="block text-sm text-muted">{text}</span>
    </Link>
  );
}

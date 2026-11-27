import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { Task } from '@shared/types';
import { addAttempt, db, getAttempts, getSkills, type StudentRow } from '../lib/db';
import { nextTask, pickDiagnostic, remaining } from '../lib/select';
import { ButtonLink, Card, EmptyState, Notice, PageHeader } from '../ui';
import TaskPlayer, { type AttemptData } from './TaskPlayer';

type Mode = 'diag' | 'train' | 'homework';
const TITLE: Record<Mode, string> = { diag: 'Диагностика', train: 'Тренировка', homework: 'Задание от учителя' };

interface Current {
  task: Task | null;
  step: number;
  progress: string;
  askWhy: boolean;
}

export default function PlayPage({ me, tasks }: { me: StudentRow; tasks: Task[] }) {
  const params = useParams();
  const mode: Mode = params.mode === 'diag' || params.mode === 'homework' ? params.mode : 'train';
  const [cur, setCur] = useState<Current | null>(null);
  const [saveError, setSaveError] = useState(false);

  async function pick(step: number, lastId?: string) {
    const attempts = await getAttempts(me.key);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    let task: Task | undefined;
    let progress = '';
    if (mode === 'train') {
      const pool = tasks.filter((t) => t.lang === me.lang);
      task = nextTask(pool, attempts, await getSkills(me.key), lastId ?? attempts.at(-1)?.taskId);
      progress = `Задание ${step + 1}`;
    } else {
      let ids = mode === 'homework' ? (me.assigned?.ids ?? []) : me.diagIds;
      if (mode === 'diag' && !ids.length) {
        ids = pickDiagnostic(tasks, me.lang);
        await db.students.update(me.key, { diagIds: ids });
      }
      ids = ids.filter((id) => byId.has(id));
      const left = remaining(ids, attempts, mode === 'homework' ? me.assigned?.at : 0);
      task = left.length ? byId.get(left[0]) : undefined;
      progress = `${ids.length - left.length + 1} из ${ids.length}`;
    }
    // «Почему?» — в одном задании из четырёх, не в диагностике
    const askWhy = mode !== 'diag' && attempts.length % 4 === 3;
    setCur({ task: task ?? null, step, progress, askWhy });
  }

  useEffect(() => {
    void pick(0);
    // задание выбираем при входе в режим и по кнопке «Дальше», а не при каждом обновлении базы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function save(task: Task, data: AttemptData) {
    try {
      await addAttempt(me.key, task, data);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }

  if (!cur) return <p className="text-muted">Загрузка…</p>;
  const { task } = cur;
  if (!task) {
    if (mode === 'train') return <EmptyState title="Заданий пока нет">Подключись к интернету один раз, чтобы загрузить задания.</EmptyState>;
    return (
      <Card className="text-center">
        <h1 className="text-2xl font-extrabold">Готово!</h1>
        <p className="mt-2 text-muted">{mode === 'diag' ? 'Диагностика пройдена, карта навыков готова.' : 'Все задания учителя выполнены.'}</p>
        <div className="mt-5 grid gap-2">
          {mode === 'diag' ? <ButtonLink to="/student/map">Открыть карту навыков</ButtonLink> : <ButtonLink to="/student/give">Отдать результаты учителю</ButtonLink>}
          <ButtonLink variant="ghost" to="/student">На главную</ButtonLink>
        </div>
      </Card>
    );
  }
  return (
    <>
      <PageHeader title={task.title} subtitle={`${TITLE[mode]} · ${cur.progress}`} back="/student" />
      {saveError && <div className="mb-4"><Notice tone="danger">Не получилось сохранить результат: возможно, в телефоне закончилось место.</Notice></div>}
      <TaskPlayer
        key={cur.step}
        task={task}
        askWhy={cur.askWhy}
        onAttempt={(d) => save(task, d)}
        onNext={() => {
          window.scrollTo(0, 0);
          void pick(cur.step + 1, task.id);
        }}
      />
    </>
  );
}

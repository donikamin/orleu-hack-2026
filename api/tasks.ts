import { body, classCodeOf, handle, HttpError, json, limit } from '../server/http';
import { isTask, pack } from '../server/pack';
import { requireTeacher, store } from '../server/store';

// POST /api/tasks {classCode, tasks} + x-teacher-key — проверенные учителем задания для класса.
// Ученики получают их через GET /api/pack?v=1&class=КОД.
export const POST = handle(async (req) => {
  limit(req, 'tasks', 20);
  const b = await body(req);
  const code = classCodeOf(b.classCode);
  await requireTeacher(req, code);
  const tasks = b.tasks;
  if (!Array.isArray(tasks) || !tasks.length || tasks.length > 20 || !tasks.every(isTask)) throw new HttpError(400, 'Неверный список заданий');
  const known = new Set(pack().map((t) => t.id));
  if (tasks.some((t) => known.has(t.id))) throw new HttpError(400, 'Задание базы нельзя заменить');
  // повтор id в одной пачке сломал бы запись в базу
  await store().saveTasks([...new Map(tasks.map((t) => [t.id, t])).values()], code);
  return json({ saved: tasks.length });
});

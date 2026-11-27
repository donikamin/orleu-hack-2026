import { ask, obj, studentText, taskText } from '../ai';
import { body, handle, HttpError, json, limit, str } from '../http';
import { findTask } from '../store';

export const POST = handle(async (req) => {
  limit(req, 'grade', 60);
  const b = await body(req, 20_000);
  const task = await findTask(str(b.taskId, 'taskId', 64));
  const answer = str(b.answer, 'answer', 1500);
  if (task.answer.type !== 'free') throw new HttpError(400, 'Это задание проверяется в приложении');
  const total = task.answer.rubric.length;
  const r = await ask<{ met: boolean[]; feedback: string }>({
    prompt: 'grade',
    content: `${taskText(task, true)}\n\n${studentText(answer)}`,
    schema: obj({ met: { type: 'array', items: { type: 'boolean' } }, feedback: { type: 'string' } }),
    timeoutMs: 13_000,
    maxTokens: 2500,
  });
  if (r.met.length !== total) throw new HttpError(502, 'ИИ вернул неполный ответ, попробуйте ещё раз');
  // Балл считает код, а не ИИ: те же пороги, что в самопроверке без интернета
  const n = r.met.filter(Boolean).length;
  return json({ score: n === total ? 1 : n > 0 && n / total >= 0.5 ? 0.5 : 0, feedback: r.feedback.trim().slice(0, 600) });
});

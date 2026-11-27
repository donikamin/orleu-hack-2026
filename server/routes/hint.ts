import { ask, hasAi, obj, studentText, taskText } from '../ai';
import { body, handle, HttpError, json, limit, str } from '../http';
import { revealsAnswer } from '../leak';
import { findTask } from '../store';

export const POST = handle(async (req) => {
  const b = await body(req, 20_000);
  const level = b.hintLevel;
  if (level !== 0 && level !== 1 && level !== 2) throw new HttpError(400, 'Неверный уровень подсказки');
  const task = await findTask(str(b.taskId, 'taskId', 64));
  const answer = typeof b.answer === 'string' ? b.answer.slice(0, 1500) : '';
  const fallback = () => json({ hint: task.hints[level] });
  if (!hasAi()) return fallback();
  try {
    limit(req, 'hint', 120);
    const { hint } = await ask<{ hint: string }>({
      prompt: 'hint',
      content: `${taskText(task, true)}\n\nУровень подсказки: ${level + 1}\nПодсказка методиста этого уровня: ${task.hints[level]}\n\n${studentText(answer || '(ещё не отвечал)')}`,
      schema: obj({ hint: { type: 'string' } }),
      timeoutMs: 5000, // приложение ждёт 6 секунд
      maxTokens: 1500,
    });
    const clean = hint.trim();
    return clean && clean.length <= 500 && !revealsAnswer(clean, task) ? json({ hint: clean }) : fallback();
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    return fallback();
  }
});

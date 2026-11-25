import { ask, obj, studentText, taskText } from '../server/ai';
import { body, handle, json, limit, str } from '../server/http';
import { findTask } from '../server/store';

export const POST = handle(async (req) => {
  limit(req, 'why', 60);
  const b = await body(req, 20_000);
  const task = await findTask(str(b.taskId, 'taskId', 64));
  const reason = str(b.reason, 'reason', 500);
  const r = await ask<{ ok: boolean; feedback: string }>({
    prompt: 'why',
    content: `${taskText(task, true)}\n\n${studentText(reason)}`,
    schema: obj({ ok: { type: 'boolean' }, feedback: { type: 'string' } }),
    timeoutMs: 9000,
    maxTokens: 2000,
  });
  return json({ ok: r.ok, feedback: r.feedback.trim().slice(0, 600) });
});

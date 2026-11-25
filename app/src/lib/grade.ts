// Проверка ответа без интернета.
import type { Attempt, Task } from '@shared/types';

export type Score = Attempt['score'];

/** selected — индексы вариантов или предложений. Лишние отметки отнимают от верных, «отметить всё» не помогает. */
export function gradeOffline(task: Task, selected: number[]): Score {
  const a = task.answer;
  if (a.type === 'free') return 0; // свободный ответ: ИИ или самопроверка
  if (a.type === 'choice') return selected[0] === a.correct ? 1 : 0;
  const correct = new Set(a.correct);
  const hits = selected.filter((i) => correct.has(i)).length;
  const wrong = selected.length - hits;
  if (hits === correct.size && wrong === 0) return 1;
  return hits > 0 && (hits - wrong) / correct.size >= 0.5 ? 0.5 : 0;
}

export function rubricScore(checked: number, total: number): Score {
  if (total === 0 || checked === 0) return 0;
  return checked === total ? 1 : checked / total >= 0.5 ? 0.5 : 0;
}

/** Текст ответа для ИИ-подсказки. */
export function answerText(task: Task, selected: number[], text: string): string {
  const a = task.answer;
  if (a.type === 'free') return text;
  const list = a.type === 'spans' ? a.sentences : a.options;
  return selected.map((i) => list[i]).join(' | ');
}

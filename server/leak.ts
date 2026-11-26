// Защита «ответ не раскрыт»: если подсказка выдаёт ответ, отдаём статическую из базы.
import type { Task } from '../shared/types';

const tokens = (s: string) => s.toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\p{N}]+/gu) ?? [];
const stems = (s: string) => new Set(tokens(s).filter((w) => w.length > 3 && !/^\d+$/.test(w)).map((w) => w.slice(0, 5)));
// «4 980» и «4980» — одно число
const numbers = (s: string) => new Set((s.replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, '$1').match(/\d+(?:[.,:]\d+)?/g) ?? []));

const POSITION =
  /(?:вариант|предложени|ответ|нұсқа|сөйлем)\p{L}*\s*[«"(№]*\s*\d(?![\p{L}\p{N}])|(?:перв|втор|трет|четв[её]рт|последн)\p{L}*\s+вариант|(?:верн|правильн)\p{L}*\s+(?:ответ|вариант)|(?:дұрыс)\s+(?:жауап|нұсқа)/iu;

// Буква варианта: только заглавная, чтобы не путать с предлогом «ответ в тексте»
const LETTER = /(?:[Вв]ариант|[Оо]твет|нұсқа|жауап)\p{L}*\s*[«"(]*[A-DА-Г](?![\p{L}\p{N}])/u;

const share = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length / a.size;

export function revealsAnswer(hint: string, task: Task): boolean {
  if (POSITION.test(hint) || LETTER.test(hint)) return true;
  const a = task.answer;
  if (a.type === 'free') return false;
  const all = a.type === 'spans' ? a.sentences : a.options;
  const right = a.type === 'choice' ? [a.correct] : a.correct;
  const given = numbers(`${task.question} ${task.docs.map((d) => d.body).join(' ')}`);
  const hintTokens = ` ${tokens(hint).join(' ')} `;
  const hintNumbers = numbers(hint);
  const hintStems = stems(hint);

  // Вычисленное число, которого нет в тексте задания
  return right.some((i) => {
    const text = all[i];
    if (hintTokens.includes(` ${tokens(text).join(' ')} `)) return true;
    if (a.type !== 'spans' && [...numbers(text)].some((n) => !given.has(n) && hintNumbers.has(n))) return true;
    // Пересказ: почти все слова ответа есть в подсказке и к другим вариантам она так не подходит
    const s = stems(text);
    if (s.size < 3) return false;
    const mine = share(s, hintStems);
    const other = Math.max(0, ...all.filter((_, j) => !right.includes(j)).map((o) => (stems(o).size ? share(stems(o), hintStems) : 0)));
    return mine >= 0.7 && mine > other;
  });
}

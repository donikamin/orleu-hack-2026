// Достижения: 12 значков за реальные шаги в учёбе. Считаются из прогресса и серии — без сервера.
import { PACK } from '../teacher/pack';
import { LESSONS } from './content/lessons';
import { MATH } from './content/math';
import { MIXED } from './content/mixed';
import type { SiteAttempt } from './progress';
import type { StreakView } from './streak';

interface Badge {
  id: string;
  title: string;
  how: string;
  icon: string; // путь SVG 24×24
  color: string;
  value: number;
  goal: number;
}

const skillOf = (id: string) => PACK.find((t) => t.id === id)?.skill;

export function badgesFor(p: SiteAttempt[], s: StreakView): Badge[] {
  const ok = p.filter((a) => a.score > 0);
  const firstTry = p.filter((a) => a.score === 1 && a.hintsUsed === 0).length;
  const math = ok.filter((a) => a.kind === 'math').length;
  const reading = ok.filter((a) => a.kind === 'reading').length;
  const evaluate = ok.filter((a) => skillOf(a.taskId) === 'evaluate').length;
  const kk = ok.filter((a) => PACK.find((t) => t.id === a.taskId)?.lang === 'kk').length;
  const lessons = p.filter((a) => a.kind === 'lesson').length;
  const texts = new Set(p.filter((a) => a.kind === 'text').map((a) => a.taskId.split('#')[0])).size;
  const mixed = ok.filter((a) => MIXED.some((m) => m.id === a.taskId)).length;
  const graphs = ok.filter((a) => MATH.find((m) => m.id === a.taskId)?.topic === 'data').length;
  return [
    { id: 'first', title: 'Первый шаг', how: 'Реши первое задание', icon: 'M5 12l4 4L19 6', color: '#12b76a', value: ok.length, goal: 1 },
    { id: 'streak3', title: 'Огонёк', how: 'Серия 3 дня подряд', icon: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.2-4.2 2.5-5.4 0 1.7.8 2.9 2 2.9C11 8 10.5 5.5 12 3z', color: '#ff6a00', value: s.best, goal: 3 },
    { id: 'streak7', title: 'Неделя без пропусков', how: 'Серия 7 дней', icon: 'M4 5h16v15H4zM4 10h16M9 3v4M15 3v4', color: '#ff4d00', value: s.best, goal: 7 },
    { id: 'math10', title: 'Считаю как взрослый', how: '10 задач по математике', icon: 'M6 3h12v18H6zM9 7h6M9 11h1M12 11h1M15 11h0M9 15h1M12 15h1', color: '#ff7a1a', value: math, goal: 10 },
    { id: 'read10', title: 'Внимательный читатель', how: '10 заданий на чтение', icon: 'M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z', color: '#2f6bff', value: reading, goal: 10 },
    { id: 'clean', title: 'Без подсказок', how: '5 заданий с первой попытки', icon: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z', color: '#ffbf00', value: firstTry, goal: 5 },
    { id: 'fake', title: 'Детектор фейков', how: '5 заданий «Оценить»', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5', color: '#0ea5e9', value: evaluate, goal: 5 },
    { id: 'graphs', title: 'Читаю графики', how: '3 задачи на графики и таблицы', icon: 'M4 20V4M4 20h16M8 16l4-5 3 3 5-6', color: '#14b8a6', value: graphs, goal: 3 },
    { id: 'formats', title: 'Мастер форматов', how: '4 задания новых форматов', icon: 'M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H5v-3a2 2 0 1 0 0-4z', color: '#e11d48', value: mixed, goal: 4 },
    { id: 'lessons', title: 'Все уроки', how: `Пройти ${LESSONS.length} уроков`, icon: 'M4 6l8-3 8 3-8 3zM7 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8', color: '#1b2433', value: lessons, goal: LESSONS.length },
    { id: 'texts', title: 'Слушатель', how: 'Ответить по 3 текстам', icon: 'M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7', color: '#0d9488', value: texts, goal: 3 },
    { id: 'kk', title: 'Қазақша', how: 'Реши задание на казахском', icon: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z', color: '#00a3c4', value: kk, goal: 1 },
  ];
}

export function Badges({ progress, streak }: { progress: SiteAttempt[]; streak: StreakView }) {
  const list = badgesFor(progress, streak);
  const got = list.filter((b) => b.value >= b.goal).length;
  return (
    <section className="mt-8" aria-labelledby="badges-h">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges-h" className="text-xl font-extrabold">Достижения</h2>
        <span className="muted-s">{got} из {list.length}</span>
      </div>
      <ul className="badges mt-3">
        {list.map((b) => {
          const on = b.value >= b.goal;
          return (
            <li key={b.id} className={`badge ${on ? 'badge--on' : ''}`} style={{ '--b': b.color } as React.CSSProperties}>
              <span className="badge__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={b.icon} /></svg>
              </span>
              <b>{b.title}</b>
              <span className="muted-s">{b.how}</span>
              <span className="progress" aria-label={`${Math.min(b.value, b.goal)} из ${b.goal}`} style={{ '--c': b.color } as React.CSSProperties}>
                <i style={{ width: `${Math.min(100, (b.value / b.goal) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

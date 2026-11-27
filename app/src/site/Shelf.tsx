// «Подборка для тебя»: горизонтальная полка карточек со стрелками (идея витрин спортивных брендов).
// Подбирает следующие нерешённые задания по математике и чтению, новые форматы, текст с голосом и урок.
import { useRef } from 'react';
import { Link } from 'react-router';
import { SKILL_LABEL } from '@shared/types';
import { MATH, MATH_TOPIC_LABEL } from './content/math';
import { MIXED, MIX_LABEL } from './content/mixed';
import { LESSONS } from './content/lessons';
import { TEXTS } from './content/texts';
import { PLAYABLE } from './SiteTrain';

interface Item {
  id: string;
  to: string;
  title: string;
  meta: string;
  badge: string;
  glyph: string;
  tone: 'math' | 'read' | 'mix' | 'text' | 'lesson';
}

const MATH_GLYPH: Record<string, string> = { money: '₸', percent: '%', measure: '📐', rate: '⏱', data: '📈' };

export function Shelf({ done }: { done: Set<string> }) {
  const track = useRef<HTMLUListElement>(null);
  const items: Item[] = [
    ...MATH.filter((m) => !done.has(m.id)).slice(0, 3).map((m): Item => ({ id: m.id, to: `/train/${m.id}`, title: m.title, meta: `${MATH_TOPIC_LABEL[m.topic]} · ${'●'.repeat(m.difficulty)}`, badge: '+10 XP', glyph: MATH_GLYPH[m.topic] ?? '∑', tone: 'math' })),
    ...MIXED.filter((m) => !done.has(m.id)).slice(0, 2).map((m): Item => ({ id: m.id, to: `/train/${m.id}`, title: m.title, meta: m.subject === 'math' ? 'Математика' : 'Чтение', badge: MIX_LABEL[m.kind], glyph: '✦', tone: 'mix' })),
    ...PLAYABLE.filter((t) => t.lang === 'ru' && !done.has(t.id)).slice(0, 3).map((t): Item => ({ id: t.id, to: `/train/${t.id}`, title: t.title, meta: `${SKILL_LABEL[t.skill]} · ${'●'.repeat(t.difficulty)}`, badge: '+10 XP', glyph: 'Аа', tone: 'read' })),
    ...TEXTS.slice(0, 2).map((t): Item => ({ id: t.id, to: `/texts/${t.id}`, title: t.title, meta: `${t.genre} · ${t.minutes} мин`, badge: 'С голосом', glyph: '📖', tone: 'text' })),
    ...LESSONS.filter((l) => !done.has(l.id)).slice(0, 1).map((l): Item => ({ id: l.id, to: `/lessons/${l.id}`, title: l.title, meta: `${l.minutes} мин · ${l.steps.length} шагов`, badge: 'Урок', glyph: '🎓', tone: 'lesson' })),
  ];

  const go = (dir: 1 | -1) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="mt-10" aria-labelledby="shelf-h">
      <div className="shelf-head">
        <h2 id="shelf-h" className="shelf-title">Подборка для тебя</h2>
        <div className="flex gap-2">
          <button type="button" className="shelf-arrow" onClick={() => go(-1)} aria-label="Прокрутить назад">←</button>
          <button type="button" className="shelf-arrow" onClick={() => go(1)} aria-label="Прокрутить вперёд">→</button>
        </div>
      </div>
      <ul
        ref={track}
        className="shelf"
        tabIndex={0}
        aria-label="Задания на сегодня, листаются стрелками"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
      >
        {items.map((it) => (
          <li key={it.id}>
            <Link to={it.to} className={`shelf-card shelf-card--${it.tone}`}>
              <span className="shelf-card__cover" aria-hidden="true">
                <span className="shelf-card__glyph">{it.glyph}</span>
                <span className="shelf-card__badge">{it.badge}</span>
              </span>
              <span className="shelf-card__body">
                <b>{it.title}</b>
                <span>{it.meta}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

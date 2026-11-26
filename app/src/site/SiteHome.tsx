// Главная ученика: пульт приложения. Сразу видно, что можно сделать, и куда нажать.
import { Link } from 'react-router';
import { computeSkills, level } from '@shared/elo';
import { SKILL_LABEL } from '@shared/types';
import { PACK } from '../teacher/pack';
import { MATH } from './content/math';
import { LESSONS } from './content/lessons';
import { PLAYABLE } from './SiteTrain';
import { useProgress } from './progress';

const meta = (id: string) => {
  const t = PACK.find((x) => x.id === id);
  return t ? { skill: t.skill, difficulty: t.difficulty } : undefined;
};

const Cam = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>;
const Calc = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h6" /></svg>;
const Book = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z" /></svg>;
const Steps = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 20h4v-4h4v-4h4V8h4" /></svg>;

export default function SiteHome() {
  const progress = useProgress();
  const done = new Set(progress.map((a) => a.taskId));
  const reading = computeSkills(progress.filter((a) => a.kind === 'reading'), meta);
  const mathDone = MATH.filter((m) => done.has(m.id)).length;
  const readDone = PLAYABLE.filter((t) => done.has(t.id)).length;
  const lessonsDone = LESSONS.filter((l) => done.has(l.id)).length;
  const nextMath = MATH.find((m) => !done.has(m.id)) ?? MATH[0];

  return (
    <section className="app-screen" aria-labelledby="home-h">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="app-head">
          <span className="chip chip--ai">Работает без интернета</span>
          <h1 id="home-h" className="app-title">Привет! Что сегодня прокачаем?</h1>
          <p className="app-sub">Чтение и математика из жизни: тарифы, скидки, расписания, графики. ИИ подсказывает, но не решает за тебя.</p>
        </header>
        <Link to="/case" className="pill inline-flex items-center">Для жюри: задача кейса →</Link>
      </div>

      <div className="hub mt-8">
        <Link to="/tutor" className="hub__tile hub__tile--ai">
          <b>ИИ-наставник по фото</b>
          <span>Сфоткай задачу из учебника или квитанцию — разберём вопросами, шаг за шагом. Фото уходит даже на 2G.</span>
          <em>Открыть камеру →</em>
          <Cam />
        </Link>
        <Link to="/math" className="hub__tile hub__tile--math">
          <b>Математика</b>
          <span>{MATH.length} задач: рассрочка, графики, бюджет</span>
          <em>{mathDone ? `${mathDone} из ${MATH.length} решено →` : `Начать: «${nextMath.title}» →`}</em>
          <Calc />
        </Link>
        <Link to="/train" className="hub__tile hub__tile--read">
          <b>Чтение</b>
          <span>{PLAYABLE.length} заданий PISA: найти, понять, оценить</span>
          <em>{readDone ? `${readDone} решено →` : 'Начать →'}</em>
          <Book />
        </Link>
        <Link to="/lessons" className="hub__tile hub__tile--lesson">
          <b>Уроки по 5 минут</b>
          <span>Объяснение, пример и разбор каждой ошибки</span>
          <em>{lessonsDone} из {LESSONS.length} пройдено →</em>
          <Steps />
        </Link>
        <Link to="/texts" className="hub__tile hub__tile--read" style={{ background: 'linear-gradient(150deg,#0ea5e9,#0369a1)' }}>
          <b>Тексты</b>
          <span>Статья, объявление, рассказ, интервью, фейк-новость</span>
          <em>Читать →</em>
          <Book />
        </Link>
      </div>

      <h2 className="mt-10 text-xl font-extrabold">Мой прогресс</h2>
      <div className="stat-row mt-3">
        {reading.map((s) => (
          <div key={s.skill} className="stat">
            <b>{s.attempts ? `${level(s.rating)}/5` : '—'}</b>
            <span>{SKILL_LABEL[s.skill]}</span>
          </div>
        ))}
        <div className="stat">
          <b>{mathDone}/{MATH.length}</b>
          <span>Математика</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/me" className="site-btn site-btn--ghost">Мой кабинет</Link>
        <Link to="/offline" className="site-btn site-btn--ghost">Отправить результаты учителю (QR)</Link>
      </div>
    </section>
  );
}

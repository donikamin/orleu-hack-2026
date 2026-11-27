// Главная ученика: пульт приложения. Сразу видно, что можно сделать, и куда нажать.
import { Link } from 'react-router';
import { computeSkills, level } from '@shared/elo';
import { SKILL_LABEL } from '@shared/types';
import { PACK } from '../teacher/pack';
import { MATH } from './content/math';
import { LESSONS } from './content/lessons';
import { PLAYABLE } from './SiteTrain';
import { useProgress } from './progress';
import { Bolt, Flame, Snow } from './Icons';
import { daysWord, useStreak } from './streak';
import { DAILY_BONUS, dailyClaimed, dailyTask } from './daily';
import { Shelf } from './Shelf';

const meta = (id: string) => {
  const t = PACK.find((x) => x.id === id);
  return t ? { skill: t.skill, difficulty: t.difficulty } : undefined;
};

const Mic = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
const Calc = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h6" /></svg>;
const Book = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6z" /></svg>;
const Steps = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 20h4v-4h4v-4h4V8h4" /></svg>;

export default function SiteHome() {
  const progress = useProgress();
  const st = useStreak();
  const done = new Set(progress.map((a) => a.taskId));
  const daily = dailyTask();
  const dailyDone = dailyClaimed() || progress.some((a) => a.taskId === daily.id && a.score > 0 && new Date(a.ts * 1000).toDateString() === new Date().toDateString());
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
        <Link to="/jury" className="jury-pill">★ Демо для жюри за 3 минуты →</Link>
      </div>

      <Link to={daily.href} className="daily mt-7">
        <span className="daily__badge" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="daily__kicker">Задача дня · {daily.subject === 'math' ? 'математика' : 'чтение'} · {dailyDone ? 'решена ✓' : `+${DAILY_BONUS} XP бонус`}</span>
          <b className="daily__title">{daily.title}</b>
          <span className="daily__teaser">{daily.teaser}</span>
        </span>
        <span className="site-btn site-btn--solid daily__go">{dailyDone ? 'Ещё раз' : 'Решить'} →</span>
      </Link>

      <div className="hub mt-5">
        <Link to="/tutor" className="hub__tile hub__tile--ai">
          <b>ИИ-ответчик</b>
          <span>3D-собеседник: спроси голосом, текстом или сфоткай задачу — он ответит вслух. Может прочитать любой текст.</span>
          <span className="hub__peek" aria-hidden="true">
            <span className="hub__peek-q">Как найти 15% от 24 000?</span>
            <span className="hub__peek-a">Сначала найди 1%: раздели 24 000 на 100. Сколько получилось?</span>
            <span className="hub__peek-row justify-start! text-xs font-bold"><span className="wave"><i /><i /><i /><i /><i /><i /></span> говорит вслух · губы двигаются в такт</span>
          </span>
          <em>Спросить →</em>
          <Mic />
        </Link>
        <Link to="/math" className="hub__tile hub__tile--math">
          <b>Математика</b>
          <span>{MATH.length} задач: рассрочка, графики, бюджет</span>
          <span className="hub__peek" aria-hidden="true">
            <span className="hub__peek-row">Телефон <b>120 000 ₸</b></span>
            <span className="hub__peek-row">Рассрочка 6 мес. <b>+9%</b></span>
            <span className="hub__peek-row">В месяц <span className="hub__peek-box">₸</span></span>
          </span>
          <em>{mathDone ? `${mathDone} из ${MATH.length} решено →` : `Начать: «${nextMath.title}» →`}</em>
          <Calc />
        </Link>
        <Link to="/train" className="hub__tile hub__tile--read">
          <b>Чтение</b>
          <span>{PLAYABLE.length} заданий PISA: найти, понять, оценить</span>
          <span className="hub__peek" aria-hidden="true">
            <span className="hub__peek-row"><b>Автобус № 12</b> отправление</span>
            <span className="hub__peek-row">Аул → школа <span>07:10</span></span>
            <span className="hub__peek-row hub__peek-row--on">Аул → школа <span>07:40 ✓</span></span>
          </span>
          <em>{readDone ? `${readDone} решено →` : 'Начать →'}</em>
          <Book />
        </Link>
        <Link to="/lessons" className="hub__tile hub__tile--lesson">
          <b>Уроки по 5 минут</b>
          <span>Объяснение, пример и разбор каждой ошибки</span>
          <span className="hub__peek" aria-hidden="true">
            <span className="hub__peek-row"><b>Проценты</b> шаг 3 из 5</span>
            <span className="hub__peek-steps"><i className="on" /><i className="on" /><i className="on" /><i /><i /></span>
          </span>
          <em>{lessonsDone} из {LESSONS.length} пройдено →</em>
          <Steps />
        </Link>
        <Link to="/texts" className="hub__tile hub__tile--read" style={{ background: 'linear-gradient(150deg,#0ea5e9,#0369a1)' }}>
          <b>Тексты</b>
          <span>Статья, объявление, рассказ, интервью, фейк-новость</span>
          <span className="hub__peek" aria-hidden="true">
            <span><span className="hub__peek-mark">Ещё в 1960 году Аральское море было четвёртым озером мира.</span> В нём ловили рыбу…</span>
            <span className="hub__peek-row justify-start! text-xs font-bold"><span className="wave"><i /><i /><i /><i /><i /><i /></span> читается вслух</span>
          </span>
          <em>Читать →</em>
          <Book />
        </Link>
        <Link to="/streak" className="hub__tile hub__tile--fire" aria-label={`Серия: ${st.streak} ${daysWord(st.streak)} подряд, заморозок ${st.freezes}, цель дня ${st.today} из ${st.goal} XP`}>
          <span className="flex items-center gap-3 opacity-100!">
            <Flame size={44} on className={st.alive ? 'flame' : 'opacity-70'} />
            <span className="grid opacity-100!">
              <b>{st.streak} {daysWord(st.streak)} подряд</b>
              <span className="text-sm">{st.alive ? 'Огонь горит — так держать!' : st.streak ? 'Реши одно задание, чтобы не погас' : 'Реши задание — и огонь загорится'}</span>
            </span>
          </span>
          <span className="hub-week" aria-hidden="true">
            {st.week.map((d) => (
              <span key={d.key}>
                <i className={`hub-week__dot hub-week__dot--${d.state}`}>{d.state === 'done' ? '✓' : d.state === 'frozen' ? '❄' : ''}</i>
                {d.label}
              </span>
            ))}
          </span>
          <em className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><Snow size={18} /> заморозок: {st.freezes}</span>
            <span className="inline-flex items-center gap-1"><Bolt size={18} /> цель дня: {st.today}/{st.goal} XP</span>
          </em>
        </Link>
      </div>

      <Shelf done={done} />

      <h2 className="shelf-title mt-10">Мой прогресс</h2>
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

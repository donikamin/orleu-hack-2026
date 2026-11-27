// «Демо для жюри за 3 минуты»: одна мысль сверху, пошаговый гид (шаг → «Открыть экран» → «Следующий шаг»),
// таблица «требование кейса → что сделано», честный список того, что работает прямо сейчас.
// Один акцентный цвет, без лишнего текста.
import { Link, useSearchParams } from 'react-router';
import { MATH } from './content/math';
import { PLAYABLE } from './SiteTrain';
import { LESSONS } from './content/lessons';
import { MIXED } from './content/mixed';
import { TEXTS } from './content/texts';

const STEPS = [
  {
    time: '0:30', who: 'Ученик', title: 'Ошибка → подсказка, а не ответ', to: '/train/m-02', btn: 'Открыть задачу',
    doo: 'Введите любое неверное число в задаче про мобильный тариф, потом верное.',
    see: ['Подсказка из трёх ступеней, ответ не раскрывается', 'Разбор после решения', '+XP и огонь серии дней'],
  },
  {
    time: '0:40', who: 'ИИ', title: '3D-собеседник отвечает голосом', to: '/tutor', btn: 'Открыть ИИ-ответчика',
    doo: 'Нажмите микрофон и скажите «Прочитай текст про Арал» или «Кто такой Абай?»',
    see: ['Губы двигаются в такт, субтитры', 'Женский или мужской собеседник, русский и казахский', 'Без ключа ИИ: встроенная база и Википедия'],
  },
  {
    time: '0:30', who: 'Мотивация', title: 'Блиц-игра и мини-тест PISA', to: '/blitz', btn: 'Открыть блиц-игру',
    doo: 'Сыграйте 60 секунд: «верно или неверно» про скидки, проценты и единицы.',
    see: ['Комбо-множитель и рекорд', 'Мини-тест показывает уровень по каждому навыку PISA', 'Серия дней с заморозками'],
  },
  {
    time: '0:30', who: 'Без интернета', title: 'Работает в режиме самолёта', to: '/offline', btn: 'Открыть «2G и QR»',
    doo: 'Посмотрите блок «Проверка офлайна», затем нажмите «Показать QR».',
    see: ['Сколько файлов и мегабайт сохранено в телефоне', 'Сколько скачала эта сессия', 'Результат учителю QR-кодом без сети'],
  },
  {
    time: '0:50', who: 'Учитель', title: 'Карта класса и план на завтра', to: '/demo', btn: 'Открыть класс 8 «Б»',
    doo: 'Откройте пример класса: 12 вымышленных учеников.',
    see: ['Кто отстаёт по каждому навыку', '«Уверенно ошибаются» — что разобрать', 'Группы и план урока на завтра'],
  },
];

export default function SiteCase() {
  const [params, setParams] = useSearchParams();
  const i = Math.min(STEPS.length - 1, Math.max(0, Number(params.get('step') ?? 1) - 1));
  const step = STEPS[i];
  const go = (n: number) => setParams({ step: String(n + 1) }, { replace: true });

  const rows = [
    ['С помощью ИИ', 'ИИ-ответчик с голосом и 3D-собеседником; подсказки по ошибке без готового ответа; задания PISA из фото страницы учебника для учителя.'],
    ['Функциональная грамотность', `${PLAYABLE.length} заданий на чтение (найти, понять, оценить), ${MATH.length} задач по математике из жизни, ${MIXED.length} новых форматов, ${LESSONS.length} уроков, ${TEXTS.length} текстов с озвучкой, бесконечный блиц.`],
    ['7–9 классы', 'Сложность подстраивается под ученика (рейтинг Эло). Отметка уверенности показывает учителю, кто ошибается уверенно.'],
    ['Сельская школа, слабый интернет', 'Приложение ~1 МБ, дальше работает в режиме самолёта. Результаты — QR-кодом. Фото задачи сжимается до 50 КБ.'],
    ['Учитель', 'Карта класса, трудные задания, урок на доске, группы на завтра, отчёты родителям.'],
  ];

  return (
    <section className="app-screen jury" aria-labelledby="jury-h">
      <header className="jury-top">
        <p className="jury-top__label">Órleu Hack 2026 · Кейс 3 «Образование: читать и понимать»</p>
        <h1 id="jury-h" className="jury-top__title">Oqy — тренажёр чтения и математики для 7–9 классов, который работает без интернета</h1>
        <dl className="jury-top__facts">
          <div><dt>36%</dt><dd>15-летних достигают базового уровня чтения (PISA-2025)</dd></div>
          <div><dt>18 баллов</dt><dd>отставание сельских школ по математике (PISA-2022)</dd></div>
          <div><dt>~1 МБ</dt><dd>весь Oqy в телефоне, дальше без сети</dd></div>
        </dl>
      </header>

      <h2 className="jury-h2">Демо за 3 минуты</h2>
      <div className="jury-guide">
        <ol className="jury-guide__list" aria-label="Шаги демо">
          {STEPS.map((s, k) => (
            <li key={s.title}>
              <button type="button" aria-current={k === i ? 'step' : undefined} onClick={() => go(k)} className={`jury-guide__item ${k === i ? 'on' : ''} ${k < i ? 'done' : ''}`}>
                <span className="jury-guide__n">{k < i ? '✓' : k + 1}</span>
                <span className="min-w-0">
                  <b>{s.title}</b>
                  <span>{s.who} · {s.time}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <article className="jury-guide__panel" aria-live="polite">
          <p className="jury-guide__step">Шаг {i + 1} из {STEPS.length} · {step.who} · {step.time}</p>
          <h3 className="jury-guide__title">{step.title}</h3>
          <p className="jury-guide__do"><b>Что сделать:</b> {step.doo}</p>
          <p className="jury-guide__see-h">Что увидите</p>
          <ul className="jury-guide__see">
            {step.see.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <div className="jury-guide__actions">
            <Link to={step.to} className="site-btn jury-btn">{step.btn} →</Link>
            {i < STEPS.length - 1 ? (
              <button type="button" className="site-btn site-btn--ghost" onClick={() => go(i + 1)}>Следующий шаг</button>
            ) : (
              <button type="button" className="site-btn site-btn--ghost" onClick={() => go(0)}>Сначала</button>
            )}
          </div>
        </article>
      </div>

      <h2 className="jury-h2">Как Oqy закрывает условие кейса</h2>
      <table className="jury-table">
        <thead><tr><th scope="col">Требование</th><th scope="col">Что сделано</th></tr></thead>
        <tbody>
          {rows.map(([a, b]) => <tr key={a}><th scope="row">{a}</th><td>{b}</td></tr>)}
        </tbody>
      </table>

      <div className="jury-now">
        <div>
          <h2 className="jury-h2 mt-0!">Работает прямо сейчас</h2>
          <ul className="jury-check">
            <li><b>Проверено в Edge на 2G (250 кбит/с):</b> первый экран за ~6 с, затем 58 файлов (1,1 МБ) сохраняются в телефоне</li>
            <li><b>Сеть выключена полностью:</b> открываются все экраны, задача решается, XP и серия считаются</li>
            <li>Результаты учителю QR-кодом, без сети</li>
            <li>3D-собеседник, голос телефона, встроенные ответы и Википедия</li>
            <li><b>ИИ без интернета на устройстве:</b> Qwen 2.5 через WebGPU, скачивается один раз по Wi-Fi, вопросы никуда не уходят. Проверено в Edge: запуск с диска за 3 с, верные ответы по встроенной справке</li>
            <li><b>Слышит без интернета:</b> если браузер не распознал речь, её распознаёт Whisper прямо на устройстве (75 МБ один раз). Текст сразу появляется в поле ввода</li>
            <li>Казахский текст читается казахским голосом устройства, а без него — по казахской транскрипции («сәлем», а не «слим»)</li>
            <li>Камера и микрофон в Chrome / Edge на телефоне и ПК</li>
            <li>Серия дней, заморозки, уровни, достижения</li>
          </ul>
        </div>
        <div>
          <h2 className="jury-h2 mt-0!">Включается ключом ИИ на сервере</h2>
          <ul className="jury-check jury-check--key">
            <li>Свободный диалог и разбор задачи по фото (Gemini или Claude)</li>
            <li>Живой нейросетевой голос ElevenLabs (eleven_v3 говорит по-казахски), запасной — Gemini</li>
            <li>Распознавание речи на сервере — быстрее, чем на слабом телефоне</li>
          </ul>
          <p className="muted-s mt-3">Код открыт на GitHub. Учитель смотрит пример класса без регистрации.</p>
        </div>
      </div>
    </section>
  );
}

// Карточка «ИИ без интернета»: скачать модель один раз по Wi-Fi — и ответчик отвечает на любой вопрос офлайн.
import { useState } from 'react';
import { chooseModel, deleteModel, loadModel, MODELS, onlyLocal, setOnlyLocal, useLlm, type ModelKey } from './localLlm';
import { track } from './analytics';

export function LocalAiCard() {
  const s = useLlm();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const only = onlyLocal();
  const busy = s.phase === 'downloading' || s.phase === 'loading';
  const has = !!s.cached[s.model];

  async function start() {
    setErr(null);
    track('local_ai_load', { model: s.model, cached: has });
    try {
      await loadModel();
      setOnlyLocal(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const title =
    s.phase === 'ready' ? (only ? 'ИИ без интернета включён' : 'ИИ без интернета готов') : s.phase === 'unsupported' ? 'ИИ без интернета' : has ? 'ИИ без интернета скачан' : 'ИИ без интернета';

  return (
    <section className={`lai ${s.phase === 'ready' ? 'lai--on' : ''}`} aria-labelledby="lai-h">
      <button type="button" className="lai__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="lai__chip" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>
        </span>
        <span className="lai__text">
          <b id="lai-h">{title}</b>
          <small>
            {s.phase === 'ready'
              ? `Модель «${MODELS[s.model].name}» работает на этом устройстве${s.speed ? ` · ${s.speed} токенов в секунду` : ''}`
              : busy
                ? `${s.phase === 'downloading' ? 'Скачиваю' : 'Запускаю'} модель… ${Math.round(s.progress * 100)}%`
                : s.phase === 'unsupported'
                  ? 'Нужен WebGPU: Chrome или Edge на ноутбуке либо новом Android'
                  : 'Отвечает на любой вопрос даже без связи. Скачать один раз по Wi-Fi'}
          </small>
        </span>
        <span className={`lai__dot ${s.phase === 'ready' ? 'on' : ''}`} aria-hidden="true" />
      </button>
      {busy && (
        <span className="progress lai__bar" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Загрузка модели">
          <i style={{ width: `${Math.max(3, s.progress * 100)}%` }} />
        </span>
      )}
      {open && (
        <div className="lai__body">
          <p>
            Языковая модель Qwen 2.5 (лицензия Apache 2.0) работает прямо в браузере, на видеокарте устройства. Вопросы и ответы
            никуда не отправляются. Модель хранится в памяти браузера: в школе без интернета ответчик всё равно отвечает.
          </p>
          <div className="lai__models" role="radiogroup" aria-label="Модель">
            {(Object.keys(MODELS) as ModelKey[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={s.model === k} disabled={busy} onClick={() => chooseModel(k)} className="lai__model">
                <b>{MODELS[k].name}</b>
                <span>{MODELS[k].size}{s.cached[k] ? ' · скачана' : ''}</span>
                <small>{MODELS[k].note}</small>
              </button>
            ))}
          </div>
          <div className="lai__actions">
            {s.phase !== 'ready' && (
              <button type="button" className="site-btn site-btn--ai site-btn--sm" disabled={busy || s.phase === 'unsupported'} onClick={start}>
                {busy ? 'Подожди…' : has ? 'Включить' : `Скачать ${MODELS[s.model].size}`}
              </button>
            )}
            {s.phase === 'ready' && (
              <label className="lai__switch">
                <input type="checkbox" checked={only} onChange={(e) => setOnlyLocal(e.target.checked)} />
                Отвечать только локальным ИИ, даже когда есть интернет
              </label>
            )}
            {has && !busy && (
              <button type="button" className="link-btn text-sm" onClick={deleteModel}>Удалить модель</button>
            )}
          </div>
          {(err || (s.phase === 'error' && s.note)) && <p className="note note--warn">{err ?? s.note}</p>}
        </div>
      )}
    </section>
  );
}

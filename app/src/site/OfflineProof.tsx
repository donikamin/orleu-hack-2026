// «Проверка офлайна»: настоящие цифры с этого устройства, а не обещание.
// Что сохранено в телефоне (Cache API), сколько скачала эта сессия (Resource Timing), какая сеть сейчас.
import { useEffect, useState } from 'react';

interface Proof {
  sw: 'on' | 'dev' | 'off';
  files: number;
  bytes: number;
  session: number;
  net: string;
}

const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(b / 1024))} КБ`);

async function measure(): Promise<Proof> {
  const sw = navigator.serviceWorker?.controller ? 'on' : import.meta.env.DEV ? 'dev' : 'off';
  let files = 0;
  let bytes = 0;
  try {
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const req of await c.keys()) {
        const res = await c.match(req);
        if (!res) continue;
        files++;
        const len = Number(res.headers.get('content-length'));
        bytes += len > 0 ? len : (await res.clone().blob()).size;
      }
    }
  } catch {
    /* Cache API недоступен */
  }
  const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')] as PerformanceResourceTiming[];
  const session = entries.reduce((s, e) => s + (e.transferSize || 0), 0);
  const c = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;
  const net = !navigator.onLine ? 'нет сети' : c?.effectiveType ? `${c.effectiveType.toUpperCase()}${c.downlink ? ` · ~${c.downlink} Мбит/с` : ''}` : 'онлайн';
  return { sw, files, bytes, session, net };
}

export function OfflineProof() {
  const [p, setP] = useState<Proof | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    void measure().then(setP);
    const on = () => {
      setOnline(navigator.onLine);
      void measure().then(setP);
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  const twoG = p ? Math.round((p.bytes * 8) / 50_000) : 0; // 2G ≈ 50 кбит/с

  return (
    <section className="proof" aria-labelledby="proof-h">
      <div className="proof__head">
        <h2 id="proof-h">Проверка офлайна на этом устройстве</h2>
        <span className={`proof__badge ${online ? '' : 'off'}`} role="status">{online ? 'Сеть есть' : 'Сети нет — и всё работает'}</span>
      </div>
      {p ? (
        <dl className="proof__grid">
          <div>
            <dt>Режим без сети</dt>
            <dd className={p.sw === 'on' ? 'ok' : ''}>{p.sw === 'on' ? '✓ включён' : p.sw === 'dev' ? 'в версии разработки выключен' : 'включится после первой загрузки'}</dd>
          </div>
          <div>
            <dt>Сохранено в телефоне</dt>
            <dd>{p.files ? `${p.files} файлов · ${kb(p.bytes)}` : '—'}</dd>
          </div>
          <div>
            <dt>Скачала эта сессия</dt>
            <dd>{kb(p.session)}</dd>
          </div>
          <div>
            <dt>Сеть сейчас</dt>
            <dd>{p.net}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted-s">Считаю…</p>
      )}
      <p className="proof__how">
        <b>Проверьте сами:</b> включите режим самолёта и обновите страницу — Oqy откроется, задания, подсказки, блиц и QR работают.
        {p && p.bytes > 0 && <> Первая загрузка на 2G заняла бы около {Math.max(1, Math.round(twoG / 60))} мин, дальше — 0 КБ.</>}
      </p>
    </section>
  );
}

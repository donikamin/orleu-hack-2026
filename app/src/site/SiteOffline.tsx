// «2G и QR»: сколько весит Oqy и сколько грузится на 2G; ваши результаты → QR → кабинет учителя.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import { attemptToRow, decodeResults, encodeResults } from '@shared/qr-protocol';
import { PACK } from '../teacher/pack';
import { saveAttempts } from '../teacher/db';
import { DEMO_CODE, seedDemoClass } from '../teacher/demo';
import { useOnline } from '../teacher/hooks';
import { MATH } from './content/math';
import { TEXTS } from './content/texts';
import { useProgress } from './progress';
import { OfflineProof } from './OfflineProof';

const NETS = [
  { id: '2g', label: '2G (EDGE)', kbps: 100 },
  { id: '3g', label: '3G', kbps: 1500 },
  { id: '4g', label: '4G', kbps: 15000 },
];

// Замер production-сборки (vite build, все JS/CSS/HTML приложения в gzip), 26.11.2026
const BUILD_GZIP_BYTES = 247 * 1024;

function kb(bytes: number) {
  return `${Math.round(bytes / 1024)} КБ`;
}

export default function SiteOffline() {
  const online = useOnline();
  const progress = useProgress();
  const navigate = useNavigate();
  const [net, setNet] = useState('2g');
  const [run, setRun] = useState(0);
  const [appBytes, setAppBytes] = useState(0);
  const [number, setNumber] = useState(13);
  const [qrs, setQrs] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const [contentBytes, setContentBytes] = useState(0);

  // Вес заданий и текстов — честно сжатый gzip, как его передаёт сервер
  useEffect(() => {
    const raw = new Blob([JSON.stringify(PACK), JSON.stringify(MATH), JSON.stringify(TEXTS)]);
    if (typeof CompressionStream === 'undefined') return setContentBytes(raw.size);
    new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob().then((b) => setContentBytes(b.size));
  }, []);

  // Вес приложения: в сборке — реально скачанные JS и CSS (сжатые); в режиме разработки — замер сборки (247 КБ gzip)
  useEffect(() => {
    if (import.meta.env.DEV) return setAppBytes(BUILD_GZIP_BYTES);
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const own = entries.filter((e) => e.name.startsWith(location.origin) && /\.(js|css)(\?|$)/.test(e.name));
    const sum = own.reduce((s, e) => s + (e.encodedBodySize || e.transferSize || 0), 0);
    setAppBytes(sum > 20000 ? sum : BUILD_GZIP_BYTES);
  }, []);

  const total = appBytes + contentBytes;
  const speed = NETS.find((n) => n.id === net)!;
  const seconds = (total * 8) / (speed.kbps * 1000);

  // Ваши результаты по заданиям базы → строки QR (индекс задания в pack-v1)
  const index = useMemo(() => new Map(PACK.map((t, i) => [t.id, i])), []);
  const rows = useMemo(() => progress.filter((a) => a.kind === 'reading' && index.has(a.taskId)).map((a) => attemptToRow(a, index.get(a.taskId)!)), [progress, index]);
  const parts = useMemo(() => (rows.length ? encodeResults(DEMO_CODE, number, rows) : []), [rows, number]);

  useEffect(() => {
    Promise.all(parts.map((p) => QRCode.toDataURL(p, { margin: 1, width: 360, errorCorrectionLevel: 'M' }))).then(setQrs);
    setIdx(0);
  }, [parts]);
  useEffect(() => {
    if (parts.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % parts.length), 1500);
    return () => clearInterval(t);
  }, [parts.length]);

  async function teacherScans() {
    setBusy(true);
    await seedDemoClass();
    for (const p of parts) {
      const d = decodeResults(p); // ровно то, что сделает камера учителя
      const attempts = d.rows.map((r) => ({ taskId: PACK[r[0] as number].id, score: (r[1] / 2) as 0 | 0.5 | 1, hintsUsed: r[2], ...(r[3] ? { confidence: r[3] as 1 | 2 | 3 } : {}), ts: r[4] * 60 }));
      await saveAttempts(d.classCode, d.number, attempts, 'qr');
    }
    navigate(`/teacher/${DEMO_CODE}/student/${number}`);
  }

  return (
    <section className="site-screen" aria-labelledby="off-h">
      <p className="site-kicker">2G и QR</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <h1 id="off-h" className="display text-[clamp(44px,5.2vw,84px)]">
          Интернет —
          <br />
          один раз.
        </h1>
        <span className={`px-3 py-1.5 font-['Oswald'] text-sm font-semibold uppercase tracking-wider ${online ? 'bg-[var(--s-soft)]' : 'bg-[var(--s-mint)] text-[#0a0a0a]'}`} role="status">
          {online ? 'Сейчас онлайн. Выключите Wi-Fi — всё продолжит работать' : 'Офлайн: вы читаете это без интернета'}
        </span>
      </div>

      <OfflineProof />

      <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <h2 className="text-xl font-semibold">Сколько весит Oqy</h2>
          <dl className="grid grid-cols-3 gap-4 border-y border-[var(--s-line)] py-5">
            <div><dt className="text-sm text-[var(--s-muted)]">Приложение</dt><dd className="display text-4xl">{kb(appBytes)}</dd></div>
            <div><dt className="text-sm text-[var(--s-muted)]">Все задания и тексты</dt><dd className="display text-4xl">{kb(contentBytes)}</dd></div>
            <div><dt className="text-sm text-[var(--s-muted)]">После загрузки</dt><dd className="display text-4xl">0 КБ</dd></div>
          </dl>
          <div role="group" aria-label="Скорость сети" className="flex gap-1">
            {NETS.map((n) => (
              <button key={n.id} type="button" aria-pressed={net === n.id} onClick={() => { setNet(n.id); setRun((r) => r + 1); }} className={`min-h-11 flex-1 font-['Oswald'] font-semibold uppercase tracking-wider ${net === n.id ? 'bg-[var(--s-ink)] text-[var(--s-bg)]' : 'bg-[var(--s-soft)]'}`}>
                {n.label}
              </button>
            ))}
          </div>
          <div>
            <div className="h-4 bg-[var(--s-soft)]">
              <div key={`${net}-${run}`} className="h-full bg-[var(--s-ink)]" style={{ animation: `bar ${Math.min(seconds, 12)}s linear both`, transformOrigin: 'left' }} />
            </div>
            <p className="mt-2 text-lg">
              Первая загрузка на {speed.label}: <b>≈ {seconds < 1 ? 'меньше секунды' : `${Math.round(seconds)} с`}</b>. Дальше задания, проверка и подсказки работают в режиме самолёта.
            </p>
          </div>
          <p className="text-[var(--s-muted)]">Для сравнения: одна фотография с телефона весит 3–5 МБ — больше, чем всё приложение.</p>
        </div>

        <div className="grid content-start gap-5 border-l-0 border-[var(--s-line)] lg:border-l lg:pl-8">
          <h2 className="text-xl font-semibold">Ваши результаты → учителю, без сети</h2>
          {rows.length === 0 ? (
            <div className="grid gap-4 bg-[var(--s-soft)] p-6">
              <p>Решите хотя бы одно задание в тренажёре — и здесь появится QR-код с вашими результатами.</p>
              <button type="button" onClick={() => navigate('/train')} className="site-btn site-btn--solid justify-self-start">Решить задание →</button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-6">
                {qrs[idx] && <img src={qrs[idx]} alt={`QR-код с вашими результатами, часть ${idx + 1} из ${parts.length}`} width={360} height={360} className="h-auto w-48 border border-[var(--s-line)] bg-white p-2" />}
                <div className="grid gap-2">
                  <p><b>{rows.length}</b> решённых заданий в коде</p>
                  <p className="text-sm text-[var(--s-muted)]">{parts.length > 1 ? `${parts.length} части, листаются сами` : '1 код'} · {parts[idx]?.length} байт</p>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    Мой номер в классе
                    <input name="number" type="number" inputMode="numeric" min={1} max={40} value={number} onChange={(e) => setNumber(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="min-h-11 w-20 border border-[var(--s-line)] bg-[var(--s-bg)] px-2" />
                  </label>
                </div>
              </div>
              <button type="button" onClick={teacherScans} disabled={busy} className="site-btn site-btn--accent justify-self-start">
                {busy ? 'Сканирую…' : 'Учитель сканирует → открыть кабинет'}
              </button>
              <p className="text-sm text-[var(--s-muted)]">На уроке учитель наводит камеру телефона. Здесь мы прочитаем этот же код на вашем устройстве и покажем, что увидит учитель в примере класса.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { db, getAttempts, type StudentAttempt, type StudentRow } from '../lib/db';
import { attemptsToQr } from '../lib/qr';
import { Button, ButtonLink, Card, EmptyState, inputClass, Notice, PageHeader } from '../ui';

export default function GivePage({ me }: { me: StudentRow }) {
  const all = useLiveQuery(() => getAttempts(me.key), [me.key]);
  const [list, setList] = useState<StudentAttempt[] | null>(null); // снимок: отмечаем ровно то, что показали
  const [done, setDone] = useState(0);
  if (!all) return null;
  const fresh = all.filter((a) => !a.exported);

  if (list)
    return (
      <QrScreen
        me={me}
        list={list}
        onClose={() => setList(null)}
        onScanned={async () => {
          await db.attempts.where('id').anyOf(list.map((a) => a.id)).modify({ exported: 1 });
          setDone(list.length);
          setList(null);
        }}
      />
    );

  return (
    <>
      <PageHeader title="Отдать учителю" subtitle="Учитель сканирует QR-код с твоего экрана. Интернет не нужен." back="/student" />
      {done > 0 && <div className="mb-4"><Notice tone="brand">Отмечено как переданное: {done}</Notice></div>}
      {all.length === 0 ? (
        <EmptyState title="Пока нечего отдавать">Реши хотя бы одно задание. <ButtonLink variant="ghost" to="/student">К заданиям</ButtonLink></EmptyState>
      ) : (
        <Card className="grid gap-3">
          <p>Новых результатов: <b>{fresh.length}</b>, всего: <b>{all.length}</b></p>
          <Button onClick={() => setList(fresh)} disabled={!fresh.length}>Показать QR с новыми</Button>
          <Button variant="secondary" onClick={() => setList(all)}>Показать все результаты</Button>
          <p className="text-sm text-muted">Если учитель уже получил результат, повторный скан его не задвоит.</p>
        </Card>
      )}
    </>
  );
}

function QrScreen({ me, list, onClose, onScanned }: { me: StudentRow; list: StudentAttempt[]; onClose: () => void; onScanned: () => Promise<void> }) {
  const navigate = useNavigate();
  const [parts] = useState(() => attemptsToQr(me, list));
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  const [showText, setShowText] = useState(false);
  const n = parts.length;

  useEffect(() => {
    Promise.all(parts.map((p) => QRCode.toDataURL(p, { errorCorrectionLevel: 'M', margin: 3, width: 900 }))).then(setImages, () => setError(true));
  }, [parts]);

  useEffect(() => {
    if (!auto || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 1500);
    return () => clearInterval(t);
  }, [auto, n]);

  // экран не гаснет, пока учитель сканирует
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let closed = false;
    const get = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock?.request('screen').then((l) => (closed ? void l.release() : (lock = l)), () => {});
    };
    get();
    document.addEventListener('visibilitychange', get);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', get);
      void lock?.release();
    };
  }, []);

  const go = (d: number) => {
    setAuto(false);
    setI((x) => (x + d + n) % n);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="QR-код для учителя">
      <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-3 p-3 text-center">
        <p className="text-sm font-semibold">Класс {me.classCode} · № {me.number} · результатов: {list.length}</p>
        {error ? <Notice tone="danger">Не получилось нарисовать QR. Покажи учителю текст кода ниже.</Notice> : images[i] && <img src={images[i]} alt={`QR-код, часть ${i + 1} из ${n}`} className="w-full max-w-[min(100%,68dvh)]" />}
        <p className="text-sm text-muted">Сделай экран ярче и держи телефон ровно.</p>
        {n > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" aria-label="Предыдущая часть" onClick={() => go(-1)}>←</Button>
            <span className="min-w-28 font-bold">Часть {i + 1} из {n}</span>
            <Button variant="secondary" aria-label="Следующая часть" onClick={() => go(1)}>→</Button>
            <Button variant="ghost" onClick={() => setAuto((v) => !v)}>{auto ? 'Пауза' : 'Листать'}</Button>
          </div>
        )}
        <div className="grid w-full max-w-sm gap-2">
          <Button onClick={onScanned}>Учитель отсканировал</Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="ghost" onClick={onClose}>Закрыть</Button>
            <Button variant="ghost" onClick={() => setShowText((v) => !v)}>Текст</Button>
            <Button variant="ghost" onClick={() => navigate('/student')}>Домой</Button>
          </div>
        </div>
        {showText && <textarea readOnly aria-label="Текст кода" className={`${inputClass} min-h-32 font-mono text-xs`} value={parts.join('\n')} onFocus={(e) => e.target.select()} />}
      </div>
    </div>
  );
}

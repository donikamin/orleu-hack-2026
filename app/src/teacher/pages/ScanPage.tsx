import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { decodeResults, rowToAttempt, QrDecodeError, type DecodedPart } from '@shared/qr-protocol';
import type { Attempt } from '@shared/types';
import { saveAttempts } from '../db';
import { resolveTaskRef } from '../pack';
import { useClass } from '../hooks';
import { Button, Card, Field, inputClass, Notice } from '../../ui';

interface Progress {
  number: number;
  total: number;
  parts: Set<number>;
  added: number;
}

type Msg = { tone: 'brand' | 'danger' | 'neutral'; text: string };

export default function ScanPage() {
  const { cls, lookup } = useClass();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const lastTextRef = useRef<string>('');
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [progress, setProgress] = useState<Map<number, Progress>>(new Map());
  const [msg, setMsg] = useState<Msg | null>(null);
  const [manual, setManual] = useState('');

  async function handleText(text: string) {
    if (text === lastTextRef.current) return; // тот же кадр, уже обработан
    lastTextRef.current = text;
    let part: DecodedPart;
    try {
      part = decodeResults(text);
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof QrDecodeError ? e.message : 'Не удалось прочитать код' });
      return;
    }
    if (part.classCode !== cls.code) {
      setMsg({ tone: 'danger', text: `Это QR другого класса (${part.classCode}). Попросите ученика проверить код класса.` });
      return;
    }
    const attempts: Attempt[] = [];
    let unknown = 0;
    for (const row of part.rows) {
      const a = rowToAttempt(row, (ref) => {
        const id = resolveTaskRef(ref);
        return id && lookup.get(id) ? id : undefined;
      });
      if (a) attempts.push(a);
      else unknown++;
    }
    const added = await saveAttempts(cls.code, part.number, attempts, 'qr');
    setProgress((prev) => {
      const next = new Map(prev);
      const p = next.get(part.number) ?? { number: part.number, total: part.total, parts: new Set<number>(), added: 0 };
      p.parts = new Set(p.parts).add(part.part);
      p.total = part.total;
      p.added += added;
      next.set(part.number, p);
      return next;
    });
    if ('vibrate' in navigator) navigator.vibrate?.(60);
    setMsg({
      tone: 'brand',
      text:
        `Ученик № ${part.number}: часть ${part.part} из ${part.total}, новых попыток ${added}` +
        (unknown ? `, неизвестных заданий ${unknown}` : '') +
        (part.total > 1 ? '. Держите камеру: остальные части прочитаются сами.' : '.'),
    });
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setCamera('starting');
    try {
      const scanner = new QrScanner(videoRef.current, (r) => void handleText(r.data), {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 8,
      });
      scannerRef.current = scanner;
      await scanner.start();
      setCamera('on');
    } catch {
      setCamera('error');
    }
  }

  function stopCamera() {
    scannerRef.current?.stop();
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamera('off');
  }

  useEffect(() => () => stopCamera(), []); // выключить камеру при уходе со страницы

  async function scanFile(file: File) {
    try {
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      lastTextRef.current = '';
      await handleText(r.data);
    } catch {
      setMsg({ tone: 'danger', text: 'На фото не найден QR-код. Снимите ближе и ровнее.' });
    }
  }

  async function submitManual() {
    const lines = manual.split(/\s+/).filter((l) => l.startsWith('OQ1|'));
    if (!lines.length) {
      setMsg({ tone: 'danger', text: 'Вставьте текст кода, он начинается с OQ1|' });
      return;
    }
    for (const l of lines) {
      lastTextRef.current = '';
      await handleText(l);
    }
    setManual('');
  }

  const list = [...progress.values()].sort((a, b) => a.number - b.number);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <h2 className="text-lg font-bold">Камера</h2>
        <p className="mt-1 text-sm text-muted">Наведите на QR-код в телефоне ученика. Интернет не нужен. Если частей несколько, они листаются сами.</p>
        <div className="relative mt-4 aspect-square w-full max-w-md overflow-hidden rounded-xl bg-ink/90 sm:aspect-video">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {camera !== 'on' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              {camera === 'error' ? (
                <p>Камера недоступна. Разрешите доступ к камере или загрузите фото QR-кода ниже.</p>
              ) : (
                <p>Камера выключена</p>
              )}
              <Button onClick={startCamera} disabled={camera === 'starting'}>
                {camera === 'starting' ? 'Включаю…' : 'Включить камеру'}
              </Button>
            </div>
          )}
        </div>
        {camera === 'on' && (
          <Button variant="secondary" className="mt-3" onClick={stopCamera}>
            Выключить камеру
          </Button>
        )}
        <div className="mt-4" aria-live="polite">
          {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        </div>

        <details className="mt-6">
          <summary className="cursor-pointer font-semibold text-brand">Камера не читает? Другие способы</summary>
          <div className="mt-4 grid gap-4">
            <Field label="Фото QR-кода" hint="Ученик может прислать скриншот, или сфотографируйте экран.">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-brand-soft file:px-4 file:font-semibold file:text-brand"
                onChange={(e) => e.target.files?.[0] && scanFile(e.target.files[0])}
              />
            </Field>
            <Field label="Текст кода" hint="Если ученик скопировал код (начинается с OQ1|). Можно несколько через пробел.">
              <textarea name="qrText" autoComplete="off" spellCheck={false} placeholder="OQ1|DEMO|13|1/1|…" className={`${inputClass} min-h-24 font-mono text-xs`} value={manual} onChange={(e) => setManual(e.target.value)} />
            </Field>
            <Button variant="secondary" onClick={submitManual} disabled={!manual.trim()}>
              Загрузить текст
            </Button>
          </div>
        </details>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Принято за этот сеанс</h2>
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Пока ничего. После скана здесь появятся ученики.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {list.map((p) => {
              const complete = p.parts.size >= p.total;
              return (
                <li key={p.number} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="font-semibold">Ученик № {p.number}</span>
                  <span className={`text-sm ${complete ? 'text-brand' : 'text-accent'}`}>
                    {complete ? '✓ ' : ''}
                    части {p.parts.size}/{p.total} · +{p.added}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">Повторный скан не создаёт дублей: каждая попытка сохраняется один раз.</p>
      </Card>
    </div>
  );
}

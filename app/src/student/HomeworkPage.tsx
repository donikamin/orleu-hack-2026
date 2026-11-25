// Задание от учителя: QR (OQA|…) с экрана, фото или текст из чата.
import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { decodeAssignment, QrDecodeError } from '@shared/qr-protocol';
import type { Task } from '@shared/types';
import { db, type StudentRow } from '../lib/db';
import { Button, ButtonLink, Card, Field, inputClass, Notice, PageHeader } from '../ui';

type Msg = { tone: 'brand' | 'danger'; text: string };

export default function HomeworkPage({ me, tasks }: { me: StudentRow; tasks: Task[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on'>('off');
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);

  function stop() {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setCamera('off');
  }
  useEffect(() => () => scannerRef.current?.destroy(), []);

  async function accept(text: string) {
    try {
      const { classCode, taskIds } = decodeAssignment(text);
      if (classCode !== me.classCode) throw new QrDecodeError(`Это задание для класса ${classCode}, а у тебя ${me.classCode}.`);
      const known = new Set(tasks.map((t) => t.id));
      const ids = [...new Set(taskIds)].filter((id) => known.has(id));
      const missing = new Set(taskIds).size - ids.length;
      if (!ids.length) throw new QrDecodeError('Этих заданий нет в телефоне. Подключись к интернету, чтобы обновить базу, или попроси учителя распечатать их.');
      await db.students.update(me.key, { assigned: { ids, at: Math.floor(Date.now() / 1000) } });
      stop();
      setMsg({ tone: 'brand', text: `Получено заданий: ${ids.length}.` + (missing ? ` Ещё ${missing} нет в телефоне: подключись к интернету и отсканируй снова.` : '') });
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof QrDecodeError ? e.message : 'Не удалось прочитать код' });
    }
  }

  async function start() {
    if (!videoRef.current) return;
    setCamera('starting');
    const s = new QrScanner(videoRef.current, (r) => void accept(r.data), { preferredCamera: 'environment', highlightScanRegion: true, maxScansPerSecond: 4 });
    scannerRef.current = s;
    try {
      await s.start();
      if (scannerRef.current === s) setCamera('on');
    } catch {
      stop();
      setMsg({ tone: 'danger', text: 'Камера недоступна. Загрузи фото кода или вставь текст.' });
    }
  }

  async function scanFile(file: File) {
    try {
      await accept((await QrScanner.scanImage(file, { returnDetailedScanResult: true })).data);
    } catch {
      setMsg({ tone: 'danger', text: 'На фото не найден QR-код. Сними ближе и ровнее.' });
    }
  }

  return (
    <>
      <PageHeader title="Получить задание" subtitle="Наведи камеру на QR-код учителя. Интернет не нужен." back="/student" />
      <Card className="grid gap-4">
        <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
        {msg?.tone === 'brand' && <ButtonLink to="/student/play/homework">Начать задание</ButtonLink>}
        <video ref={videoRef} muted playsInline className={camera === 'off' ? 'hidden' : 'aspect-square w-full rounded-xl bg-ink object-cover'} />
        <Button variant={camera === 'off' ? 'primary' : 'secondary'} onClick={camera === 'off' ? start : stop}>{camera === 'off' ? 'Включить камеру' : 'Выключить камеру'}</Button>
        <Field label="Или фото QR-кода">
          <input type="file" accept="image/*" className="block w-full text-sm" onChange={(e) => e.target.files?.[0] && scanFile(e.target.files[0])} />
        </Field>
        <Field label="Или текст из чата" hint="Начинается с OQA|">
          <input className={`${inputClass} font-mono`} value={manual} onChange={(e) => setManual(e.target.value)} />
        </Field>
        <Button variant="secondary" disabled={!manual.trim()} onClick={() => accept(manual)}>Загрузить</Button>
      </Card>
    </>
  );
}

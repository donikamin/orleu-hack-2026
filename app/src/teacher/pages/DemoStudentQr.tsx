// Тестовый ученик: генерирует QR с результатами по протоколу, чтобы проверить сканер учителя до готовности части A.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { attemptToRow, encodeResults } from '@shared/qr-protocol';
import { demoAttemptsFor } from '../demo';
import { PACK } from '../pack';
import { Badge, Button, Card, Field, inputClass, PageHeader } from '../../ui';

export default function DemoStudentQr() {
  const [classCode, setClassCode] = useState('DEMO');
  const [number, setNumber] = useState(13);
  const [seed, setSeed] = useState(1);
  const [parts, setParts] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const index = new Map(PACK.map((t, i) => [t.id, i]));
    const rows = demoAttemptsFor(number, seed * 1000 + number).map((a) => attemptToRow(a, index.get(a.taskId)!));
    const p = encodeResults(classCode.trim().toUpperCase() || 'DEMO', number, rows);
    setParts(p);
    setIdx(0);
    Promise.all(p.map((t) => QRCode.toDataURL(t, { errorCorrectionLevel: 'M', margin: 2, width: 520 }))).then(setImages);
  }, [classCode, number, seed]);

  useEffect(() => {
    if (parts.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % parts.length), 1500);
    return () => clearInterval(t);
  }, [parts.length]);

  return (
    <>
      <PageHeader
        title="Тестовый ученик"
        subtitle="Генерирует QR-код с выдуманными результатами по протоколу из плана. Нужен, чтобы проверить сканер учителя, пока приложение ученика (часть A) в работе."
        back="/teacher"
      />
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <Card className="space-y-4">
          <Field label="Код класса">
            <input className={`${inputClass} font-mono uppercase`} value={classCode} onChange={(e) => setClassCode(e.target.value)} />
          </Field>
          <Field label="Номер ученика">
            <input className={inputClass} type="number" min={1} max={40} value={number} onChange={(e) => setNumber(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Button variant="secondary" onClick={() => setSeed((s) => s + 1)}>
            Другие результаты
          </Button>
          <p className="text-sm text-muted">Откройте сканер на другом устройстве (или загрузите скриншот QR в сканер).</p>
        </Card>
        <Card className="text-center">
          {images[idx] && <img src={images[idx]} alt={`QR-код, часть ${idx + 1} из ${parts.length}`} className="mx-auto w-full max-w-sm" />}
          <p className="mt-3 flex items-center justify-center gap-2">
            <Badge tone="brand">
              часть {idx + 1} из {parts.length}
            </Badge>
            <span className="text-sm text-muted">{parts[idx]?.length} байт</span>
          </p>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Текст кода (для ручного ввода)</summary>
            <textarea readOnly className={`${inputClass} mt-2 min-h-32 font-mono text-xs`} value={parts.join('\n')} />
          </details>
        </Card>
      </div>
    </>
  );
}

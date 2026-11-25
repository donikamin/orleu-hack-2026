// «Класс и данные»: плакат с кодом класса, карточки с номерами, экспорт в Excel, резервная копия без интернета.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { level } from '@shared/elo';
import { SKILLS, SKILL_LABEL } from '@shared/types';
import { encodeAssignment } from '@shared/qr-protocol';
import { db, type AttemptRow, type ClassRow, type ClassTask } from '../db';
import { download, formatDate, toCsv } from '../analytics';
import { useClass } from '../hooks';
import { Button, Card, Notice } from '../../ui';

interface Backup {
  app: 'oqy';
  version: 1;
  exportedAt: string;
  cls: ClassRow;
  attempts: AttemptRow[];
  tasks: ClassTask[];
}

export default function DataPage() {
  const { cls, students, attempts, classTasks, lookup } = useClass();
  const [qr, setQr] = useState<string>('');
  const [msg, setMsg] = useState<{ tone: 'brand' | 'danger'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Пустое задание = «вступить в класс»: приложение ученика запоминает код класса.
    QRCode.toDataURL(encodeAssignment(cls.code, []), { margin: 1, width: 480, errorCorrectionLevel: 'M' }).then(setQr);
  }, [cls.code]);

  function exportSummary() {
    const rows: (string | number)[][] = [['Номер', ...SKILLS.flatMap((s) => [`${SKILL_LABEL[s]}: уровень`, `${SKILL_LABEL[s]}: заданий`]), 'Всего заданий', 'Уверенно ошибся', 'Последний раз']];
    for (const s of students)
      rows.push([
        s.number,
        ...s.skills.flatMap((k) => [k.attempts ? level(k.rating) : '', k.attempts]),
        s.attempts,
        s.confidentWrong,
        s.lastTs ? formatDate(s.lastTs) : '',
      ]);
    download(`oqy-${cls.code}-итоги.csv`, toCsv(rows));
  }

  function exportAttempts() {
    const rows: (string | number)[][] = [['Номер', 'Задание', 'Навык', 'Сложность', 'Результат', 'Подсказок', 'Уверенность', 'Когда', 'Источник']];
    for (const a of [...attempts].sort((x, y) => x.number - y.number || x.ts - y.ts)) {
      const t = lookup.get(a.taskId);
      rows.push([a.number, t?.title ?? a.taskId, t ? SKILL_LABEL[t.skill] : '', t?.difficulty ?? '', a.score, a.hintsUsed, a.confidence ?? '', formatDate(a.ts), a.via]);
    }
    download(`oqy-${cls.code}-попытки.csv`, toCsv(rows));
  }

  function exportBackup() {
    const b: Backup = { app: 'oqy', version: 1, exportedAt: new Date().toISOString(), cls, attempts, tasks: classTasks };
    download(`oqy-${cls.code}-копия.json`, JSON.stringify(b), 'application/json');
    setMsg({ tone: 'brand', text: 'Файл копии сохранён. Его можно перенести на другое устройство через флешку, Bluetooth или мессенджер.' });
  }

  async function importBackup(file: File) {
    try {
      const b = JSON.parse(await file.text()) as Backup;
      if (b.app !== 'oqy' || b.version !== 1 || !b.cls?.code) throw new Error('bad');
      const existing = await db.attempts.bulkGet(b.attempts.map((a) => a.key));
      const fresh = b.attempts.filter((_, i) => !existing[i]);
      await db.transaction('rw', db.classes, db.attempts, db.tasks, async () => {
        if (!(await db.classes.get(b.cls.code))) await db.classes.put(b.cls);
        if (fresh.length) await db.attempts.bulkAdd(fresh);
        if (b.tasks?.length) await db.tasks.bulkPut(b.tasks);
      });
      setMsg({ tone: 'brand', text: `Загружено: класс ${b.cls.code}, новых попыток ${fresh.length}. Дубли пропущены.` });
    } catch {
      setMsg({ tone: 'danger', text: 'Это не файл копии Oqy или он повреждён.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const numbers = Array.from({ length: cls.size }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-rise">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="no-print grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-lg font-bold">Плакат и карточки</h2>
          <p className="mt-1 text-sm text-muted">Плакат с кодом класса — на стену. Карточки с номерами — разрезать и раздать: ученик вводит код и свой номер.</p>
          <Button className="mt-4 w-full" onClick={() => window.print()}>Распечатать плакат и карточки</Button>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Экспорт в Excel</h2>
          <p className="mt-1 text-sm text-muted">Для завуча, отчёта или журнала. Файл открывается в Excel и Google Таблицах.</p>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={exportSummary}>Итоги по ученикам</Button>
            <Button variant="secondary" onClick={exportAttempts} disabled={!attempts.length}>Все попытки ({attempts.length})</Button>
          </div>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Резервная копия</h2>
          <p className="mt-1 text-sm text-muted">Данные хранятся на этом устройстве. Копия переносит класс на другой телефон или компьютер без интернета.</p>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={exportBackup}>Сохранить копию</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>Загрузить копию…</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Файл копии" tabIndex={-1} onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          </div>
        </Card>
      </div>

      {/* Печатный лист: плакат + карточки. На экране — предпросмотр. */}
      <section aria-label="Плакат класса" className="print-page rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center print:border-0">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">Oqy · читай и понимай</p>
        <h2 className="mt-2 text-3xl font-extrabold">{cls.name}</h2>
        <p className="mt-6 text-muted">Код класса</p>
        <p translate="no" className="font-mono text-6xl font-medium tracking-[0.2em]">{cls.code}</p>
        {qr && <img src={qr} alt={`QR-код для входа в класс ${cls.code}`} width={480} height={480} className="mx-auto mt-6 h-auto w-56 rounded-lg" />}
        <ol className="mx-auto mt-6 max-w-md list-decimal space-y-1 pl-5 text-left">
          <li>Откройте Oqy на телефоне. Интернет нужен только в первый раз.</li>
          <li>Отсканируйте этот QR или введите код класса.</li>
          <li>Выберите свой номер с карточки.</li>
        </ol>
      </section>
      <section aria-label="Карточки с номерами" className="grid grid-cols-2 gap-0 sm:grid-cols-4 print:grid-cols-4">
        {numbers.map((n) => (
          <div key={n} className="border border-dashed border-line p-4 text-center">
            <p className="text-xs text-muted">Код класса</p>
            <p className="font-mono text-lg font-medium tracking-widest">{cls.code}</p>
            <p className="mt-1 text-xs text-muted">Мой номер</p>
            <p className="text-3xl font-extrabold tabular-nums">{n}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, makeClassCode, randomToken, type ClassRow } from '../db';
import { createClassOnServer } from '../api';
import { seedDemoClass } from '../demo';
import { Badge, Button, Card, EmptyState, Field, inputClass, PageHeader } from '../../ui';

export default function TeacherHome() {
  const classes = useLiveQuery(() => db.classes.orderBy('createdAt').reverse().toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db.attempts.toArray();
    const m = new Map<string, number>();
    for (const a of all) m.set(a.classCode, (m.get(a.classCode) ?? 0) + 1);
    return m;
  }, []);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<7 | 8 | 9>(8);
  const [size, setSize] = useState(25);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    let code = makeClassCode(grade);
    let teacherKey = randomToken(16);
    let synced = false;
    try {
      const r = await createClassOnServer(name.trim());
      code = r.classCode;
      teacherKey = r.teacherKey;
      synced = true;
    } catch {
      // Без сервера класс создаётся локально, это нормальный офлайн-режим.
    }
    const row: ClassRow = { code, name: name.trim(), grade, size, teacherKey, createdAt: Date.now(), synced };
    await db.classes.put(row);
    setBusy(false);
    navigate(`/teacher/${code}`);
  }

  async function createDemo() {
    navigate(`/teacher/${await seedDemoClass()}`);
  }

  return (
    <>
      <PageHeader title="Панель учителя" subtitle="Классы хранятся на этом устройстве и работают без интернета." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="classes-h">
          <h2 id="classes-h" className="mb-3 text-lg font-bold">
            Мои классы
          </h2>
          {classes && classes.length === 0 && (
            <EmptyState title="Пока нет классов">
              Создайте класс справа или откройте демо-класс, чтобы посмотреть, как выглядит карта навыков.
              <div className="mt-4">
                <Button variant="secondary" onClick={createDemo}>
                  Открыть демо-класс
                </Button>
              </div>
            </EmptyState>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {classes?.map((c) => (
              <li key={c.code}>
                <Link to={`/teacher/${c.code}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 hover:border-brand">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-lg font-bold">{c.name}</p>
                    {!c.synced && <Badge tone="accent">только на устройстве</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {c.grade} класс · {c.size} учеников · {counts?.get(c.code) ?? 0} попыток
                  </p>
                  <p className="mt-3 font-mono text-sm">
                    Код класса: <span className="font-bold">{c.code}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {classes && classes.length > 0 && (
            <Button variant="ghost" className="mt-3" onClick={createDemo}>
              + Демо-класс с данными
            </Button>
          )}
        </section>

        <Card>
          <h2 className="mb-4 text-lg font-bold">Новый класс</h2>
          <form onSubmit={create} className="space-y-4">
            <Field label="Название" hint="Например: 8 «Б», чтение">
              <input name="className" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoComplete="off" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Класс">
                <select name="grade" className={inputClass} value={grade} onChange={(e) => setGrade(Number(e.target.value) as 7 | 8 | 9)}>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                  <option value={9}>9</option>
                </select>
              </Field>
              <Field label="Учеников">
                <input
                  name="size"
                  autoComplete="off"
                  className={inputClass}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={40}
                  value={size}
                  onChange={(e) => setSize(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                />
              </Field>
            </div>
            <p className="text-sm text-muted">
              Имена не нужны: каждый ученик получает номер от 1 до {size}. Список «номер — фамилия» храните у себя в журнале.
            </p>
            <Button type="submit" disabled={busy || !name.trim()} className="w-full">
              {busy ? 'Создаю…' : 'Создать класс'}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

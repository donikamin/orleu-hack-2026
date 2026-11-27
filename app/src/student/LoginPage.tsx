import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { Lang, Task } from '@shared/types';
import { login, type StudentRow } from '../lib/db';
import { pickDiagnostic } from '../lib/select';
import { Button, Card, Field, inputClass, Notice } from '../ui';

export default function LoginPage({ tasks, current }: { tasks: Task[]; current?: StudentRow }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('class')?.toUpperCase() ?? current?.classCode ?? '');
  const [number, setNumber] = useState('');
  const [lang, setLang] = useState<Lang>(current?.lang ?? 'ru');
  const [error, setError] = useState('');
  const hasKk = pickDiagnostic(tasks, 'kk').length === 9;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const classCode = code.trim().toUpperCase();
    const n = Number(number);
    if (!/^[A-Z0-9-]{2,16}$/.test(classCode)) return setError('Код класса состоит из латинских букв и цифр, например 8K3TQ. Спроси у учителя.');
    if (!Number.isInteger(n) || n < 1 || n > 99) return setError('Номер — это число от 1 до 99, как в журнале.');
    await login({ classCode, number: n }, lang);
    navigate('/student', { replace: true });
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold">Вход для ученика</h1>
      <p className="mt-1 text-muted">Без пароля и без имени. Интернет не нужен.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4" noValidate>
        <Field label="Код класса" hint="Его даёт учитель. Попробовать без учителя: DEMO">
          <input className={`${inputClass} font-mono`} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
        </Field>
        <Field label="Твой номер в журнале">
          <input className={inputClass} value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" autoComplete="off" />
        </Field>
        {hasKk && (
          <Field label="Язык заданий">
            <select className={inputClass} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </select>
          </Field>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <Button type="submit">Войти</Button>
      </form>
    </Card>
  );
}

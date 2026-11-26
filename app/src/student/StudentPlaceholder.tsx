// Заглушка. Приложение ученика делает часть A (Нуржан): замените этот файл своими экранами.
import { Link } from 'react-router';
import { Card } from '../ui';

export default function StudentPlaceholder() {
  return (
    <Card className="mx-auto max-w-xl">
      <h1 className="text-2xl font-extrabold">Приложение ученика</h1>
      <p className="mt-2 text-muted">
        Эту часть делает Нуржан (часть A по плану). Пока можно проверить панель учителя с тестовым учеником, который
        генерирует QR-код с результатами.
      </p>
      <Link to="/demo/qr" className="mt-4 inline-block font-semibold text-brand underline">
        Открыть тестового ученика →
      </Link>
    </Card>
  );
}

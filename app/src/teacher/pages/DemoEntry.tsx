// /demo — один клик для жюри: создаёт демо-класс на этом устройстве и открывает его.
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { seedDemoClass } from '../demo';

export default function DemoEntry() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    const tab = params.get('tab') ?? '';
    seedDemoClass().then((code) => navigate(`/teacher/${code}${tab ? `/${tab}` : ''}`, { replace: true }));
  }, [navigate, params]);
  return <p className="text-muted">Готовлю демо-класс…</p>;
}

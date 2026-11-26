import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getActive, type StudentRow } from '../lib/db';
import { loadTasks, refreshPack } from './tasks';
import { syncNow } from './sync';
import LoginPage from './LoginPage';
import StudentHome from './StudentHome';
import PlayPage from './PlayPage';
import MapPage from './MapPage';
import GivePage from './GivePage';
import HomeworkPage from './HomeworkPage';

export default function StudentApp() {
  const me = useLiveQuery(getActive, []);
  const tasks = useLiveQuery(loadTasks, []);

  useEffect(() => {
    void navigator.storage?.persist?.(); // просим браузер не стирать прогресс
  }, []);

  // задания класса из фото приходят вместе с базой, поэтому обновляем при смене класса
  const classCode = me?.classCode;
  useEffect(() => {
    const run = () => void refreshPack(classCode);
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [classCode]);

  if (me === undefined || !tasks) return <p className="text-muted">Загрузка…</p>;
  if (!me) return <LoginPage tasks={tasks} />;
  return (
    <div className="mx-auto max-w-2xl">
      <AutoSync me={me} />
      <Routes>
        <Route index element={<StudentHome me={me} tasks={tasks} />} />
        <Route path="login" element={<LoginPage tasks={tasks} current={me} />} />
        <Route path="play/:mode" element={<PlayPage key={me.key} me={me} tasks={tasks} />} />
        <Route path="map" element={<MapPage me={me} tasks={tasks} />} />
        <Route path="give" element={<GivePage me={me} />} />
        <Route path="homework" element={<HomeworkPage me={me} tasks={tasks} />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    </div>
  );
}

function AutoSync({ me }: { me: StudentRow }) {
  const pending = useLiveQuery(() => db.attempts.where('[student+synced]').equals([me.key, 0]).count(), [me.key]);
  useEffect(() => {
    if (!pending) return;
    void syncNow(me);
    const run = () => void syncNow(me);
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, [pending, me]);
  return null;
}

import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router';
import { useOnline } from './teacher/hooks';
import Home from './Home';
import StudentPlaceholder from './student/StudentPlaceholder';

// Экраны учителя грузятся отдельными кусками: ученику на слабой сети они не нужны.
// Все куски всё равно кэшируются PWA и доступны офлайн.
const TeacherHome = lazy(() => import('./teacher/pages/TeacherHome'));
const ClassLayout = lazy(() => import('./teacher/pages/ClassLayout'));
const ClassMap = lazy(() => import('./teacher/pages/ClassMap'));
const ScanPage = lazy(() => import('./teacher/pages/ScanPage'));
const PhotoTasksPage = lazy(() => import('./teacher/pages/PhotoTasksPage'));
const AssignPage = lazy(() => import('./teacher/pages/AssignPage'));
const ConfidentWrongPage = lazy(() => import('./teacher/pages/ConfidentWrongPage'));
const TomorrowPage = lazy(() => import('./teacher/pages/TomorrowPage'));
const StudentDetail = lazy(() => import('./teacher/pages/StudentDetail'));
const PrintPage = lazy(() => import('./teacher/pages/PrintPage'));
const DemoStudentQr = lazy(() => import('./teacher/pages/DemoStudentQr'));

export default function App() {
  const online = useOnline();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            Oqy
          </Link>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-brand-soft text-brand' : 'bg-accent-soft text-accent'}`}
            aria-live="polite"
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-brand' : 'bg-accent'}`} />
            {online ? 'Онлайн' : 'Офлайн: всё работает'}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Suspense fallback={<p className="text-muted">Загрузка…</p>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/student/*" element={<StudentPlaceholder />} />
          <Route path="/teacher" element={<TeacherHome />} />
          <Route path="/teacher/:code" element={<ClassLayout />}>
            <Route index element={<ClassMap />} />
            <Route path="scan" element={<ScanPage />} />
            <Route path="photo" element={<PhotoTasksPage />} />
            <Route path="assign" element={<AssignPage />} />
            <Route path="misconceptions" element={<ConfidentWrongPage />} />
            <Route path="tomorrow" element={<TomorrowPage />} />
            <Route path="student/:number" element={<StudentDetail />} />
          </Route>
          <Route path="/teacher/:code/print" element={<PrintPage />} />
          <Route path="/demo/qr" element={<DemoStudentQr />} />
          <Route path="*" element={<p className="text-muted">Страница не найдена. <Link className="font-semibold text-brand underline" to="/">На главную</Link></p>} />
        </Routes>
        </Suspense>
      </main>
    </div>
  );
}

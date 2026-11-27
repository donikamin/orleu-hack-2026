import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, Outlet, Route, Routes } from 'react-router';
import { useOnline } from './teacher/hooks';
import { ThemeToggle } from './ui/ThemeToggle';
import SiteShell from './site/SiteShell';
import SiteHome from './site/SiteHome';

// Экраны лендинга-приложения: каждый — отдельный экран без длинной прокрутки
const SiteCase = lazy(() => import('./site/SiteCase'));
const SiteTrain = lazy(() => import('./site/SiteTrain'));
const SiteTask = lazy(() => import('./site/SiteTask'));
const SiteTexts = lazy(() => import('./site/SiteTexts'));
const SiteOffline = lazy(() => import('./site/SiteOffline'));
const SiteLessons = lazy(() => import('./site/SiteLessons'));
const SiteMe = lazy(() => import('./site/SiteMe'));
const SiteTutor = lazy(() => import('./site/SiteTutor'));
const SiteTools = lazy(() => import('./site/SiteTools'));

// Приложение ученика (часть A): отдельный кусок, кэшируется PWA и работает офлайн.
const StudentApp = lazy(() => import('./student/StudentApp'));

// Экраны учителя грузятся отдельными кусками и кэшируются PWA для офлайна.
const TeacherHome = lazy(() => import('./teacher/pages/TeacherHome'));
const ClassLayout = lazy(() => import('./teacher/pages/ClassLayout'));
const ClassMap = lazy(() => import('./teacher/pages/ClassMap'));
const ScanPage = lazy(() => import('./teacher/pages/ScanPage'));
const PhotoTasksPage = lazy(() => import('./teacher/pages/PhotoTasksPage'));
const AssignPage = lazy(() => import('./teacher/pages/AssignPage'));
const ConfidentWrongPage = lazy(() => import('./teacher/pages/ConfidentWrongPage'));
const TomorrowPage = lazy(() => import('./teacher/pages/TomorrowPage'));
const TasksAnalysisPage = lazy(() => import('./teacher/pages/TasksAnalysisPage'));
const TrendPage = lazy(() => import('./teacher/pages/TrendPage'));
const LessonPage = lazy(() => import('./teacher/pages/LessonPage'));
const ReportsPage = lazy(() => import('./teacher/pages/ReportsPage'));
const DataPage = lazy(() => import('./teacher/pages/DataPage'));
const StudentDetail = lazy(() => import('./teacher/pages/StudentDetail'));
const PrintPage = lazy(() => import('./teacher/pages/PrintPage'));
const DemoStudentQr = lazy(() => import('./teacher/pages/DemoStudentQr'));
const DemoEntry = lazy(() => import('./teacher/pages/DemoEntry'));

const topLink = ({ isActive }: { isActive: boolean }) =>
  `hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold sm:inline-flex ${isActive ? 'text-brand' : 'text-muted hover:text-ink'}`;

function AppLayout() {
  const online = useOnline();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-4 focus:py-3 focus:font-semibold focus:text-on-brand"
      >
        К содержимому
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex min-h-11 items-center gap-2 text-lg font-bold text-ink">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span translate="no">Oqy</span>
          </Link>
          <nav aria-label="Главное" className="ml-2 flex items-center">
            <NavLink to="/teacher" className={topLink}>Учитель</NavLink>
            <NavLink to="/student" className={topLink}>Ученик</NavLink>
            <Link to="/" className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-muted hover:text-ink sm:inline-flex">О проекте</Link>
          </nav>
          <span className="flex-1" />
          <span
            className={`inline-flex items-center gap-2 text-sm ${online ? 'text-muted' : 'font-semibold text-accent'}`}
            role="status"
          >
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-ok' : 'bg-accent'}`} aria-hidden="true" />
            {online ? 'Онлайн' : 'Офлайн: всё работает'}
          </span>
          <ThemeToggle />
        </div>
      </header>
      <main id="content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:py-8">
        <Suspense fallback={<p className="text-muted">Загрузка…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route index element={<SiteHome />} />
        <Route path="case" element={<SiteCase />} />
        <Route path="train" element={<SiteTrain />} />
        <Route path="train/:id" element={<SiteTask />} />
        <Route path="texts" element={<SiteTexts />} />
        <Route path="texts/:id" element={<SiteTexts />} />
        <Route path="offline" element={<SiteOffline />} />
        <Route path="lessons" element={<SiteLessons />} />
        <Route path="lessons/:id" element={<SiteLessons />} />
        <Route path="me" element={<SiteMe />} />
        <Route path="tutor" element={<SiteTutor />} />
        <Route path="math" element={<SiteTrain />} />
        <Route path="try" element={<Navigate to="/train" replace />} />
        <Route path="how" element={<Navigate to="/offline" replace />} />
        <Route path="tools" element={<SiteTools />} />
      </Route>
      <Route element={<AppLayout />}>
        <Route path="/student/*" element={<StudentApp />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/teacher/:code" element={<ClassLayout />}>
          <Route index element={<ClassMap />} />
          <Route path="tasks" element={<TasksAnalysisPage />} />
          <Route path="trend" element={<TrendPage />} />
          <Route path="misconceptions" element={<ConfidentWrongPage />} />
          <Route path="tomorrow" element={<TomorrowPage />} />
          <Route path="lesson" element={<LessonPage />} />
          <Route path="assign" element={<AssignPage />} />
          <Route path="photo" element={<PhotoTasksPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="data" element={<DataPage />} />
          <Route path="student/:number" element={<StudentDetail />} />
        </Route>
        <Route path="/teacher/:code/print" element={<PrintPage />} />
        <Route path="/demo/qr" element={<DemoStudentQr />} />
        <Route path="/demo" element={<DemoEntry />} />
        <Route
          path="*"
          element={
            <p className="text-muted">
              Страница не найдена. <Link className="font-semibold text-brand underline" to="/">На главную</Link>
            </p>
          }
        />
      </Route>
    </Routes>
  );
}

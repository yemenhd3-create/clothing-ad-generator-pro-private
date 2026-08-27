import NotFound from "@/pages/NotFound";
import React, { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { isFriendTestMode } from "./lib/friendTestMode";
import { trpc } from './lib/trpc';

const CanvasVisualCheck = lazy(() => import('./components/CanvasVisualCheck'));
const PersonalAccessGate = lazy(() => import('./components/PersonalAccessGate'));
const AuthenticatedApplication = lazy(() => import('./components/AuthenticatedApplication'));
const DeviceCompatibilityCheck = lazy(() => import('./pages/DeviceCompatibilityCheck'));
const LocalBackgroundVisualCheck = lazy(() => import('./components/LocalBackgroundVisualCheck'));
const ArtworkEditorVisualCheck = lazy(() => import('./components/ArtworkEditorVisualCheck'));
const BatchVisualCheck = lazy(() => import('./components/BatchVisualCheck'));
const Home = lazy(() => import('./pages/Home'));

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={PersonalHome} />
      <Route path={"/device-check"} component={DeviceCheckHome} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function PersonalHome() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('canvas-visual-check')) {
    return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز معاينة القالب…" />}><CanvasVisualCheck /></Suspense>;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('device-check')) {
    return <Suspense fallback={<LoadingScreen text="جارٍ فتح فحص توافق الهاتف…" />}><DeviceCompatibilityCheck /></Suspense>;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('local-background-check')) {
    return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز فحص الإزالة المحلية…" />}><LocalBackgroundVisualCheck /></Suspense>;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('artwork-editor-check')) {
    return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز محرر الطبقات…" />}><ArtworkEditorVisualCheck /></Suspense>;
  }
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('batch-visual-check')) {
    return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز مساحة الدفعة…" />}><BatchVisualCheck /></Suspense>;
  }
  const friendTestMode = isFriendTestMode(import.meta.env.VITE_FRIEND_TEST_MODE);
  const developerEntryRequested = new URLSearchParams(window.location.search).has('developer');
  // المسار العام متاح للأصدقاء بلا حساب. تبقى الأدوات الخاصة والمزودات
  // والرسائل خارج هذا المسار، ولا يفتحها إلا رابط المطور المحمي.
  if (friendTestMode || !developerEntryRequested) {
    return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز وضع الاختبار…" />}><AuthenticatedApplication friendTestMode /></Suspense>;
  }
  return <ProjectAccessGate />;
}

function ProjectAccessGate() {
  const modeQuery = trpc.projectAccess.mode.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  if (modeQuery.isLoading) return <LoadingScreen text="جارٍ التحقق من تأمين صفحة الدخول…" />;
  // عند أي خطأ نتبع الوضع الآمن ولا نفتح التطبيق مباشرة.
  if (modeQuery.data?.loginRequired !== false) {
    return <Suspense fallback={<LoadingScreen text="جارٍ فتح مساحتك الشخصية…" />}><PersonalAccessGate><Suspense fallback={<LoadingScreen text="جارٍ تجهيز مولد الإعلانات…" />}><AuthenticatedApplication /></Suspense></PersonalAccessGate></Suspense>;
  }
  return <Suspense fallback={<LoadingScreen text="جارٍ تجهيز وضع الدخول المباشر…" />}><AuthenticatedApplication /></Suspense>;
}

function DeviceCheckHome() {
  return <Suspense fallback={<LoadingScreen text="جارٍ فتح فحص توافق الهاتف…" />}><PersonalAccessGate><DeviceCompatibilityCheck /></PersonalAccessGate></Suspense>;
}

function LoadingScreen({ text }: { text: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#fffdf6] p-6" dir="rtl"><section className="rounded-3xl bg-white px-7 py-6 text-center shadow-[0_12px_32px_rgba(37,35,95,0.08)]"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /><p className="mt-3 text-sm font-bold text-primary">{text}</p></section></main>;
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <Router />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

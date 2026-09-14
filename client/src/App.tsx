import NotFound from "@/pages/NotFound";
import React, { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const CanvasVisualCheck = lazy(() => import('./components/CanvasVisualCheck'));
const PersonalAccessGate = lazy(() => import('./components/PersonalAccessGate'));
const AuthenticatedApplication = lazy(() => import('./components/AuthenticatedApplication'));
const DeviceCompatibilityCheck = lazy(() => import('./pages/DeviceCompatibilityCheck'));
const LocalBackgroundVisualCheck = lazy(() => import('./components/LocalBackgroundVisualCheck'));
const ArtworkEditorVisualCheck = lazy(() => import('./components/ArtworkEditorVisualCheck'));
const BatchVisualCheck = lazy(() => import('./components/BatchVisualCheck'));

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={PersonalHome} />
      <Route path={"/device-check"} component={DeviceCheckHome} />
      <Route path={"/404"} component={NotFound} />
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
  return <ProjectAccessGate />;
}

function ProjectAccessGate() {
  return (
    <Suspense fallback={<LoadingScreen text="جارٍ فتح مساحتك الشخصية…" />}>
      <PersonalAccessGate>
        <Suspense fallback={<LoadingScreen text="جارٍ تجهيز مولد الإعلانات…" />}>
          <AuthenticatedApplication />
        </Suspense>
      </PersonalAccessGate>
    </Suspense>
  );
}

function DeviceCheckHome() {
  return <Suspense fallback={<LoadingScreen text="جارٍ فتح فحص توافق الهاتف…" />}><PersonalAccessGate><DeviceCompatibilityCheck /></PersonalAccessGate></Suspense>;
}

function LoadingScreen({ text }: { text: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#fffdf6] p-6" dir="rtl"><section className="rounded-3xl bg-white px-7 py-6 text-center shadow-[0_12px_32px_rgba(37,35,95,0.08)]"><span className="mx-auto block h-7 w-7 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" /><p className="mt-3 text-sm font-bold text-primary">{text}</p></section></main>;
}

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

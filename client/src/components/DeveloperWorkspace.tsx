import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ImagePlus,
  KeyRound,
  Layers,
  LayoutTemplate,
  LockKeyhole,
  LogOut,
  Moon,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  ServerCog,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from './ui/input';


const DeveloperPersonalConsole = lazy(() => import('./DeveloperPersonalConsole'));
const OpenImageModelsCatalog = lazy(() => import('./OpenImageModelsCatalog'));
const PrivateKeyChat = lazy(() => import('./PrivateKeyChat'));
const DeveloperProviderTools = lazy(() => import('./DeveloperProviderTools'));
const DeveloperTemplateManager = lazy(() => import('./DeveloperTemplateManager'));

type DiagnosticEntry = {
  id: string;
  at: string;
  level: 'success' | 'error' | 'info';
  message: string;
};

type DeveloperSection = 'overview' | 'templates' | 'providers' | 'keys' | 'manage' | 'system';

const DEVELOPER_SECTIONS: Array<{ id: DeveloperSection; label: string; icon: typeof ServerCog | typeof LayoutTemplate }> = [
  { id: 'overview', label: 'الرئيسية', icon: ServerCog },
  { id: 'templates', label: 'القوالب (Offline)', icon: LayoutTemplate },
  { id: 'providers', label: 'المزودون', icon: ServerCog },
  { id: 'keys', label: 'المفاتيح', icon: KeyRound },
  { id: 'manage', label: 'الإدارة', icon: Power },
  { id: 'system', label: 'النظام', icon: Settings },
];

const DEFAULT_SAMPLE_TEMPLATE = JSON.stringify(
  {
    schemaVersion: 1,
    id: 'tpl_custom_sample',
    name: 'قالب تجريبي مخصص',
    size: 'story',
    visualTheme: 'midnight',
    productScale: 0.85,
    elements: [
      {
        id: 'product',
        visible: true,
        required: true,
        box: { x: 0.1, y: 0.2, width: 0.8, height: 0.55 },
      },
      {
        id: 'header',
        visible: true,
        required: false,
        box: { x: 0.1, y: 0.05, width: 0.8, height: 0.12 },
      },
      {
        id: 'price',
        visible: true,
        required: false,
        box: { x: 0.6, y: 0.82, width: 0.3, height: 0.1 },
      },
      {
        id: 'footer',
        visible: true,
        required: false,
        box: { x: 0.05, y: 0.92, width: 0.9, height: 0.06 },
      },
    ],
    author: 'device-developer',
  },
  null,
  2
);

export default function DeveloperWorkspace({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.developer.status.useQuery();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [activeSection, setActiveSection] = useState<DeveloperSection>('overview');
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([
    { id: 'workspace-opened', at: new Date().toLocaleTimeString('ar-YE'), level: 'info', message: 'تم فتح مساحة إدارة المطور.' },
  ]);

  const isAuthenticated = statusQuery.data?.authenticated === true;

  const addDiagnostic = (level: DiagnosticEntry['level'], message: string) => {
    setDiagnostics(current => [{ id: crypto.randomUUID(), at: new Date().toLocaleTimeString('ar-YE'), level, message }, ...current].slice(0, 12));
  };

  const loginMutation = trpc.developer.login.useMutation({
    onSuccess: async (data: any) => {
      if (data?.token) {
        try {
          localStorage.setItem('clothing_ad_developer_token', data.token);
        } catch {}
      }
      setPassword('');
      setNotice('تم فتح لوحة المطور.');
      addDiagnostic('success', 'نجح التحقق الخادمي من بيانات دخول المطور.');
      utils.developer.status.setData(undefined, { authenticated: true });
      await utils.developer.status.invalidate();
    },
    onError: (err) => {
      const isNetworkError = /Failed to fetch|NetworkError|Network request failed|Load failed/i.test(err.message || '');
      if (isNetworkError) {
        setNotice('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
      } else {
        setNotice(err.message || 'اسم المستخدم أو كلمة المرور غير صحيحين.');
      }
      addDiagnostic('error', `فشلت محاولة فتح لوحة المطور: ${err.message || 'خطأ غير معروف'}`);
    },
  });

  const logoutMutation = trpc.developer.logout.useMutation({
    onSuccess: async () => {
      try {
        localStorage.removeItem('clothing_ad_developer_token');
      } catch {}
      setNotice('تم إغلاق لوحة المطور.');
      addDiagnostic('info', 'تم إنهاء جلسة المطور.');
      utils.developer.status.setData(undefined, { authenticated: false });
      await utils.developer.status.invalidate();
    },
  });

  // If in 'templates' section, allow offline access even if not authenticated!
  // If in 'templates' section, allow offline access even if not authenticated!
  if (activeSection === 'templates') {
    return (
      <section className="flex flex-col rounded-[26px] border border-primary/10 bg-white p-3 text-foreground shadow-[0_16px_40px_rgba(37,35,95,0.08)]" style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--card)' }} dir="rtl" aria-label="مساحة محرر القوالب">
        <div className="flex items-center justify-between border-b border-primary/10 pb-3 px-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <Check size={13} /> وضع الأوفلاين
            </span>
            <span className="text-sm font-black text-foreground">إدارة قوالب واتساب الذكية</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className="text-xs font-bold text-primary hover:underline"
          >
            الرجوع للوحة المطور
          </button>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto pb-3" style={{ minHeight: 0, overscrollBehavior: 'contain' }}>
          <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground font-bold">جارٍ تجهيز محرر القوالب...</div>}>
            <DeveloperTemplateManager
              addDiagnostic={addDiagnostic}
              onBack={() => setActiveSection('overview')}
            />
          </Suspense>
        </div>
        <button type="button" onClick={onBack} className="shrink-0 w-full border-t border-primary/10 py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
      </section>
    );
  }

  if (!isAuthenticated) {
    return (
      <section className="flex flex-col rounded-[26px] border border-primary/10 bg-white p-5 text-foreground shadow-[0_16px_40px_rgba(37,35,95,0.08)] sm:p-7" style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--card)' }} dir="rtl" aria-label="مساحة دخول لوحة المطور">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><LockKeyhole size={15} /> مساحة خاصة</span>
          <h2 className="mt-3 text-2xl font-black text-foreground">لوحة المطور</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">هذه المساحة مخصصة للمطور. يمكنك الدخول لميزات الخادم أو استخدام محرر القوالب المحلي مباشرة دون إنترنت.</p>
        </div>

        {/* زر الوصول السريع المباشر للأوفلاين */}
        <div className="mt-4 rounded-2xl border border-primary/15 bg-secondary/80 p-3.5 text-right">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">محرر القوالب والموارد (بدون إنترنت)</p>
              <p className="text-[11px] text-muted-foreground">تعديل القوالب محلياً دون الحاجة لتسجيل دخول السيرفر</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('templates')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm transition active:scale-95"
            >
              <LayoutTemplate size={15} />
              <span>فتح المحرر</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-1 flex-col justify-center space-y-4" style={{ minHeight: 0 }}>
          <label className="block space-y-2"><span className="text-sm font-bold text-foreground">اسم المستخدم</span><Input className="h-12 rounded-2xl border-stone-200 px-4 text-right" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" /></label>
          <label className="block space-y-2"><span className="text-sm font-bold text-foreground">كلمة المرور</span><Input className="h-12 rounded-2xl border-stone-200 px-4 text-right" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={event => { if (event.key === 'Enter') loginMutation.mutate({ username, password }); }} /></label>
          {notice && <p className="rounded-xl bg-secondary p-3 text-sm font-medium text-primary">{notice}</p>}
          <button type="button" disabled={loginMutation.isPending || !username || !password} onClick={() => loginMutation.mutate({ username, password })} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"><LockKeyhole size={19} />{loginMutation.isPending ? 'جارٍ التحقق…' : 'دخول لوحة المطور'}</button>
          <button type="button" onClick={onBack} className="w-full py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
        </div>
      </section>
    );
  }

  // Authenticated full view
  return (
    <section className="flex flex-col rounded-[26px] border border-primary/10 bg-white p-3 text-foreground shadow-[0_16px_40px_rgba(37,35,95,0.08)]" style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--card)' }} dir="rtl" aria-label="مساحة عمل لوحة المطور">
      <div className="rounded-2xl bg-secondary p-4 sm:p-5" style={{ opacity: .92 }}>
        <div className="flex items-start justify-between gap-3">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><Check size={15} /> جلسة مطور آمنة</span><h2 className="mt-3 text-2xl font-black text-foreground">لوحة المطور</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">اختر قسماً. المفاتيح محفوظة مشفّرة والقوالب محفوظة محلياً في جهازك.</p></div>
          <button type="button" onClick={() => logoutMutation.mutate()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary" aria-label="تسجيل الخروج"><LogOut size={19} /></button>
        </div>
        {notice && <p className="mt-5 rounded-xl bg-secondary p-3 text-sm font-medium text-primary">{notice}</p>}
      </div>

      <nav className="mt-3 flex gap-2 rounded-2xl border border-primary/10 bg-white p-2 shadow-sm" aria-label="أقسام لوحة المطور" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', backgroundColor: 'var(--card)' }}>
        {DEVELOPER_SECTIONS.map(section => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} aria-pressed={active} style={{ minHeight: '2.75rem' }} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition active:scale-95 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary/70 text-primary'}`}><Icon size={16} />{section.label}</button>; })}
      </nav>

      <div className="mt-3 flex-1 overflow-y-auto pb-3" style={{ minHeight: 0, overscrollBehavior: 'contain' }}>
      {activeSection === 'overview' && (
        <section className="rounded-[24px] bg-secondary p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7" style={{ minHeight: '100%', opacity: .82 }}>
          <div className="flex items-center gap-2 text-primary"><ServerCog size={20} /><h3 className="font-black">كل صلاحيات المطور هنا</h3></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">استخدم الأزرار التالية للوصول المباشر. لا تحتاج إلى البحث في صفحة طويلة.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => setActiveSection('templates')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/10 p-3 text-right text-sm font-black text-primary border border-primary/20"><LayoutTemplate className="mb-1" size={18} />محرر القوالب (Offline)</button>
            <button type="button" onClick={() => setActiveSection('providers')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><ServerCog className="mb-1" size={18} />إضافة واختبار مزود</button>
            <button type="button" onClick={() => setActiveSection('keys')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><KeyRound className="mb-1" size={18} />المفاتيح الخاصة</button>
            <button type="button" onClick={() => setActiveSection('manage')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><Power className="mb-1" size={18} />رموز الدخول والمستخدمون</button>
            <button type="button" onClick={() => setActiveSection('system')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><Settings className="mb-1" size={18} />الدخول والسجل</button>
          </div>
        </section>
      )}

      {activeSection === 'providers' && <Suspense fallback={<section className="rounded-[24px] bg-secondary p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح أدوات المزودين…</section>}><DeveloperProviderTools onDiagnostic={addDiagnostic} /></Suspense>}
      {activeSection === 'keys' && <><Suspense fallback={<section className="rounded-[24px] bg-secondary p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح المحادثة الخاصة…</section>}><PrivateKeyChat /></Suspense><Suspense fallback={<section className="rounded-[24px] bg-secondary p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح كتالوج النماذج…</section>}><OpenImageModelsCatalog /></Suspense></>}
      {activeSection === 'system' && (
        <section className="rounded-[24px] bg-secondary p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3 text-primary"><div className="flex items-center gap-2"><KeyRound size={19} /><h3 className="font-black">السجل التشخيصي</h3></div><button type="button" onClick={() => setDiagnostics([])} className="text-xs font-bold text-muted-foreground">مسح السجل</button></div>
          {!diagnostics.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لا توجد أحداث في الجلسة الحالية.</p>}
          <div className="space-y-2">{diagnostics.map(entry => <div key={entry.id} className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.level === 'success' ? 'bg-emerald-500' : entry.level === 'error' ? 'bg-red-500' : 'bg-primary'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{entry.message}</p><p className="mt-1 text-xs text-muted-foreground">{entry.at}</p></div></div>)}</div>
        </section>
      )}
      {activeSection === 'manage' && <Suspense fallback={<section className="rounded-[24px] bg-secondary p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح أدوات المساحة الشخصية…</section>}><DeveloperPersonalConsole /></Suspense>}
      </div>
      <button type="button" onClick={onBack} className="shrink-0 w-full border-t border-primary/10 py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
    </section>
  );
}

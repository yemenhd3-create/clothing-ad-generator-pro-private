import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
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
  Sun,
  Trash2,
} from 'lucide-react';
import React, { lazy, Suspense, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from './ui/input';
import { useDynamicAssets } from '@/hooks/useDynamicAssets';

const DeveloperPersonalConsole = lazy(() => import('./DeveloperPersonalConsole'));
const OpenImageModelsCatalog = lazy(() => import('./OpenImageModelsCatalog'));
const PrivateKeyChat = lazy(() => import('./PrivateKeyChat'));
const DeveloperProviderTools = lazy(() => import('./DeveloperProviderTools'));

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

  // Dynamic Assets Hook
  const {
    templates,
    activeTemplate,
    setActiveTemplate,
    isLoading: isTemplatesLoading,
    errorNotice: templateError,
    successNotice: templateSuccess,
    saveJsonTemplate,
    removeTemplate,
    setErrorNotice: setTemplateError,
    setSuccessNotice: setTemplateSuccess,
  } = useDynamicAssets();

  const [jsonInput, setJsonInput] = useState<string>(DEFAULT_SAMPLE_TEMPLATE);

  useEffect(() => {
    if (activeTemplate) {
      setJsonInput(JSON.stringify(activeTemplate, null, 2));
    }
  }, [activeTemplate]);

  const isAuthenticated = statusQuery.data?.authenticated === true;

  const addDiagnostic = (level: DiagnosticEntry['level'], message: string) => {
    setDiagnostics(current => [{ id: crypto.randomUUID(), at: new Date().toLocaleTimeString('ar-YE'), level, message }, ...current].slice(0, 12));
  };

  const loginMutation = trpc.developer.login.useMutation({
    onSuccess: async () => {
      setPassword('');
      setNotice('تم فتح لوحة المطور.');
      addDiagnostic('success', 'نجح التحقق الخادمي من بيانات دخول المطور.');
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
      setNotice('تم إغلاق لوحة المطور.');
      addDiagnostic('info', 'تم إنهاء جلسة المطور.');
      await utils.developer.status.invalidate();
    },
  });

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
      setTemplateSuccess('تم تنسيق كود JSON بنجاح');
      setTemplateError(null);
    } catch (e) {
      setTemplateError(`فشل التنسيق: ${(e as Error).message}`);
    }
  };

  const handleSaveTemplate = async () => {
    const success = await saveJsonTemplate(jsonInput);
    if (success) {
      addDiagnostic('success', 'تم حفظ وتفعيل قالب ديناميكي في IndexedDB');
    } else {
      addDiagnostic('error', 'فشل حفظ القالب الديناميكي');
    }
  };

  const handleResetToSample = () => {
    setJsonInput(DEFAULT_SAMPLE_TEMPLATE);
    setTemplateSuccess('تمت استعادة النموذج الافتراضي');
    setTemplateError(null);
  };

  const handleExportCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonInput);
      setTemplateSuccess('تم نسخ كود القالب إلى الحافظة بنجاح');
      setTemplateError(null);
    } catch {
      setTemplateSuccess('تفضل بنسخ الكود من المنطقة النصية مباشرة');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) {
      setTemplateError('يرجى اختيار قالب للحذف');
      return;
    }
    await removeTemplate(activeTemplate.id);
    setJsonInput(DEFAULT_SAMPLE_TEMPLATE);
  };

  // Template Editor View Component (Mobile-First, completely offline)
  const renderTemplateEditor = () => (
    <section className="space-y-4 rounded-[24px] bg-secondary p-4 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="text-primary" size={20} />
            <h3 className="font-black text-foreground">محرر القوالب الديناميكي (Offline)</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">عدّل أو استورد قوالب التصميم مباشرة على جهازك دون الحاجة لسيرفر أو بناء APK جديد.</p>
        </div>
        <button
          type="button"
          onClick={handleFormatJson}
          className="rounded-xl border border-primary/20 bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-primary/5 active:scale-95 transition"
        >
          تنسيق JSON
        </button>
      </div>

      {templateError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
          <AlertTriangle className="mt-0.5 shrink-0 text-red-600" size={16} />
          <span>{templateError}</span>
        </div>
      )}

      {templateSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
          <Check className="shrink-0 text-emerald-600" size={16} />
          <span>{templateSuccess}</span>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-foreground">القوالب المحفوظة بالجهاز ({templates.length}):</label>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            {templates.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setActiveTemplate(tpl);
                  setJsonInput(JSON.stringify(tpl, null, 2));
                  setTemplateSuccess(`تم تحميل القالب "${tpl.name}"`);
                  setTemplateError(null);
                }}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                  activeTemplate?.id === tpl.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground border border-primary/10'
                }`}
              >
                {tpl.name} ({tpl.size})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-bold text-foreground">كود القالب (JSON Structure):</label>
        <textarea
          value={jsonInput}
          onChange={e => setJsonInput(e.target.value)}
          className="h-64 w-full rounded-2xl border border-primary/15 bg-slate-900 p-3.5 font-mono text-xs text-slate-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary dir-ltr text-left"
          placeholder="ضع كود JSON للقالب هنا..."
          spellCheck={false}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
        <button
          type="button"
          onClick={handleSaveTemplate}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground shadow-sm transition active:scale-95"
        >
          <Save size={16} />
          <span>حفظ وتفعيل</span>
        </button>

        <button
          type="button"
          onClick={handleExportCopy}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary/15 bg-card px-3 text-xs font-bold text-foreground transition hover:bg-primary/5 active:scale-95"
        >
          <Copy size={16} />
          <span>نسخ الكود</span>
        </button>

        <button
          type="button"
          onClick={handleResetToSample}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary/15 bg-card px-3 text-xs font-bold text-foreground transition hover:bg-primary/5 active:scale-95"
        >
          <RotateCcw size={16} />
          <span>نموذج افتراضي</span>
        </button>

        <button
          type="button"
          onClick={handleDeleteTemplate}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 transition hover:bg-red-100 active:scale-95"
        >
          <Trash2 size={16} />
          <span>حذف القالب</span>
        </button>
      </div>
    </section>
  );

  // If in 'templates' section, allow offline access even if not authenticated!
  if (activeSection === 'templates') {
    return (
      <section className="flex flex-col rounded-[26px] border border-primary/10 bg-white p-3 text-foreground shadow-[0_16px_40px_rgba(37,35,95,0.08)]" style={{ height: '100%', minHeight: 0, backgroundColor: 'var(--card)' }} dir="rtl" aria-label="مساحة محرر القوالب">
        <div className="flex items-center justify-between border-b border-primary/10 pb-3 px-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              <Check size={13} /> وضع الأوفلاين
            </span>
            <span className="text-sm font-black text-foreground">محرر القوالب الديناميكي</span>
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
          {renderTemplateEditor()}
        </div>
        <button type="button" onClick={onBack} className="shrink-0 w-full border-t border-primary/10 py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
      </section>
    );
  }

  // Not authenticated view (Server login + Offline Template button)
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

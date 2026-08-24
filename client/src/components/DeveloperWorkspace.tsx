import { Check, KeyRound, LockKeyhole, LogOut, Moon, Power, RefreshCw, ServerCog, Settings, Sun } from 'lucide-react';
import React, { lazy, Suspense, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useTheme } from '@/contexts/ThemeContext';
import { Input } from './ui/input';

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

type DeveloperSection = 'overview' | 'providers' | 'keys' | 'manage' | 'system';

const DEVELOPER_SECTIONS: Array<{ id: DeveloperSection; label: string; icon: typeof ServerCog }> = [
  { id: 'overview', label: 'الرئيسية', icon: ServerCog },
  { id: 'providers', label: 'المزودون', icon: ServerCog },
  { id: 'keys', label: 'المفاتيح', icon: KeyRound },
  { id: 'manage', label: 'الإدارة', icon: Power },
  { id: 'system', label: 'النظام', icon: Settings },
];

export default function DeveloperWorkspace({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const { theme, toggleTheme } = useTheme();
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
    onSuccess: async () => {
      setPassword('');
      setNotice('تم فتح لوحة المطور.');
      addDiagnostic('success', 'نجح التحقق الخادمي من بيانات دخول المطور.');
      await utils.developer.status.invalidate();
    },
    onError: () => {
      setNotice('اسم المستخدم أو كلمة المرور غير صحيحين.');
      addDiagnostic('error', 'فشلت محاولة فتح لوحة المطور.');
    },
  });

  const logoutMutation = trpc.developer.logout.useMutation({
    onSuccess: async () => {
      setNotice('تم إغلاق لوحة المطور.');
      addDiagnostic('info', 'تم إنهاء جلسة المطور.');
      await utils.developer.status.invalidate();
    },
  });

  if (statusQuery.isLoading) {
    return <section className="rounded-[28px] bg-white p-8 text-center shadow-[0_16px_40px_rgba(37,35,95,0.08)]"><RefreshCw className="mx-auto animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">جارٍ التحقق من لوحة المطور…</p></section>;
  }

  if (!isAuthenticated) {
    return (
      <section className="rounded-[28px] bg-white p-5 shadow-[0_16px_40px_rgba(37,35,95,0.08)] sm:p-7" dir="rtl">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"><LockKeyhole size={15} /> مساحة خاصة</span>
        <h2 className="mt-3 text-2xl font-black text-foreground">لوحة المطور</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">هذه المساحة مخصصة للمطور فقط. لا يستطيع المستخدم العادي رؤية مفاتيح الذكاء الاصطناعي أو تغييرها.</p>
        <div className="mt-6 space-y-4">
          <label className="block space-y-2"><span className="text-sm font-bold text-foreground">اسم المستخدم</span><Input className="h-12 rounded-2xl border-stone-200 px-4 text-right" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" /></label>
          <label className="block space-y-2"><span className="text-sm font-bold text-foreground">كلمة المرور</span><Input className="h-12 rounded-2xl border-stone-200 px-4 text-right" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" onKeyDown={event => { if (event.key === 'Enter') loginMutation.mutate({ username, password }); }} /></label>
          {notice && <p className="rounded-xl bg-secondary p-3 text-sm font-medium text-primary">{notice}</p>}
          <button type="button" disabled={loginMutation.isPending || !username || !password} onClick={() => loginMutation.mutate({ username, password })} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-black text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"><LockKeyhole size={19} />{loginMutation.isPending ? 'جارٍ التحقق…' : 'دخول لوحة المطور'}</button>
          <button type="button" onClick={onBack} className="w-full py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5" dir="rtl">
      <div className="rounded-[28px] bg-white p-5 shadow-[0_16px_40px_rgba(37,35,95,0.08)] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><Check size={15} /> جلسة مطور آمنة</span><h2 className="mt-3 text-2xl font-black text-foreground">لوحة المطور</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">اختر قسماً واحداً فقط. المفاتيح محفوظة مشفّرة ولا تظهر قيمتها بعد الحفظ.</p></div>
          <button type="button" onClick={() => logoutMutation.mutate()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary" aria-label="تسجيل الخروج"><LogOut size={19} /></button>
        </div>
        {notice && <p className="mt-5 rounded-xl bg-secondary p-3 text-sm font-medium text-primary">{notice}</p>}
      </div>

      <nav className="flex gap-2 rounded-2xl border border-primary/10 bg-white p-2 shadow-sm" aria-label="أقسام لوحة المطور" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {DEVELOPER_SECTIONS.map(section => { const Icon = section.icon; const active = activeSection === section.id; return <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} aria-pressed={active} style={{ minHeight: '2.75rem' }} className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition active:scale-95 ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-secondary/70 text-primary'}`}><Icon size={16} />{section.label}</button>; })}
      </nav>

      {activeSection === 'overview' && <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7"><div className="flex items-center gap-2 text-primary"><ServerCog size={20} /><h3 className="font-black">كل صلاحيات المطور هنا</h3></div><p className="mt-2 text-sm leading-6 text-muted-foreground">استخدم الأزرار التالية للوصول المباشر. لا تحتاج إلى البحث في صفحة طويلة.</p><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setActiveSection('providers')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><ServerCog className="mb-1" size={18} />المزودون والاختبار</button><button type="button" onClick={() => setActiveSection('keys')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><KeyRound className="mb-1" size={18} />المفاتيح الخاصة</button><button type="button" onClick={() => setActiveSection('manage')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><Power className="mb-1" size={18} />الرسائل والمستخدمون</button><button type="button" onClick={() => setActiveSection('system')} style={{ minHeight: '4rem' }} className="rounded-2xl bg-primary/5 p-3 text-right text-sm font-black text-primary"><Settings className="mb-1" size={18} />الدخول والسجل</button></div></section>}

      {activeSection === 'providers' && <Suspense fallback={<section className="rounded-[28px] bg-white p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح أدوات المزودين…</section>}><DeveloperProviderTools onDiagnostic={addDiagnostic} /></Suspense>}
      {activeSection === 'keys' && <><Suspense fallback={<section className="rounded-[28px] bg-white p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح المحادثة الخاصة…</section>}><PrivateKeyChat /></Suspense><Suspense fallback={<section className="rounded-[28px] bg-white p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح كتالوج النماذج…</section>}><OpenImageModelsCatalog /></Suspense></>}
      {activeSection === 'system' && <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3 text-primary"><div className="flex items-center gap-2"><KeyRound size={19} /><h3 className="font-black">السجل التشخيصي</h3></div><button type="button" onClick={() => setDiagnostics([])} className="text-xs font-bold text-muted-foreground">مسح السجل</button></div>
        <button type="button" onClick={toggleTheme} className="mb-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-secondary px-4 text-right text-primary transition active:scale-[0.98]" aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي'}><span className="inline-flex items-center gap-2 text-sm font-black">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}{theme === 'dark' ? 'الوضع الليلي مفعّل' : 'تفعيل الوضع الليلي'}</span><span className="text-xs font-bold text-muted-foreground">محفوظ على هذا الهاتف</span></button>
        {!diagnostics.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لا توجد أحداث في الجلسة الحالية.</p>}
        <div className="space-y-2">{diagnostics.map(entry => <div key={entry.id} className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.level === 'success' ? 'bg-emerald-500' : entry.level === 'error' ? 'bg-red-500' : 'bg-primary'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-foreground">{entry.message}</p><p className="mt-1 text-xs text-muted-foreground">{entry.at}</p></div></div>)}</div>
      </section>}
      {activeSection === 'manage' && <Suspense fallback={<section className="rounded-[28px] bg-white p-6 text-center text-sm text-muted-foreground shadow-[0_12px_30px_rgba(37,35,95,0.06)]">جارٍ فتح أدوات المساحة الشخصية…</section>}><DeveloperPersonalConsole /></Suspense>}
      <button type="button" onClick={onBack} className="w-full py-2 text-sm font-bold text-muted-foreground">العودة إلى الإنشاء</button>
    </section>
  );
}

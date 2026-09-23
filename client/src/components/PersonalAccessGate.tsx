import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { clearOfflineLease, hasValidOfflineLease, saveOfflineLease } from '@/lib/offlineAccess';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import { startLogin } from '@/const';
import { KeyRound, LockKeyhole, LogIn, ShieldAlert, Wifi, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

export default function PersonalAccessGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const accessQuery = trpc.personal.access.useQuery(undefined, {
    enabled: isAuthenticated && isOnline,
    retry: 1,
    retryDelay: 700,
    refetchOnWindowFocus: false,
  });
  const modeQuery = trpc.projectAccess.mode.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isOnline,
  });
  const heartbeat = trpc.personal.heartbeat.useMutation({
    onSuccess: () => {
      saveOfflineLease(modeQuery.data?.offlineGraceHours ?? 72);
    },
    onError: error => {
      if (/FORBIDDEN|موقوف|disabled/i.test(error.message)) clearOfflineLease();
    },
  });

  useEffect(() => {
    const updateOnlineState = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && isOnline) heartbeat.mutate();
    // The mutation object is intentionally omitted: auth/online transitions are the triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isOnline]);

  const offlineLeaseValid = !isOnline && hasValidOfflineLease();
  const modeLoading = isOnline && modeQuery.isLoading;

  if (loading || modeLoading || (isAuthenticated && isOnline && accessQuery.isLoading)) {
    return <AccessShell icon={<LockKeyhole className="animate-pulse" size={28} />} title="جارٍ فتح مساحتك الشخصية" description="نتحقق من حسابك وإعدادات الوصول بأمان." />;
  }

  if (!isOnline && !offlineLeaseValid) {
    return <AccessShell icon={<Wifi size={28} />} title="انتهت مدة العمل دون اتصال" description="افتح الإنترنت للتحقق من صلاحية الحساب وتجديد مدة العمل المحلي. لن تُحذف الصور أو الإعدادات المحفوظة على هذا الجهاز." action={<button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-primary-foreground"><Wifi size={19} />إعادة التحقق</button>} />;
  }

  if (!isAuthenticated && offlineLeaseValid) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    if (!isOnline) {
      return <AccessShell icon={<Wifi size={28} />} title="افتح الإنترنت للتحقق من الدخول" description="يحتاج هذا الجهاز إلى اتصال قصير للتحقق من مفتاحك أو حسابك قبل بدء العمل المحلي." action={<button type="button" onClick={() => window.location.reload()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-primary-foreground"><Wifi size={19} />إعادة المحاولة</button>} />;
    }
    if (modeQuery.data?.registrationOpen === false) {
      return <AccessShell icon={<ShieldAlert size={30} />} title="التسجيل الجديد متوقف" description="أوقف المطور إنشاء حسابات أو أكواد جديدة مؤقتاً. الحسابات المعتمدة تستمر في الدخول عند توفر اتصال." action={<PwaInstallPrompt />} />;
    }
    return <AccessShell icon={<LockKeyhole size={28} />} title="دخول إلى المساحة الشخصية" description="أدخل رمز الوصول الذي أنشأه المطور، أو استخدم حسابك المعتاد إذا كان لديك." action={<><AccessCodeEntry onPlatformLogin={() => startLogin()} /><DeveloperEntry /><PwaInstallPrompt /></>} />;
  }

  if (accessQuery.data?.isDisabled) {
    clearOfflineLease();
    return <AccessShell icon={<ShieldAlert size={30} />} title="الوصول موقوف حالياً" description="هذا الحساب لا يستطيع استخدام مساحة المشروع الآن. راجع المطور لإعادة التفعيل." />;
  }

  if (accessQuery.error && !offlineLeaseValid) {
    return <AccessShell icon={<ShieldAlert size={30} />} title="تعذر التحقق من الوصول مؤقتاً" description="تحقق من الإنترنت ثم أعد المحاولة. لا تُحذف صورك المحلية بسبب هذا الخطأ." action={<button type="button" onClick={() => void accessQuery.refetch()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-primary-foreground transition active:scale-[0.98]"><LogIn size={19} />إعادة التحقق</button>} />;
  }

  return <>{children}</>;
}

function AccessCodeEntry({ onPlatformLogin }: { onPlatformLogin: () => void }) {
  const [code, setCode] = useState('');
  const [entryError, setEntryError] = useState('');
  const redeem = trpc.accessCodes.redeem.useMutation({
    onSuccess: () => window.location.reload(),
    onError: error => {
      const message = /network|fetch|اتصال|networkerror/i.test(error.message || '')
        ? 'تعذر الاتصال مؤقتاً. تحقق من الإنترنت ثم حاول من جديد.'
        : error.message || 'تعذر التحقق من الرمز. راجع الرمز أو جرب الحساب المعتاد.';
      setEntryError(message);
      toast.error(message);
    },
  });
  const submit = () => {
    if (!code.trim()) return toast.error('أدخل رمز الدخول أولاً.');
    setEntryError('');
    redeem.mutate({ code: code.trim() });
  };

  return <div className="space-y-3">
    <label className="sr-only" htmlFor="access-code">رمز الدخول</label>
    <input id="access-code" value={code} onChange={event => setCode(event.target.value.toUpperCase())} onKeyDown={event => { if (event.key === 'Enter') submit(); }} autoCapitalize="characters" autoCorrect="off" placeholder="مثال: CAG-ABCDE-12345" className="min-h-12 w-full rounded-2xl border border-stone-200 px-4 text-center font-bold outline-none focus:border-primary" dir="ltr" />
    <button type="button" disabled={redeem.isPending} onClick={submit} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"><KeyRound size={20} />{redeem.isPending ? 'جارٍ التحقق…' : 'الدخول بالرمز'}</button>
    {entryError && <p className="rounded-xl bg-secondary px-3 py-2 text-xs leading-5 text-muted-foreground" aria-live="polite">{entryError}</p>}
    <button type="button" onClick={onPlatformLogin} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 px-5 text-sm font-black text-primary transition active:scale-[0.98]"><LogIn size={18} />متابعة بالحساب المعتاد</button>
  </div>;
}

function DeveloperEntry() {
  const openDeveloper = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('developer', '1');
    window.location.assign(url.toString());
  };

  return <button type="button" onClick={openDeveloper} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-5 text-sm font-black text-primary transition active:scale-[0.98]">
    <ShieldCheck size={18} /> دخول المطور / المالك
  </button>;
}

function AccessShell({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffaf4] px-5 text-center" dir="rtl">
      <section className="w-full max-w-sm rounded-[30px] bg-white p-7 shadow-[0_20px_50px_rgba(37,35,95,0.12)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
        <h1 className="mt-5 text-2xl font-black text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </section>
    </main>
  );
}

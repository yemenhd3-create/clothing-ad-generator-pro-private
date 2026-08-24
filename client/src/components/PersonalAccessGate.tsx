import { startLogin } from '@/const';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import { KeyRound, LockKeyhole, LogIn, ShieldAlert } from 'lucide-react';
import React, { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

export default function PersonalAccessGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const accessQuery = trpc.personal.access.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: 1,
    retryDelay: 700,
    refetchOnWindowFocus: false,
  });

  if (loading || (isAuthenticated && accessQuery.isLoading)) {
    return <AccessShell icon={<LockKeyhole className="animate-pulse" size={28} />} title="جارٍ فتح مساحتك الشخصية" description="نتحقق من حسابك وإعدادات الوصول بأمان." />;
  }

  if (!isAuthenticated) {
    return (
      <AccessShell
        icon={<LockKeyhole size={28} />}
        title="دخول إلى المساحة الشخصية"
        description="أدخل رمز الوصول الذي أنشأه المطور، أو استخدم حسابك المعتاد إذا كان لديك."
        action={<><AccessCodeEntry onPlatformLogin={() => startLogin()} /><PwaInstallPrompt /></>}
      />
    );
  }

  if (accessQuery.data?.isDisabled) {
    return <AccessShell icon={<ShieldAlert size={30} />} title="الوصول موقوف حالياً" description="هذا الحساب لا يستطيع استخدام مساحة المشروع الآن. راجع المطور من جهازه أو حسابه المصرح به لإعادة التفعيل." />;
  }

  if (accessQuery.error) {
    return <AccessShell icon={<ShieldAlert size={30} />} title="تعذر التحقق من الوصول مؤقتاً" description="لا يعني هذا أن حسابك حُذف. تحقق من الإنترنت ثم أعد المحاولة؛ يبقى حسابك ورمزك محفوظين." action={<button type="button" onClick={() => void accessQuery.refetch()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-black text-primary-foreground transition active:scale-[0.98]"><LogIn size={19} />إعادة التحقق</button>} />;
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
        : 'تعذر التحقق من الرمز. راجع الرمز أو جرب الحساب المعتاد.';
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

import { Copy, KeyRound, ShieldBan } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function DeveloperAccessCodes() {
  const utils = trpc.useUtils();
  const codesQuery = trpc.developer.personal.accessCodes.list.useQuery();
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const createCode = trpc.developer.personal.accessCodes.create.useMutation({
    onSuccess: async data => {
      setCreatedCode(data.code);
      toast.success('تم إنشاء الرمز. انسخه الآن؛ لا يُحفظ نصه داخل النظام.');
      setLabel('');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر إنشاء الرمز.'),
  });
  const revokeCode = trpc.developer.personal.accessCodes.revoke.useMutation({
    onSuccess: async () => {
      toast.success('تم إلغاء الرمز وإيقاف جلسته الحالية.');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر إلغاء الرمز.'),
  });

  const submit = () => {
    if (!label.trim()) return toast.error('اكتب اسماً مختصراً للرمز أو لصاحبه.');
    const expiry = expiresAt ? new Date(expiresAt).getTime() : undefined;
    if (expiresAt && (!expiry || expiry <= Date.now())) return toast.error('اختر تاريخ صلاحية مستقبلياً أو اتركه فارغاً لصلاحية مفتوحة.');
    const uses = maxUses.trim() ? Number(maxUses) : undefined;
    if (uses !== undefined && (!Number.isInteger(uses) || uses < 1)) return toast.error('عدد الاستخدامات يجب أن يكون رقماً موجباً أو اتركه فارغاً لغير محدود.');
    createCode.mutate({ label: label.trim(), expiresAt: expiry, maxUses: uses });
  };
  const copy = async () => {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    toast.success('تم نسخ الرمز.');
  };

  return <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
    <div className="flex items-center gap-2 text-primary"><KeyRound size={20} /><h3 className="font-black">رموز دخول المستخدمين</h3></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">أنشئ رمزاً دون بريد. يمكنك ترك تاريخ الصلاحية أو عدد الاستخدامات فارغاً ليكونا مفتوحين، وتستطيع إلغاء الرمز فوراً.</p>
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-bold text-primary">اسم الرمز أو صاحبه<input value={label} onChange={event => setLabel(event.target.value)} maxLength={120} placeholder="مثال: تجربة أحمد" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-bold text-primary">مدة الصلاحية — اختيارية<input value={expiresAt} onChange={event => setExpiresAt(event.target.value)} type="datetime-local" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-bold text-primary">عدد الاستخدامات<input value={maxUses} onChange={event => setMaxUses(event.target.value)} inputMode="numeric" placeholder="فارغ = استخدامات مفتوحة" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
    </div>
    <button type="button" disabled={createCode.isPending} onClick={submit} className="mt-3 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-50">{createCode.isPending ? 'جارٍ الإنشاء…' : 'توليد رمز دخول'}</button>
    {createdCode && <div className="mt-3 rounded-2xl bg-secondary p-4"><p className="text-xs font-bold text-primary">احفظه الآن؛ لا يمكن عرضه لاحقاً.</p><div className="mt-2 flex items-center gap-2" dir="ltr"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-bold text-primary">{createdCode}</code><button type="button" onClick={copy} className="rounded-lg bg-primary p-2 text-white" aria-label="نسخ الرمز"><Copy size={18} /></button></div></div>}
    <div className="mt-5 space-y-2">
      {codesQuery.data?.map(code => <article key={code.id} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-100 p-3"><div className="min-w-0"><p className="truncate font-black text-foreground">{code.label}</p><p className="mt-1 text-xs text-muted-foreground">{code.isRevoked ? 'ملغى' : code.expiresAt && new Date(code.expiresAt) <= new Date() ? 'منتهٍ' : 'نشط'} · {code.useCount}{code.maxUses ? ` / ${code.maxUses}` : ' استخدامات مفتوحة'}</p></div>{!code.isRevoked && <button type="button" disabled={revokeCode.isPending} onClick={() => revokeCode.mutate({ id: code.id })} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><ShieldBan size={14} />إلغاء</button>}</article>)}
      {!codesQuery.data?.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لم تُنشأ رموز دخول بعد.</p>}
    </div>
  </section>;
}

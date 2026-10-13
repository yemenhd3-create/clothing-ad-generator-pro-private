import React, { useState } from 'react';
import { Coins, Copy, KeyRound, RotateCcw, ShieldBan, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

export default function DeveloperAccessCodes() {
  const utils = trpc.useUtils();
  const codesQuery = trpc.developer.personal.accessCodes.list.useQuery();
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const [activeCodeId, setActiveCodeId] = useState<number | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('20');
  const [editTotalCredits, setEditTotalCredits] = useState('100');
  const [editDailyLimit, setEditDailyLimit] = useState('20');

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

  const rechargeMutation = trpc.developer.personal.aiQuota.recharge.useMutation({
    onSuccess: async () => {
      toast.success('تم شحن الرصيد بنجاح.');
      setActiveCodeId(null);
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر شحن الرصيد.'),
  });

  const resetDailyMutation = trpc.developer.personal.aiQuota.resetDaily.useMutation({
    onSuccess: async () => {
      toast.success('تم تصفير استهلاك الحد اليومي للرمز.');
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر تصفير الحد اليومي.'),
  });

  const updateLimitsMutation = trpc.developer.personal.aiQuota.updateLimits.useMutation({
    onSuccess: async () => {
      toast.success('تم حفظ الحدود بنجاح.');
      setActiveCodeId(null);
      await utils.developer.personal.accessCodes.list.invalidate();
    },
    onError: error => toast.error(error.message || 'تعذر حفظ الحدود.'),
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

  const handleRecharge = (codeId: number) => {
    const credits = Number(rechargeAmount);
    if (!credits || credits <= 0) return toast.error('أدخل رصيداً صحيحاً أكبر من صفر.');
    rechargeMutation.mutate({ id: codeId, credits });
  };

  const handleUpdateLimits = (codeId: number) => {
    const total = Number(editTotalCredits);
    const daily = Number(editDailyLimit);
    updateLimitsMutation.mutate({
      id: codeId,
      aiCreditsTotal: Number.isInteger(total) ? total : undefined,
      aiDailyLimit: Number.isInteger(daily) ? daily : undefined,
    });
  };

  return <section className="rounded-[28px] bg-white p-5 shadow-[0_12px_30px_rgba(37,35,95,0.06)] sm:p-7">
    <div className="flex items-center gap-2 text-primary"><KeyRound size={20} /><h3 className="font-black">رموز دخول المستخدمين وإدارة الأرصدة</h3></div>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">أنشئ رمزاً دون بريد. يمكنك ترك تاريخ الصلاحية أو عدد الاستخدامات فارغاً، وتستطيع مراقبة وشحن رصيد الذكاء الاصطناعي لكل مستخدم.</p>
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-bold text-primary">اسم الرمز أو صاحبه<input value={label} onChange={event => setLabel(event.target.value)} maxLength={120} placeholder="مثال: تجربة أحمد" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-bold text-primary">مدة الصلاحية — اختيارية<input value={expiresAt} onChange={event => setExpiresAt(event.target.value)} type="datetime-local" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
      <label className="block text-xs font-bold text-primary">عدد الاستخدامات<input value={maxUses} onChange={event => setMaxUses(event.target.value)} inputMode="numeric" placeholder="فارغ = استخدامات مفتوحة" className="mt-1 min-h-12 w-full rounded-xl border border-stone-200 px-3 text-sm text-foreground outline-none focus:border-primary" /></label>
    </div>
    <button type="button" disabled={createCode.isPending} onClick={submit} className="mt-3 min-h-12 w-full rounded-xl bg-primary text-sm font-black text-primary-foreground disabled:opacity-50">{createCode.isPending ? 'جارٍ الإنشاء…' : 'توليد رمز دخول'}</button>
    {createdCode && <div className="mt-3 rounded-2xl bg-secondary p-4"><p className="text-xs font-bold text-primary">احفظه الآن؛ لا يمكن عرضه لاحقاً.</p><div className="mt-2 flex items-center gap-2" dir="ltr"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 font-bold text-primary">{createdCode}</code><button type="button" onClick={copy} className="rounded-lg bg-primary p-2 text-white" aria-label="نسخ الرمز"><Copy size={18} /></button></div></div>}
    <div className="mt-5 space-y-3">
      {codesQuery.data?.map(code => {
        const remainingCredits = code.aiCreditsTotal === -1 ? 'غير محدود' : Math.max(0, code.aiCreditsTotal - code.aiCreditsUsed);
        const dailyLimitStr = code.aiDailyLimit === -1 ? 'غير محدود' : `${code.aiDailyUsed} من ${code.aiDailyLimit}`;
        const isEditing = activeCodeId === code.id;

        return (
          <article key={code.id} className="rounded-2xl border border-stone-100 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-black text-foreground">{code.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${code.isRevoked ? 'bg-red-50 text-red-700' : code.expiresAt && new Date(code.expiresAt) <= new Date() ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>
                    {code.isRevoked ? 'ملغى' : code.expiresAt && new Date(code.expiresAt) <= new Date() ? 'منتهٍ' : 'نشط'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  الاستخدامات: {code.useCount}{code.maxUses ? ` / ${code.maxUses}` : ' (مفتوحة)'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-bold text-primary">
                    <Coins size={13} />
                    الرصيد: {remainingCredits} (مستهلك: {code.aiCreditsUsed})
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 font-bold text-primary">
                    <Sparkles size={13} />
                    اليومي: {dailyLimitStr}
                  </span>
                </div>
              </div>
              {!code.isRevoked && (
                <button
                  type="button"
                  disabled={revokeCode.isPending}
                  onClick={() => revokeCode.mutate({ id: code.id })}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                >
                  <ShieldBan size={14} />
                  إلغاء
                </button>
              )}
            </div>

            {!code.isRevoked && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) setActiveCodeId(null);
                      else {
                        setActiveCodeId(code.id);
                        setEditTotalCredits(String(code.aiCreditsTotal));
                        setEditDailyLimit(String(code.aiDailyLimit));
                      }
                    }}
                    className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-primary"
                  >
                    {isEditing ? 'إغلاق الإدارة' : 'إدارة الرصيد والحدود'}
                  </button>

                  <button
                    type="button"
                    disabled={resetDailyMutation.isPending}
                    onClick={() => resetDailyMutation.mutate({ id: code.id })}
                    className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-stone-200 disabled:opacity-50"
                    title="تصفير الاستهلاك اليومي لهذا الكود فوراً"
                  >
                    <RotateCcw size={12} />
                    تصفير اليومي
                  </button>
                </div>

                {isEditing && (
                  <div className="mt-3 rounded-xl bg-secondary/50 p-3 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-primary">شحن رصيد سريع:</span>
                      <button
                        type="button"
                        disabled={rechargeMutation.isPending}
                        onClick={() => rechargeMutation.mutate({ id: code.id, credits: 20 })}
                        className="rounded-md bg-white px-2 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary hover:text-white"
                      >
                        +20
                      </button>
                      <button
                        type="button"
                        disabled={rechargeMutation.isPending}
                        onClick={() => rechargeMutation.mutate({ id: code.id, credits: 50 })}
                        className="rounded-md bg-white px-2 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary hover:text-white"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        disabled={rechargeMutation.isPending}
                        onClick={() => rechargeMutation.mutate({ id: code.id, credits: 100 })}
                        className="rounded-md bg-white px-2 py-1 text-xs font-bold text-primary shadow-sm hover:bg-primary hover:text-white"
                      >
                        +100
                      </button>
                      <div className="flex items-center gap-1 mr-auto">
                        <input
                          type="number"
                          value={rechargeAmount}
                          onChange={e => setRechargeAmount(e.target.value)}
                          min="1"
                          className="h-8 w-16 rounded-md border border-stone-200 bg-white px-2 text-center text-xs font-bold"
                          placeholder="قيمة"
                        />
                        <button
                          type="button"
                          disabled={rechargeMutation.isPending}
                          onClick={() => handleRecharge(code.id)}
                          className="h-8 rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                        >
                          شحن
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground">الرصيد الكلي (-1 = غير محدود)</label>
                        <input
                          type="number"
                          value={editTotalCredits}
                          onChange={e => setEditTotalCredits(e.target.value)}
                          className="mt-1 h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground">الحد اليومي (-1 = غير محدود)</label>
                        <input
                          type="number"
                          value={editDailyLimit}
                          onChange={e => setEditDailyLimit(e.target.value)}
                          className="mt-1 h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={updateLimitsMutation.isPending}
                      onClick={() => handleUpdateLimits(code.id)}
                      className="w-full h-8 rounded-md bg-primary text-xs font-bold text-primary-foreground disabled:opacity-50"
                    >
                      حفظ الحدود المعدلة
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
      {!codesQuery.data?.length && <p className="rounded-2xl bg-secondary/70 p-4 text-sm text-muted-foreground">لم تُنشأ رموز دخول بعد.</p>}
    </div>
  </section>;
}
